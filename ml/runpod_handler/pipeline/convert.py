"""Stage 2 — Seed-VC zero-shot voice conversion. Pure function:
(original vocal stem, user's voice reference) -> vocal stem in the user's timbre.

Singing conversion needs F0 conditioning so the melody is preserved while the timbre
becomes the user's. We shell out to the Seed-VC repo's inference script.

NOTE: Seed-VC's CLI flags vary by commit. Adjust the args below to match the version
pinned in the Dockerfile if inference fails — the contract (in: source+target, out: wav)
stays the same."""
import glob
import math
import os
import subprocess

from config import config
from pipeline.gender import median_f0

# Fallback ceiling (Hz) when the user's reference pitch can't be measured.
MALE_RANGE_CEIL_HZ = 165.0


class ConversionError(RuntimeError):
    pass


def _clean_reference(voice_ref: str, workdir: str) -> str:
    """Isolate the user's voice from their recording before cloning: band-limit to the
    speech range, FFT-denoise the background (room/traffic/hiss), and level it. A clean
    reference makes the clone sound like the user — not the noise they recorded in."""
    cleaned = os.path.join(workdir, "voice_ref_clean.wav")
    # Stronger denoise + a low noise gate so only the user's clean voice survives (no room
    # tone / background between words), then level it.
    flt = (
        "highpass=f=90,lowpass=f=11000,"
        "afftdn=nr=30:nf=-30,"
        "agate=threshold=0.012:ratio=2:attack=15:release=250,"
        "dynaudnorm=f=200:g=5"
    )
    proc = subprocess.run(
        ["ffmpeg", "-y", "-i", voice_ref, "-af", flt, "-ar", "22050", "-ac", "1", cleaned],
        capture_output=True, text=True,
    )
    return cleaned if proc.returncode == 0 and os.path.exists(cleaned) else voice_ref


def _pitch_match_shift(vocal_stem: str, voice_ref: str, user_gender: str | None) -> str:
    """Shift the song's vocal to the USER's natural octave so the cover sounds like their
    REAL voice — only drop to a deep/'bass' octave if the user's own voice is actually that
    low; if their voice already sits near the song's range, no shift (use the real voice that
    mixes with the music). Decided by the user's reference pitch vs the song's pitch, rounded
    to whole octaves (octaves stay in tune with the backing). Pitch only — timbre unchanged.

    Falls back to a gender hint if the user's pitch can't be measured."""
    song_f0 = median_f0(vocal_stem)
    user_f0 = median_f0(voice_ref)
    if song_f0 and user_f0:
        # nearest number of octaves that lands the song's pitch on the user's voice
        octaves = max(-2, min(2, round(math.log2(user_f0 / song_f0))))
        return str(octaves * 12)
    # Fallback: octave toward the user's gender if the song is clearly in the other range.
    if user_gender == "male" and song_f0 and song_f0 > MALE_RANGE_CEIL_HZ:
        return "-12"
    if user_gender == "female" and song_f0 and song_f0 < MALE_RANGE_CEIL_HZ:
        return "12"
    return "0"


def convert_voice(
    vocal_stem: str,
    voice_ref: str,
    workdir: str,
    checkpoint: str | None = None,  # accepted for API compatibility; Pro is DISABLED below
    model_config: str | None = None,
    user_gender: str | None = None,
) -> str:
    out_dir = os.path.join(workdir, "converted")
    os.makedirs(out_dir, exist_ok=True)

    voice_ref = _clean_reference(voice_ref, workdir)
    semitone = _pitch_match_shift(vocal_stem, voice_ref, user_gender)

    common = [
        "python", os.path.join(config.seed_vc_dir, "inference.py"),
        "--source", vocal_stem,
        "--target", voice_ref,
        "--output", out_dir,
        # 30 steps is Seed-VC's recommended setting for singing — good quality and fast.
        "--diffusion-steps", "30",
        # Keep the song's melody; auto-f0-adjust OFF so it stays in the song's key. The
        # gender octave shift (semitone) lands a male user in male range while staying in tune.
        "--f0-condition", "True",
        "--auto-f0-adjust", "False",
        "--semi-tone-shift", semitone,
    ]

    # Pro Voice (fine-tuned checkpoint) is DISABLED — the trained models produced poor output.
    # Always use the reliable zero-shot path: cleanest voice, fully the user's timbre
    # (cfg-rate=1.0), pitch-matched to the song. Plain defaults as a safety fallback.
    variants: list[list[str]] = [["--inference-cfg-rate", "1.0"], []]

    last = None
    for extra in variants:
        last = subprocess.run(common + extra, capture_output=True, text=True, cwd=config.seed_vc_dir)
        if last.returncode == 0:
            break
    if last is None or last.returncode != 0:
        raise ConversionError(f"seed-vc failed: {(last.stderr if last else '')[-500:]}")

    produced = glob.glob(os.path.join(out_dir, "*.wav"))
    if not produced:
        raise ConversionError("seed-vc produced no output")
    return max(produced, key=os.path.getmtime)  # newest, in case a failed attempt left a stale file
