"""Stage 2 — Seed-VC zero-shot voice conversion. Pure function:
(original vocal stem, user's voice reference) -> vocal stem in the user's timbre.

Singing conversion needs F0 conditioning so the melody is preserved while the timbre
becomes the user's. We shell out to the Seed-VC repo's inference script.

NOTE: Seed-VC's CLI flags vary by commit. Adjust the args below to match the version
pinned in the Dockerfile if inference fails — the contract (in: source+target, out: wav)
stays the same."""
import glob
import os
import subprocess

from config import config
from pipeline.gender import estimate_gender


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


def _gender_semitone_shift(vocal_stem: str, user_gender: str | None) -> str:
    """Pitch-match the cover to the user's gender register. If the song is sung by the
    OPPOSITE gender, shift one octave toward the user (male user + female song → down an
    octave so it doesn't sound girly; female user + male song → up). An octave keeps it
    musically IN TUNE with the backing track. Pitch only — the voice/timbre is unchanged."""
    if user_gender not in ("male", "female"):
        return "0"
    song_gender = estimate_gender(vocal_stem)
    if user_gender == "male" and song_gender == "female":
        return "-12"
    if user_gender == "female" and song_gender == "male":
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
    semitone = _gender_semitone_shift(vocal_stem, user_gender)

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
