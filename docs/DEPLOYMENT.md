# Deployment Guide

## Prerequisites

- Node.js 18+
- A compiled whisper.cpp binary
- A Discord bot token with the following gateway intents: Guilds, GuildVoiceStates, GuildMembers
- Bot invited to your server with `applications.commands` and `bot` scopes

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Bot token from Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Application ID from Discord Developer Portal |
| `WHISPER_CPP_PATH` | Absolute path to `whisper-cli` binary |
| `WHISPER_MODEL_PATH` | Absolute path to GGML model file (e.g., `ggml-medium.bin`) |

## whisper.cpp Compilation

### Windows

```bash
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
cmake -B build
cmake --build build --config Release
```

Binary: `build/bin/Release/whisper-cli.exe`

### Linux

```bash
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
cmake -B build
cmake --build build
```

Binary: `build/bin/whisper-cli`

### macOS

```bash
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
cmake -B build -DWHISPER_COREML=ON   # optional: CoreML acceleration
cmake --build build
```

Binary: `build/bin/whisper-cli`

### Download Model

```bash
cd whisper.cpp
bash models/download-ggml-model.sh medium
```

This downloads `ggml-medium.bin` to the `models/` directory. Available sizes: `tiny`, `base`, `small`, `medium`, `large`.

## Quick Start (Development)

```bash
npm install
cp .env.example .env    # fill in values
npm run deploy           # register slash commands
npm start                # start bot
```

## Production: pm2

[pm2](https://pm2.keymetrics.io/) keeps the bot alive and handles restarts.

```bash
npm install -g pm2
pm2 start src/index.js --name pmo-bot
pm2 save
pm2 startup   # generates OS startup script
```

Useful commands:
```bash
pm2 logs pmo-bot        # view logs
pm2 restart pmo-bot     # restart
pm2 stop pmo-bot        # stop
```

## Production: systemd (Linux)

Create `/etc/systemd/system/pmo-bot.service`:

```ini
[Unit]
Description=Discord PMO Bot
After=network.target

[Service]
Type=simple
User=pmo
WorkingDirectory=/opt/discord-pmo-bot
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5
EnvironmentFile=/opt/discord-pmo-bot/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable pmo-bot
sudo systemctl start pmo-bot
sudo journalctl -u pmo-bot -f   # view logs
```

## Production: Docker

### Dockerfile

A multi-stage Dockerfile is provided that compiles whisper.cpp and downloads the model in the build stage, then produces a slim runtime image.

```dockerfile
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
```

### docker-compose.yml

```yaml
services:
  pmo-bot:
    build: .
    restart: unless-stopped
    env_file: .env
    environment:
      WHISPER_CPP_PATH: /opt/whisper/bin/whisper-cli
      WHISPER_MODEL_PATH: /opt/whisper/models/ggml-medium.bin
    volumes:
      - ./data:/app/data
```

### Usage

```bash
# Build and start
docker compose up -d --build

# View logs
docker compose logs -f pmo-bot

# Stop
docker compose down
```

The `data/` volume mount ensures the SQLite database persists across container restarts.

## Registering Slash Commands

Run once after first deploy or whenever commands change:

```bash
npm run deploy
# or inside Docker:
docker compose exec pmo-bot node src/commands/deploy.js
```

## Notes

- The SQLite database is created automatically at `data/bot.db` on first run.
- WAL mode is enabled for better concurrent read performance.
- Temp audio files are written to the OS temp directory and cleaned up immediately after transcription.
- All times use Asia/Manila (PHT) timezone.
