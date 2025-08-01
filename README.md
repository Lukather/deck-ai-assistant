# 🤖 AI-ssistant Deck

**AI-ssistant Deck** is a plugin for the Steam Deck built with [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader). It allows users to ask questions to a custom AI assistant directly from their console.

## ✨ Features

- Integrated React frontend with Decky UI components
- Python backend with method bridging via Decky Loader
- Dynamic responses from AI models (Gemini now, others in the future)
- API key saving

## 🧰 Requirements

- Steam Deck with Decky Loader installed
- Python 3.x
- Node.js + pnpm (for development and building)
- TypeScript + Rollup build system

## 🚀 Manual Installation

1. Clone or download the project on your PC
2. Transfer the folder `deck-ai-assistant` to:

   ```
   /home/deck/homebrew/plugins/deck-ai-assistant
   ```

3. Restart Decky Loader:

 

## 🛠️ Local Build Instructions

To rebuild the frontend interface from source:

```bash
pnpm install
pnpm build
```

## 🧠 AI Integration

AI-ssistant Deck integrates with Google Gemini (and will support more AI models in the future). To use the plugin, you must provide your own Gemini API key. The plugin securely stores your API key locally and uses it to send your questions to Gemini, returning intelligent responses in the UI.

### How it Works
- The backend (Python) securely stores your Gemini API key in `~/.aiassistant_config.json` with restricted permissions (`chmod 600`).
- The frontend (React/TypeScript) allows you to enter and save your API key, ask questions, and view responses in a chat-style interface.
- Questions and conversation history are sent to the backend, which formats the prompt and communicates with Gemini's API.
- All logging uses `decky.logger` for debugging and error tracking.
- Error handling is implemented for invalid questions, missing/invalid API keys, and network/API errors.

## 🔑 How to Get a Gemini API Key

1. Go to the [Google AI Studio](https://aistudio.google.com/app/apikey) and sign in with your Google account.
2. Click on "Create API key" and follow the instructions.
3. Copy your new API key.
4. In the AI-ssistant Deck plugin, open the settings and paste your API key.
5. Save the key. It will be stored securely and used for all future requests.

*Note: Keep your API key private. If you believe it has been compromised, revoke it from the Google AI Studio and generate a new one.*

## 💡 Customization

- Use `plugin.json` to configure metadata, plugin title, description, and backend entry
- Define backend methods in `main.py` to expose custom functionality to the frontend
- Icons can be updated using Font Awesome or React Icons

## 👤 Author

**Lorenzo** — Milan, Italy  
GitHub: [lukather](https://github.com/your-username)  
Mastodon: [lukather](https://mastodon.uno/@lukather)
Newsletter: [lukather](https://news.ilgiocatore.net)

## 📋 ToDo List

### ✅ Tasks Completed
- [x] Created the deck-ai-assistant project using Decky plugin template
- [x] Customized plugin.json with correct name and description
- [x] Updated package.json with author, repo, and metadata
- [x] Fixed TypeScript issues in AIAssistant.tsx (TS2345, TS2322, etc.)
- [x] Successfully transferred the plugin files to Steam Deck via SCP
- [x] Updated plugin name displayed in Decky menu
- [x] Verified frontend UI displays correctly inside Decky menu
- [x] Ensure main.py backend is loaded and recognized by Decky Loader
- [x] Add logging with decky.logger.info() for debugging
- [x] Confirm communication between frontend and backend via ask_question()
- [x] Integrate real AI API (Gemini)
- [x] Added a bubble-chat UI in the AI view

### 🧩 Tasks To Do
- [x] Implement secure local storage of API key
- [ ] Handle frontend states: loading, error, and response
- [ ] Build a settings interface for user configuration
- [ ] Add a custom icon for the plugin in the Decky menu
- [ ] Add more LLMs integrations (ChatGPT, Claude, self-hosted, HuggingFace)
- [ ] Automatic regcognitions of the game you are playing
- [ ] Store the chat history

## 📄 License

Distributed under the **GNU GPL V2 License**.
