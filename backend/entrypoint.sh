#!/bin/sh
set -e

# Copy the three built voice-dep directories to the output mount ($out),
# which CI bind-mounts at the plugin's py_modules/ directory.
cp -r /vosk "$out/"
cp -r /nerd-dictation "$out/"
cp -r /vosk-model "$out/"
