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

1. **Build voice dependencies** (on development machine):
   ```bash
   cd backend
   docker build -t deck-ai-assistant-backend .
   docker run --rm -v "${PWD}/../output:/output" --env out=/output --entrypoint=/bin/sh deck-ai-assistant-backend -c 'cp -r /vosk /output/ && cp -r /nerd-dictation /output/ && cp -r /vosk-model /output/'
   ```

2. **Copy to Steam Deck**:
   ```bash
   # Copy main plugin files
   scp -r dist/ main.py plugin.json deck@steamdeck:/home/deck/homebrew/plugins/deck-ai-assistant/
   
   # Copy voice dependencies  
   scp -r output/vosk/ output/nerd-dictation/ output/vosk-model/ deck@steamdeck:/home/deck/homebrew/plugins/deck-ai-assistant/
   ```

3. **Restart Decky Loader** and enter your [Gemini API key](https://aistudio.google.com/app/apikey)

## Development

```bash
pnpm install
pnpm build
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

