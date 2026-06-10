"""Pro Voice — fine-tune a Seed-VC model on the user's voice for high-fidelity cloning.

Reuses the Seed-VC repo already in the image (its train.py). The resulting checkpoint is
loaded at cover time via inference.py --checkpoint (see pipeline/convert.py) for a much
closer match than zero-shot. See docs/PRO_VOICE.md for the full flow.

NOTE: Seed-VC's train.py CLI varies by commit. The args below are the intended shape and
MUST be validated against the pinned repo on the worker. Failures are reported back to the
API (handler returns a `failed` payload) and never affect the zero-shot cover path."""
import glob
import os
import shutil
import subprocess

from config import config
from pipeline.convert import _clean_reference


class TrainingError(RuntimeError):
    pass

# Base singing (f0) model we fine-tune FROM — must match the cover inference config
# (config_dit_mel_seed_uvit_whisper_base_f0_44k.yml). Without a pretrained base, train.py
# starts from scratch and a few seconds of audio yields a junk model.
_BASE_REPO = "Plachta/Seed-VC"
_BASE_CKPT_FILE = "DiT_seed_v2_uvit_whisper_base_f0_44k_bigvgan_pruned_ft_ema_v2.pth"


def _download_base_ckpt() -> str | None:
    """Fetch the base f0 checkpoint into the HF cache; return its local path (or None)."""
    try:
        from huggingface_hub import hf_hub_download

        return hf_hub_download(_BASE_REPO, _BASE_CKPT_FILE)
    except Exception:
        return None


def finetune_voice(voice_ref: str, run_name: str, workdir: str) -> str:
    """Fine-tune on the user's (cleaned) voice sample → path to the trained checkpoint."""
    cleaned = _clean_reference(voice_ref, workdir)

    # Seed-VC fine-tune expects a folder of target-speaker audio clips.
    data_dir = os.path.join(workdir, "spk")
    os.makedirs(data_dir, exist_ok=True)
    shutil.copy(cleaned, os.path.join(data_dir, "ref.wav"))

    cmd = [
        "python", os.path.join(config.seed_vc_dir, "train.py"),
        "--config", os.path.join(config.seed_vc_dir, config.finetune_config),
        "--dataset-dir", data_dir,
        "--run-name", run_name,
        "--max-steps", str(config.finetune_steps),
        "--max-epochs", str(config.finetune_steps),
        "--batch-size", "2",
        "--save-every", str(config.finetune_steps),
        "--num-workers", "0",
    ]
    # Fine-tune FROM the base singing model (critical — otherwise it trains from scratch).
    base_ckpt = _download_base_ckpt()
    if base_ckpt:
        cmd += ["--pretrained-ckpt", base_ckpt]

    proc = subprocess.run(cmd, capture_output=True, text=True, cwd=config.seed_vc_dir)
    if proc.returncode != 0:
        raise TrainingError(f"seed-vc train failed: {proc.stderr[-500:]}")

    # train.py saves checkpoints under ./runs/{run_name}/ (relative to the repo).
    candidates = glob.glob(os.path.join(config.seed_vc_dir, "runs", run_name, "*.pth"))
    if not candidates:
        raise TrainingError("training produced no checkpoint")
    return max(candidates, key=os.path.getmtime)
