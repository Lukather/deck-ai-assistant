# AI-ssistant Deck

A voice-enabled AI assistant plugin for Steam Deck, built with [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader). Ask questions by voice or text and get responses with awareness of the currently running game.

Thanks to [@cboiangiu](https://github.com/cboiangiu) — his [decky-dictation](https://github.com/cboiangiu/decky-dictation) plugin was the reference for the speech-to-text part.

## Features

- **Voice recording** — offline speech-to-text via Vosk (bundled, no system setup)
- **Text chat** — traditional text input
- **Game context** — detects the active game for contextual answers
- **Chat history** — persistent conversation storage with a sliding context window (last 20 turns sent to the model)
- **Model picker** — choose between Gemini models in Settings (defaults to `gemini-2.5-flash`)
- **Key validation** — the API key is probed against Gemini on save; the status badge reflects real validity
- **Secure API key** — stored locally with restricted file permissions

## Requirements

- Steam Deck with [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) installed
- A free [Gemini API key](https://aistudio.google.com/app/apikey)
- Node 20 + pnpm 9 (to build from source)

Voice dependencies (`vosk`, `nerd-dictation`, `vosk-model`) are built by CI against the SteamOS Python ABI and bundled in the release zip. They are not committed to the repo. Text chat works without them; only the microphone button is disabled if they're missing.

> Voice capture uses a PulseAudio monitor source (`PAREC`). PulseAudio must be running in the Deck session before starting a recording, or the backend reports a startup failure.

## Install from a release

1. Download `deck-ai-assistant.zip` from the [latest release](https://github.com/Lukather/deck-ai-assistant/releases)
2. Extract it to `/home/deck/homebrew/plugins/deck-ai-assistant/`
3. Restart Decky Loader
4. Enter your Gemini API key in the plugin's AI Settings page

The release zip includes the frontend build, backend, and voice dependencies — no build step required.

## Build from source

```bash
pnpm install
pnpm build
```

Output goes to `dist/`. Voice dependencies are not in the repo; either download them from a release zip, or build them with the Dockerfile under `backend/` (SteamOS `holo-base` image, see the `voice-deps` CI job in `.github/workflows/ci.yml`).

## Deploy

Use the bundled script, defaulting to `deck@steamdeck.local`:

```bash
./deploy.sh
# or
./deploy.sh deck@steamdeck-myhost
```

It builds, syncs `dist/`, `main.py`, `plugin.json`, and the voice dependencies to `/home/deck/homebrew/plugins/deck-ai-assistant/`, and restarts Decky Loader.

To deploy manually:

```bash
scp -r dist/ main.py plugin.json py_modules/ \
  deck@steamdeck:/home/deck/homebrew/plugins/deck-ai-assistant/
```

Restart Decky Loader (it runs as a process, not a systemd unit on recent SteamOS):

```bash
ssh deck@steamdeck "ps -ef | grep PluginLoader | grep -v grep"
# then: sudo kill <pid>   (the supervisor auto-restarts it)
```

## Development

```bash
pnpm install      # install dependencies
pnpm build        # build the frontend bundle
pnpm watch        # rebuild on change
pnpm lint         # lint src/ with Biome
pnpm lint:fix     # auto-fix lint issues
pnpm format       # format src/ with Biome
pnpm typecheck    # tsc --noEmit
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and release:

- **voice-deps** — builds `vosk`, `nerd-dictation`, and `vosk-model` in the SteamOS `holo-base` Docker image so the bundled cffi `.so` matches the Deck's Python ABI
- **build** — downloads the voice-deps artifact, builds the frontend, packages the release zip
- **lint** — Biome lint + TypeScript typecheck
- **release** — on a published release, attaches the zip to the GitHub release

## License

GNU GPL v2
