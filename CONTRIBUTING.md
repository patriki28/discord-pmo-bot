# Contributing

## Local Development Setup

### Prerequisites

- Node.js 18+
- whisper.cpp compiled binary ([build instructions](docs/DEPLOYMENT.md#whisper-cpp-compilation))
- A Discord bot token and application ([Discord Developer Portal](https://discord.com/developers/applications))

### Getting Started

```bash
git clone <repo-url>
cd discord-pmo-bot
npm install
cp .env.example .env   # fill in your values
npm run deploy          # register slash commands with Discord
npm start               # start the bot
```

## Git Workflow

### Protected Branches

`main`, `master`, and `dev` are protected. **Never push directly to these branches.** Always open a pull request.

### Branch Naming

```
feature/<slug>   — new features
fix/<slug>       — bug fixes
chore/<slug>     — maintenance, docs, tooling
```

Examples: `feature/transcript-export`, `fix/reminder-timezone`, `chore/add-changelog`

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <description>

[optional body]
```

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`

Examples:
```
feat: add transcript download as markdown file
fix: prevent duplicate reminder sends on scheduler overlap
docs: add deployment guide for pm2 and Docker
```

### Pull Request Process

1. Create a feature branch from the latest `staging` or `main`.
2. Make your changes with clear, atomic commits.
3. Push your branch and open a PR targeting `staging`.
4. Describe what changed and why in the PR description.
5. Wait for review before merging.

## Project Structure

```
src/
  commands/       Slash command definitions and handlers
  services/       Core logic (database, scheduler, voice, transcription, task detection)
  utils/          Shared helpers (audio processing)
  config.js       Environment variable validation
  index.js        Bot entry point
data/             SQLite database (created at runtime)
docs/             Project documentation
```

## Code Style

- ES modules (`import`/`export`)
- No TypeScript — plain JavaScript
- Async/await for all async operations
- Descriptive variable names; minimal comments where logic is self-evident
