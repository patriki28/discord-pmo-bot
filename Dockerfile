# --- Build stage: compile whisper.cpp and download model ---
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake git ca-certificates wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Compile whisper.cpp
RUN git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git \
    && cd whisper.cpp \
    && cmake -B build \
    && cmake --build build -j$(nproc) \
    && mkdir -p /opt/whisper/bin /opt/whisper/models \
    && cp build/bin/whisper-cli /opt/whisper/bin/ \
    && bash models/download-ggml-model.sh medium \
    && cp models/ggml-medium.bin /opt/whisper/models/

# Install Node.js dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- Runtime stage ---
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /opt/whisper /opt/whisper
COPY --from=builder /app/node_modules ./node_modules
COPY . .

RUN mkdir -p data

ENV WHISPER_CPP_PATH=/opt/whisper/bin/whisper-cli
ENV WHISPER_MODEL_PATH=/opt/whisper/models/ggml-medium.bin

ENTRYPOINT ["node", "src/index.js"]
