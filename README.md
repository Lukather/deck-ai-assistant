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

   ```bash
   systemctl --user restart decky-loader.service
   ```

## 🛠️ Local Build Instructions

To rebuild the frontend interface from source:

```bash
pnpm install
pnpm build
```

## 🧠 AI Integration

AI-ssistant Deck is designed to integrate with AI providers such as GPT-4, Gemini, or Claude. Just add your API key and the plugin will start sending live prompts and displaying intelligent responses within the UI.

## 💡 Customization

- Use `plugin.json` to configure metadata, plugin title, description, and backend entry
- Define backend methods in `main.py` to expose custom functionality to the frontend
- Icons can be updated using Font Awesome or React Icons

## 👤 Author

**Lorenzo** — Milan, Italy  
GitHub: [lukather](https://github.com/your-username)  
Email: mail@lukather.net

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
- [ ] Implement secure local storage of API key
- [ ] Handle frontend states: loading, error, and response
- [ ] Build a settings interface for user configuration
- [ ] Add a custom icon for the plugin in the Decky menu
- [ ] Add more LLMs integrations (ChatGPT, Claude, self-hosted, HuggingFace)
- [ ] Automatic regcognitions of the game you are playing
- [ ] Store the chat history

## 📄 License

Distributed under the **GNU GPL V2 License**.
