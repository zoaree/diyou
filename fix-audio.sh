#!/bin/bash

echo "🔧 Discord Bot Audio Fix Script"
echo "================================"

# Stop the bot if running
echo "⏹️ Stopping bot..."
pkill -f "node index.js" 2>/dev/null || true

# Update system packages
echo "📦 Updating system packages..."
sudo apt update

# Install system-level audio libraries
echo "🎵 Installing system audio libraries..."
sudo apt install -y libopus-dev opus-tools ffmpeg libavcodec-extra

# Install Python and pip for yt-dlp
echo "🐍 Installing Python and yt-dlp..."
sudo apt install -y python3 python3-pip
pip3 install --upgrade yt-dlp

# Clean npm cache and node_modules
echo "🧹 Cleaning npm cache..."
npm cache clean --force
rm -rf node_modules package-lock.json

# Install Node.js dependencies with specific versions
echo "📦 Installing Node.js dependencies..."
npm install discord.js@14.14.1
npm install @discordjs/voice@0.16.1
npm install @discordjs/opus@0.9.0
npm install ytdl-core@4.11.5
npm install play-dl@1.9.7
npm install youtube-search-api@1.2.0
npm install axios@1.6.2
npm install dotenv@16.3.1

# Try alternative opus packages
echo "🎤 Installing opus alternatives..."
npm install opusscript@0.0.8 --no-optional || true
npm install node-opus@0.3.3 --no-optional || true

# Set environment variables for better compatibility
echo "⚙️ Setting environment variables..."
export YTDL_NO_UPDATE=1
export NODE_ENV=production
export FFMPEG_PATH=/usr/bin/ffmpeg

# Create environment file if not exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "YTDL_NO_UPDATE=1" >> .env
    echo "NODE_ENV=production" >> .env
    echo "FFMPEG_PATH=/usr/bin/ffmpeg" >> .env
fi

echo "✅ Audio fix completed!"
echo "🚀 Starting bot..."
npm start