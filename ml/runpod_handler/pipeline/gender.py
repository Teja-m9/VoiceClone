"""Gender-matched singer replacement.

Replace ONLY the matching-gender singer's parts with the user's voice; keep the opposite
singer + music untouched. The matching is done per-moment from the lead vocal's pitch
(PYIN — octave-accurate, unlike YIN which misreads low male voices an octave high).

FAIL-SAFE: any problem raises / returns 'unknown' and the caller falls back to the fully-
converted vocal, so a cover always renders.

HARD LIMIT (honest): when a male and female sing AT THE SAME TIME (choruses), no available
model cleanly splits them into separate singer stems — the pitch mask follows the dominant
voice there. Clean separation works for alternating lines; true per-singer stems for
overlapping vocals are a research-grade problem."""
import numpy as np
import soundfile as sf

try:
    import librosa
    _LIBROSA = True
except Exception:  # librosa comes from the seed-vc deps; guard just in case
    _LIBROSA = False

FEMALE_SPLIT_HZ = 165.0   # below → male range, above → female range
FMIN, FMAX = 65.0, 500.0
_ANALYSIS_SR = 16000
_HOP = 256


def median_f0(wav_path: str) -> float | None:
    """Median F0 (Hz) of a voice clip, or None. PYIN (accurate) on the first 45s."""
    if not _LIBROSA:
        return None
    try:
        y, _ = librosa.load(wav_path, sr=_ANALYSIS_SR, mono=True, duration=45.0)
        f0, _, _ = librosa.pyin(y, fmin=FMIN, fmax=FMAX, sr=_ANALYSIS_SR)
        vals = f0[~np.isnan(f0)]
        if vals.size < 10:
            return None
        return float(np.median(vals))
    except Exception:
        return None


def estimate_gender(wav_path: str) -> str:
    m = median_f0(wav_path)
    if m is None:
        return "unknown"
    return "male" if m < FEMALE_SPLIT_HZ else "female"


def _gender_sample_mask(y: np.ndarray, sr: int, n: int, want: str) -> np.ndarray:
    """Per-sample mask (len n): 1.0 where the lead is `want` gender (or unvoiced) → use the
    converted/user voice; 0.0 where it's the opposite gender → keep original. PYIN-based."""
    y16 = librosa.resample(y, orig_sr=sr, target_sr=_ANALYSIS_SR) if sr != _ANALYSIS_SR else y
    f0, _, _ = librosa.pyin(y16, fmin=FMIN, fmax=FMAX, sr=_ANALYSIS_SR, hop_length=_HOP)
    voiced = ~np.isnan(f0)
    f0z = np.where(voiced, f0, 0.0)
    is_want = (f0z < FEMALE_SPLIT_HZ) if want == "male" else (f0z >= FEMALE_SPLIT_HZ)
    frame = np.ones(len(f0), dtype=np.float32)        # default 1 (convert) for silence/unvoiced
    frame[voiced & ~is_want] = 0.0                     # opposite-gender singing → keep original

    # Map the frame timeline → samples, then smooth ~90ms so transitions don't flicker/click.
    if len(frame) < 2:
        return np.ones(n, dtype=np.float32)
    frame_t = (np.arange(len(frame)) * _HOP) / _ANALYSIS_SR
    samp_t = np.arange(n) / sr
    mask = np.interp(samp_t, frame_t, frame, left=frame[0], right=frame[-1]).astype(np.float32)
    win = max(1, int(sr * 0.09))
    mask = np.convolve(mask, np.ones(win, dtype=np.float32) / win, mode="same")
    return np.clip(mask, 0.0, 1.0)


def selective_convert(original_vocal: str, converted_vocal: str, user_gender: str, out_path: str) -> str:
    """Keep only the user's-gender singer's parts as the converted voice; opposite singer
    stays the original. Raises on failure (caller falls back to the full conversion)."""
    if not _LIBROSA or user_gender not in ("male", "female"):
        raise RuntimeError("selective conversion unavailable")
    yo, sr = librosa.load(original_vocal, sr=None, mono=True)
    yc, _ = librosa.load(converted_vocal, sr=sr, mono=True)
    n = int(min(len(yo), len(yc)))
    if n <= 0:
        raise RuntimeError("empty vocal")
    yo, yc = yo[:n], yc[:n]

    mask = _gender_sample_mask(yo, sr, n, user_gender)
    out = yc * mask + yo * (1.0 - mask)
    sf.write(out_path, out.astype(np.float32), sr)
    return out_path


def dual_voice_blend(conv_male: str, conv_female: str, original_vocal: str, out_path: str) -> str:
    """DUET: male singer's parts → the male-part voice, female singer's parts → the female-
    part voice. Raises on failure."""
    if not _LIBROSA:
        raise RuntimeError("librosa unavailable")
    yo, sr = librosa.load(original_vocal, sr=None, mono=True)
    ym, _ = librosa.load(conv_male, sr=sr, mono=True)
    yf, _ = librosa.load(conv_female, sr=sr, mono=True)
    n = int(min(len(yo), len(ym), len(yf)))
    if n <= 0:
        raise RuntimeError("empty vocal")
    yo, ym, yf = yo[:n], ym[:n], yf[:n]

    mask = _gender_sample_mask(yo, sr, n, "male")  # 1 → male voice, 0 → female voice
    out = ym * mask + yf * (1.0 - mask)
    sf.write(out_path, out.astype(np.float32), sr)
    return out_path
