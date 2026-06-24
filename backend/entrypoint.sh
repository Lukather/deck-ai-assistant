#!/bin/sh
set -e

echo "Container's IP address: `awk 'END{print $1}' /etc/hosts`"

# Copy voice recording dependencies to output
echo "Copying voice recording dependencies..."
cp -r /vosk $out/
cp -r /nerd-dictation $out/
cp -r /vosk-model $out/

echo "Voice dependencies copied to plugin output"
