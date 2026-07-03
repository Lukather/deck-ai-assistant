# AI-ssistant Deck

A voice-enabled AI assistant plugin for Steam Deck, built with [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader). Ask questions by voice or text and get responses with awareness of the currently running game.

Thanks to [@cboiangiu](https://github.com/cboiangiu) — his [decky-dictation](https://github.com/cboiangiu/decky-dictation) plugin was the reference for the speech-to-text part.

## Features

- **Voice recording** — offline speech-to-text via Vosk
- **Text chat** — traditional text input
- **Game context** — detects the active game for contextual answers
- **Chat history** — persistent conversation storage
- **Secure API key** — stored locally with restricted permissions

## Requirements

- Steam Deck with [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) installed
- A free [Gemini API key](https://aistudio.google.com/app/apikey)
- Node 20 + pnpm 9 (to build from source)

Voice dependencies (`vosk`, `nerd-dictation`, `vosk-model`) are bundled under `py_modules/`. Text chat works without them; only the microphone button is disabled if they're missing.

> Voice capture uses a PulseAudio monitor source (`PAREC`). PulseAudio must be running in the Deck session before starting a recording, or the backend reports a startup failure.

## Build

```bash
pnpm install
pnpm build
```

Output goes to `dist/`.

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
ssh deck@steamdeck "sudo systemctl restart decky-loader"
```

After the first install, enter your Gemini API key in the plugin's AI Settings page.

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

## License

GNU GPL v2
