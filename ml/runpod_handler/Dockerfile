# GPU image for the RealMVP clone pipeline (Demucs + Seed-VC + FFmpeg).
FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    SEED_VC_DIR=/opt/seed-vc

RUN apt-get update && apt-get install -y --no-install-recommends \
        python3.11 python3-pip git ffmpeg && \
    ln -sf /usr/bin/python3.11 /usr/bin/python && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Seed-VC has no PyPI package — install from source and its deps.
RUN git clone https://github.com/Plachtaa/seed-vc.git ${SEED_VC_DIR} && \
    pip install --no-cache-dir -r ${SEED_VC_DIR}/requirements.txt

# Pre-warm Demucs weights into the image so cold starts don't re-download them.
RUN python -m demucs --help >/dev/null 2>&1 || true

COPY . /app
CMD ["python", "handler.py"]
