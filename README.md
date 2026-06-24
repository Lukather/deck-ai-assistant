### I'm writing this plugin with the help of AI (Mainly Cursor and Claude Code). I think AI (LLMs) is a great helping tool, I understand and very well know the ethical implications and I'm actively working with some communities to have laws and rules to be approved (mainly in EU, where I live). I'm also working to have an homelab and run my own Opensource LLM engine and model offline, it will not as good as Claude Code and co. but at least I will be a little more relieved to not participate in the un-ethical rush for the money. We can discuss on Mastodon, if you want @lukather@mastodon.uno

Many many thanks to [@cboiangiu](https://github.com/cboiangiu) I've used his plugin as a learning object for the "speech-to-text- part of my plugin https://github.com/cboiangiu/decky-dictation

# AI-ssistant Deck

**AI-ssistant Deck** is a voice-enabled AI assistant plugin for Steam Deck, built with [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader). Ask questions using voice or text and get intelligent responses with game context awareness.

## Features

- 🎤 **Voice Recording**: Speech-to-text using offline Vosk recognition
- 💬 **Text Chat**: Traditional text input with AI responses  
- 🎮 **Game Context**: Automatically detects active games for contextual assistance
- 💾 **Chat History**: Persistent conversation storage
- 🔐 **Secure API**: Local storage of Gemini API key with restricted permissions

## Installation

### 1. Build voice dependencies (one-time, on your dev machine)

Voice recording needs the `vosk` library, `nerd-dictation`, and an English speech model. Build them with Docker (Linux/macOS):

```bash
cd backend
docker build -t deck-ai-voice .
docker run --rm -v "$(pwd)/..:/output" --env out=/output deck-ai-voice
```

This produces three directories next to the plugin source:
- `vosk/` — Vosk speech recognition library
- `nerd-dictation/` — Offline dictation tool
- `vosk-model/` — English speech model

If you'd rather install on the Steam Deck directly:

```bash
git clone https://github.com/ideasman42/nerd-dictation.git
pip install vosk
wget https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
unzip vosk-model-small-en-us-0.15.zip
```

> Voice input is captured from a PulseAudio monitor source (`PAREC`). Make sure PulseAudio is running on the Deck session before starting a recording, or the backend will report a startup failure.

### 2. Build the plugin

```bash
pnpm install
pnpm build
```

### 3. Copy to Steam Deck

```bash
scp -r dist/ main.py plugin.json deck@steamdeck:/home/deck/homebrew/plugins/deck-ai-assistant/

# Voice dependencies (skip if you don't need voice)
scp -r vosk/ nerd-dictation/ vosk-model/ deck@steamdeck:/home/deck/homebrew/plugins/deck-ai-assistant/
```

Or use the bundled `deploy.sh` script.

### 4. Restart Decky Loader

Then enter your [Gemini API key](https://aistudio.google.com/app/apikey) in the plugin's AI Settings page.

> Text chat works without the voice dependencies — only the microphone button is disabled until `vosk/`, `nerd-dictation/`, and `vosk-model/` are present.

## Development

```bash
pnpm install          # Install dependencies
pnpm build            # Build the frontend bundle
pnpm lint             # Lint src/ with Biome
pnpm lint:fix         # Auto-fix lint issues
pnpm format           # Format src/ with Biome
pnpm typecheck        # Run tsc --noEmit
```

## Getting Started

1. Get your free [Gemini API key](https://aistudio.google.com/app/apikey)
2. Install the plugin on Steam Deck  
3. Enter your API key in the plugin settings
4. Start chatting via text or voice!

## Author

**Lorenzo** — Milan, Italy  
GitHub: [lukather](https://github.com/lukather)  
Mastodon: [@lukather](https://mastodon.uno/@lukather)

## 📄 License

GNU GPL v2 License
