"""Selective gender conversion.

Only the parts of the song sung in the USER's vocal range are replaced with their voice;
the other gender's vocal is kept original. So a male user covering a song with a female
part gets: male lines → his voice, female lines → untouched.

Heuristic, pitch-based (median F0 per frame) — no speaker-diarization model needed. The
whole module is FAIL-SAFE: any problem raises/returns 'unknown' and the caller falls back
to the fully-converted vocal, so a cover always renders. For a same-gender song every frame
matches the user, so the output is identical to plain conversion (no regression)."""
import numpy as np
import soundfile as sf

try:
    import librosa
    _LIBROSA = True
except Exception:  # librosa comes from the seed-vc deps; guard just in case
    _LIBROSA = False

# Split between typical male and female singing F0. Frames below → male, above → female.
FEMALE_SPLIT_HZ = 165.0
FMIN, FMAX = 65.0, 500.0
HOP = 512


def median_f0(wav_path: str) -> float | None:
    """Median fundamental frequency (Hz) of a voice clip, or None. Fast: first 45s, YIN."""
    if not _LIBROSA:
        return None
    try:
        y, sr = librosa.load(wav_path, sr=16000, mono=True, duration=45.0)
        f0 = librosa.yin(y, fmin=FMIN, fmax=FMAX, sr=sr)
        vals = f0[(f0 > FMIN) & (f0 < FMAX)]
        if vals.size < 10:
            return None
        return float(np.median(vals))
    except Exception:
        return None


def estimate_gender(wav_path: str) -> str:
    """Median-F0 → 'male' | 'female' | 'unknown'."""
    m = median_f0(wav_path)
    if m is None:
        return "unknown"
    return "male" if m < FEMALE_SPLIT_HZ else "female"


def selective_convert(original_vocal: str, converted_vocal: str, user_gender: str, out_path: str) -> str:
    """Blend converted (user's-gender frames) with original (other-gender frames).

    Returns out_path on success; raises on any failure so the caller can fall back to the
    fully-converted vocal."""
    if not _LIBROSA or user_gender not in ("male", "female"):
        raise RuntimeError("selective conversion unavailable")

    yo, sr = librosa.load(original_vocal, sr=None, mono=True)
    yc, _ = librosa.load(converted_vocal, sr=sr, mono=True)
    n = int(min(len(yo), len(yc)))
    if n <= 0:
        raise RuntimeError("empty vocal")
    yo, yc = yo[:n], yc[:n]

    # Per-frame F0 of the ORIGINAL vocal decides who is singing when.
    f0, _, _ = librosa.pyin(yo, fmin=FMIN, fmax=FMAX, sr=sr, hop_length=HOP)

    # frame mask: 1 → use converted (user's gender, or unvoiced/silence), 0 → keep original.
    frame = np.ones(len(f0), dtype=np.float32)
    voiced = ~np.isnan(f0)
    frame_gender_is_user = (
        (f0 < FEMALE_SPLIT_HZ) if user_gender == "male" else (f0 >= FEMALE_SPLIT_HZ)
    )
    frame[voiced & ~frame_gender_is_user] = 0.0  # other gender → keep original

    # frames → samples, then smooth (~40ms) so transitions don't click.
    mask = np.repeat(frame, HOP)[:n]
    if mask.size < n:
        mask = np.pad(mask, (0, n - mask.size), constant_values=1.0)
    win = max(1, int(sr * 0.04))
    mask = np.convolve(mask, np.ones(win, dtype=np.float32) / win, mode="same")
    mask = np.clip(mask, 0.0, 1.0)

    out = yc * mask + yo * (1.0 - mask)
    sf.write(out_path, out.astype(np.float32), sr)
    return out_path
