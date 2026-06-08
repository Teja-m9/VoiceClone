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

# Shallow-clone Seed-VC and install its deps (torch already present from the base).
RUN git clone --depth 1 https://github.com/Plachtaa/seed-vc.git ${SEED_VC_DIR} && \
    pip install --no-cache-dir -r ${SEED_VC_DIR}/requirements.txt

COPY ml/runpod_handler/ /app
CMD ["python", "handler.py"]
