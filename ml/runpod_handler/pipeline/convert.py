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
    checkpoint: str | None = None,
    model_config: str | None = None,
) -> str:
    out_dir = os.path.join(workdir, "converted")
    os.makedirs(out_dir, exist_ok=True)

    voice_ref = _clean_reference(voice_ref, workdir)

    base = [
        "python", os.path.join(config.seed_vc_dir, "inference.py"),
        "--source", vocal_stem,
        "--target", voice_ref,
        "--output", out_dir,
        # 30 steps is Seed-VC's recommended setting for singing — good quality and ~2x
        # faster than 60 (a full song at 60 steps was slow enough to look stuck). The big
        # voice-match win comes from cfg-rate=1.0 below, not from piling on steps.
        "--diffusion-steps", "30",
        # Preserve the song's exact melody AND key. auto-f0-adjust is OFF on purpose:
        # turning it on re-pitches the vocal toward the user's speaking range, which pulls
        # it OUT of the instrumental's key and makes voice + music clash. Off → the cloned
        # vocal stays in the song's original pitch, so it sits in tune with the music.
        "--f0-condition", "True",
        "--auto-f0-adjust", "False",
        "--semi-tone-shift", "0",
    ]
    # Pro Voice: load the user's fine-tuned checkpoint for a near-indistinguishable clone.
    # Zero-shot (no checkpoint) is unchanged. See docs/PRO_VOICE.md.
    if checkpoint:
        base += ["--checkpoint", checkpoint]
        if model_config:
            base += ["--config", model_config]
    # Stronger classifier-free guidance pushes the output HARD toward the user's voice and
    # strips the original singer's residual timbre — fixes the "blend of two voices" sound.
    # If this build's inference.py doesn't accept the flag, fall back to the base args so the
    # job still succeeds instead of failing on an unrecognized argument.
    strong = base + ["--inference-cfg-rate", "1.0"]

    proc = subprocess.run(strong, capture_output=True, text=True, cwd=config.seed_vc_dir)
    if proc.returncode != 0 and (
        "inference-cfg-rate" in proc.stderr or "unrecognized arguments" in proc.stderr.lower()
    ):
        proc = subprocess.run(base, capture_output=True, text=True, cwd=config.seed_vc_dir)
    if proc.returncode != 0:
        raise ConversionError(f"seed-vc failed: {proc.stderr[-500:]}")

    produced = sorted(glob.glob(os.path.join(out_dir, "*.wav")))
    if not produced:
        raise ConversionError("seed-vc produced no output")
    return produced[-1]
