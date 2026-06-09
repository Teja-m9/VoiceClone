# Slim GPU image for the Auralis clone pipeline. Uses the official PyTorch CUDA base
# (torch preinstalled, widely cached on Runpod nodes → much faster cold start than
# building torch on top of a raw CUDA base).
# Runpod build context = repo root; Dockerfile path = ml/runpod_handler/Dockerfile.
FROM pytorch/pytorch:2.4.1-cuda12.1-cudnn9-runtime

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    SEED_VC_DIR=/opt/seed-vc

# build-essential (gcc/g++) is needed to compile C-extension deps like webrtcvad.
RUN apt-get update && apt-get install -y --no-install-recommends git ffmpeg build-essential && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY ml/runpod_handler/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Shallow-clone Seed-VC and install ONLY inference deps. We strip out:
#  - torch/torchvision/torchaudio  → already in the base (and the right cu121 build;
#    reinstalling re-downloaded ~800MB and replaced the GPU build)
#  - gradio / FreeSimpleGUI / sounddevice  → web/desktop UI + local audio I/O, unused headless
# This roughly halves the image so the worker can actually pull & boot.
RUN git clone --depth 1 https://github.com/Plachtaa/seed-vc.git ${SEED_VC_DIR} && \
    grep -viE '^(torch|torchvision|torchaudio|gradio|freesimplegui|sounddevice)([=<>~! ]|$)' \
        ${SEED_VC_DIR}/requirements.txt > /tmp/seedvc-req.txt && \
    pip install --no-cache-dir -r /tmp/seedvc-req.txt

COPY ml/runpod_handler/ /app
CMD ["python", "handler.py"]
