# we support images for building with a vanilla SteamOS base,
# or versions with ootb support for rust or go
# developers can also customize these images via this Dockerfile
#FROM ghcr.io/steamdeckhomebrew/holo-toolchain-rust:latest
#FROM ghcr.io/steamdeckhomebrew/holo-toolchain-go:latest
FROM ghcr.io/steamdeckhomebrew/holo-base:latest

# Install dependencies for voice recording
RUN pacman -Syu --noconfirm python python-pip git wget unzip

# Install vosk to /vosk
RUN pip install --target /vosk vosk

# Clone nerd-dictation
RUN git clone https://github.com/ideasman42/nerd-dictation.git /nerd-dictation

# Download and install a small English Vosk model
RUN cd /tmp && \
    wget https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip && \
    unzip vosk-model-small-en-us-0.15.zip && \
    mv vosk-model-small-en-us-0.15 /vosk-model && \
    rm vosk-model-small-en-us-0.15.zip

# Copy backend files into the container
COPY . /backend

# entrypoint.sh should always be located in the backend folder
ENTRYPOINT [ "/backend/entrypoint.sh" ]