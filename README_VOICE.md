# Voice Recording Setup

## Current Status
The frontend build is complete. However, voice recording requires additional dependencies that need to be built using Docker.

## To Enable Voice Recording:

### Option 1: Build with Docker (Recommended)
On a system with Docker installed:
```bash
cd backend
docker build -t deck-ai-voice .
docker run --rm -v $(pwd):/backend deck-ai-voice
```

This will create the required directories:
- `vosk/` - Vosk speech recognition library
- `nerd-dictation/` - Offline dictation tool  
- `vosk-model/` - English speech model

### Option 2: Manual Installation on Steam Deck
1. Install dependencies on Steam Deck:
```bash
# Install nerd-dictation
git clone https://github.com/ideasman42/nerd-dictation.git

# Install Vosk
pip install vosk

# Download small English model
wget https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
unzip vosk-model-small-en-us-0.15.zip
```

2. Copy these to the plugin directory

## Current Plugin State
- ✅ Frontend built and ready
- ✅ Backend Python code ready
- ❌ Voice dependencies need Docker build or manual setup

The plugin will work for text chat, but voice recording will show "nerd-dictation not available" until dependencies are added.