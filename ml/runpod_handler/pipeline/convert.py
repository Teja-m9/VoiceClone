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


def convert_voice(vocal_stem: str, voice_ref: str, workdir: str) -> str:
    out_dir = os.path.join(workdir, "converted")
    os.makedirs(out_dir, exist_ok=True)

    cmd = [
        "python", os.path.join(config.seed_vc_dir, "inference.py"),
        "--source", vocal_stem,
        "--target", voice_ref,
        "--output", out_dir,
        "--diffusion-steps", "30",
        "--f0-condition", "True",      # preserve melody/pitch for singing
        "--auto-f0-adjust", "True",
        "--semi-tone-shift", "0",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, cwd=config.seed_vc_dir)
    if proc.returncode != 0:
        raise ConversionError(f"seed-vc failed: {proc.stderr[-500:]}")

    produced = sorted(glob.glob(os.path.join(out_dir, "*.wav")))
    if not produced:
        raise ConversionError("seed-vc produced no output")
    return produced[-1]
