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


class ConversionError(RuntimeError):
    pass


def _clean_reference(voice_ref: str, workdir: str) -> str:
    """Isolate the user's voice from their recording before cloning: band-limit to the
    speech range, FFT-denoise the background (room/traffic/hiss), and level it. A clean
    reference makes the clone sound like the user — not the noise they recorded in."""
    cleaned = os.path.join(workdir, "voice_ref_clean.wav")
    flt = "highpass=f=80,lowpass=f=11000,afftdn=nr=24:nf=-28,dynaudnorm=f=200:g=5"
    proc = subprocess.run(
        ["ffmpeg", "-y", "-i", voice_ref, "-af", flt, "-ar", "22050", "-ac", "1", cleaned],
        capture_output=True, text=True,
    )
    return cleaned if proc.returncode == 0 and os.path.exists(cleaned) else voice_ref


def convert_voice(vocal_stem: str, voice_ref: str, workdir: str) -> str:
    out_dir = os.path.join(workdir, "converted")
    os.makedirs(out_dir, exist_ok=True)

    voice_ref = _clean_reference(voice_ref, workdir)

    cmd = [
        "python", os.path.join(config.seed_vc_dir, "inference.py"),
        "--source", vocal_stem,
        "--target", voice_ref,
        "--output", out_dir,
        # More diffusion steps → closer timbre match to the user's voice.
        "--diffusion-steps", "50",
        # Preserve the song's exact melody AND key. auto-f0-adjust is OFF on purpose:
        # turning it on re-pitches the vocal toward the user's speaking range, which pulls
        # it OUT of the instrumental's key and makes voice + music clash. Off → the cloned
        # vocal stays in the song's original pitch, so it sits in tune with the music.
        "--f0-condition", "True",
        "--auto-f0-adjust", "False",
        "--semi-tone-shift", "0",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, cwd=config.seed_vc_dir)
    if proc.returncode != 0:
        raise ConversionError(f"seed-vc failed: {proc.stderr[-500:]}")

    produced = sorted(glob.glob(os.path.join(out_dir, "*.wav")))
    if not produced:
        raise ConversionError("seed-vc produced no output")
    return produced[-1]
