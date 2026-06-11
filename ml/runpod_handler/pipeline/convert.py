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

    common = [
        "python", os.path.join(config.seed_vc_dir, "inference.py"),
        "--source", vocal_stem,
        "--target", voice_ref,
        "--output", out_dir,
        # 50 steps → clearer, sweeter conversion (research: 30–50 for singing; more = cleaner).
        "--diffusion-steps", "50",
        # NO pitch shift: research shows shifting distorts formants → the hoarse/'bonguru
        # gonthu', too-deep sound. Keep the melody in the song's key with the user's natural,
        # clear voice. (Cross-gender deepening = the artifact the user disliked.)
        "--f0-condition", "True",
        "--auto-f0-adjust", "False",
        "--semi-tone-shift", "0",
    ]

    # Pro Voice (fine-tuned checkpoint) is DISABLED. Use the zero-shot path with the DEFAULT
    # cfg-rate (0.7) — maxing it to 1.0 made the voice harsh; 0.7 is smoother and clearer.
    variants: list[list[str]] = [[]]

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
