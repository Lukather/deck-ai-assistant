# Builds the three voice-dep directories (vosk, nerd-dictation, vosk-model)
# against SteamOS's Python, so the bundled cffi .so ABI matches the Deck.
# Driven by the voice-deps CI job in .github/workflows/ci.yml.
FROM ghcr.io/steamdeckhomebrew/holo-base:latest

# holo-base mirrors SteamOS, so binaries built here match the Deck's runtime.
RUN pacman -Sydd --noconfirm --dbpath /var/lib/pacman python-pip git wget unzip

# vosk + its dependency tree (cffi, requests, ...), vendored into /vosk.
RUN pip3 install --target=/vosk vosk

# nerd-dictation: offline dictation tool (single Python script).
RUN git clone https://github.com/ideasman42/nerd-dictation.git /nerd-dictation

# Small English model (~40MB).
RUN wget -q https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip -O /tmp/model.zip \
 && unzip -q /tmp/model.zip -d /tmp \
 && mv /tmp/vosk-model-small-en-us-0.15 /vosk-model \
 && rm /tmp/model.zip

COPY entrypoint.sh /backend/entrypoint.sh
ENTRYPOINT [ "/backend/entrypoint.sh" ]
