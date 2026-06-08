"""Stage 1 — Demucs stem separation. Pure function: (song path) -> (vocals, instrumental).

Uses `--two-stems vocals` so Demucs emits exactly `vocals.wav` and `no_vocals.wav`
(the instrumental), which is all we need for an AI cover."""
import glob
import os
import subprocess

from config import config


class SeparationError(RuntimeError):
    pass


def separate_stems(song_path: str, workdir: str) -> tuple[str, str]:
    out_dir = os.path.join(workdir, "stems")
    os.makedirs(out_dir, exist_ok=True)

    cmd = [
        "python", "-m", "demucs",
        "-n", config.demucs_model,
        "--two-stems", "vocals",
        "-o", out_dir,
        song_path,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise SeparationError(f"demucs failed: {proc.stderr[-500:]}")

    # Demucs writes to {out_dir}/{model}/{track_name}/{vocals,no_vocals}.wav
    vocals = glob.glob(os.path.join(out_dir, "**", "vocals.wav"), recursive=True)
    instrumental = glob.glob(os.path.join(out_dir, "**", "no_vocals.wav"), recursive=True)
    if not vocals or not instrumental:
        raise SeparationError("demucs produced no stems")
    return vocals[0], instrumental[0]
