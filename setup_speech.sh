#!/usr/bin/env bash

echo "🔧 Setting up Audio Recording for AI-ssistant Deck"
echo "=================================================="

# Check if we're on Steam Deck
if [ ! -f "/etc/os-release" ] || ! grep -q "SteamOS" /etc/os-release; then
    echo "⚠️  This script is designed for Steam Deck. Proceeding anyway..."
fi

echo "📦 Installing system dependencies..."

# Install PulseAudio and GStreamer (native to Steam Deck)
echo "Installing PulseAudio and GStreamer..."
sudo pacman -S --noconfirm pulseaudio gstreamer gst-plugins-base gst-plugins-good gst-plugins-bad

echo "Installing httpx..."
pip3 install httpx

echo ""
echo "✅ Dependencies installed successfully!"
echo ""
echo "🎤 Audio recording should now be available!"
echo "   The plugin uses PulseAudio and GStreamer for audio capture."
echo ""
echo "🔄 Please restart Decky Loader:"
echo "   systemctl --user restart decky-loader.service" 