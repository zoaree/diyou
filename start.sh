#!/usr/bin/env bash
set -euo pipefail

# =============================
#  Discord Bot Kurulum + Başlat
#  Hepsini tek komutta halleder
#  Kullanım: chmod +x start.sh && ./start.sh
# =============================

# ----- Log helpers -----
emoji_ok="✅"; emoji_err="❌"; emoji_info="ℹ️"; emoji_run="🚀"; emoji_pkg="📦"; emoji_net="🌐"; emoji_pm2="🟢"; emoji_node="🟨"; emoji_cfg="⚙️"
log() { echo -e "$1"; }

# ----- Root/Sudo kontrol -----
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then SUDO="sudo"; else
    log "$emoji_err sudo yok ve root değilsin. Root olarak çalıştır ya da sudo kur."; exit 1
  fi
fi

# ----- Distro tespiti -----
if [ -f /etc/debian_version ]; then DISTRO="debian"; else DISTRO="unknown"; fi

# ----- Ağ testi -----
log "$emoji_net İnternet bağlantısı test ediliyor..."
if ! ping -c 1 -W 2 discord.com >/dev/null 2>&1; then
  log "$emoji_err İnternet/Discord'a ulaşılamıyor. Ağ/Firewall kontrol et."; exit 1
fi

# ----- Paketler -----
log "$emoji_pkg Gerekli paketler kuruluyor..."
$SUDO apt-get update -y
$SUDO apt-get install -y ca-certificates curl gnupg lsb-release git build-essential python3 python3-pip ffmpeg

# ----- yt-dlp -----
if ! command -v yt-dlp >/dev/null 2>&1; then
  log "$emoji_pkg yt-dlp kuruluyor..."
  if $SUDO apt-get install -y yt-dlp >/dev/null 2>&1; then :; else
    # Debian eski ise pip ile kur
    python3 -m pip install -U yt-dlp || python3 -m pip install -U yt-dlp --break-system-packages || true
  fi
fi
if ! command -v yt-dlp >/dev/null 2>&1; then
  log "$emoji_err yt-dlp kurulamadı. Elle kurmayı dene: apt install yt-dlp veya pip install yt-dlp"; fi

# ----- Node.js -----
REQUIRED_NODE_MAJOR=16
CURRENT_NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
  CURRENT_NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]") || CURRENT_NODE_MAJOR=0
fi
if [ "$CURRENT_NODE_MAJOR" -lt "$REQUIRED_NODE_MAJOR" ]; then
  log "$emoji_node Node.js >=$REQUIRED_NODE_MAJOR kuruluyor (Nodesource 20.x)..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
  $SUDO apt-get install -y nodejs
fi
log "$emoji_ok Node.js: $(node -v 2>/dev/null || echo 'yok'), npm: $(npm -v 2>/dev/null || echo 'yok')"

# ----- PM2 (opsiyonel ama önerilir) -----
if ! command -v pm2 >/dev/null 2>&1; then
  log "$emoji_pm2 PM2 kuruluyor..."
  $SUDO npm install -g pm2
fi
log "$emoji_ok PM2: $(pm2 -v 2>/dev/null || echo 'yok')"

# ----- Proje dizini kontrol -----
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ----- .env hazırlığı -----
log "$emoji_cfg .env kontrol ediliyor..."
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    log "$emoji_info .env dosyası oluşturuldu. Lütfen DISCORD_TOKEN değerini doldurun."
  else
    touch .env
    echo "DISCORD_TOKEN=YOUR_DISCORD_TOKEN_HERE" > .env
    log "$emoji_info .env dosyası oluşturuldu. Lütfen DISCORD_TOKEN değerini doldurun."
  fi
fi

# ----- Token kontrol -----
DISCORD_TOKEN="$(grep -E '^DISCORD_TOKEN=' .env | sed 's/^DISCORD_TOKEN=//')"
if [ -z "${DISCORD_TOKEN}" ] || [ "${DISCORD_TOKEN}" = "YOUR_DISCORD_TOKEN_HERE" ]; then
  log "$emoji_err .env içinde DISCORD_TOKEN eksik ya da placeholder. Düzenleyin ve tekrar çalıştırın: nano .env"
  exit 1
fi

# ----- NPM paketleri -----
log "$emoji_pkg NPM bağımlılıkları kuruluyor..."
if [ -d node_modules ]; then
  npm install --no-fund --no-audit
else
  npm install --no-fund --no-audit
fi

# ----- Hızlı sağlık kontrolleri -----
node -e "require('discord.js'); console.log('discord.js OK')" >/dev/null 2>&1 || { log "$emoji_err discord.js yüklenemedi"; exit 1; }
command -v ffmpeg >/dev/null 2>&1 || { log "$emoji_err ffmpeg bulunamadı"; exit 1; }

# ----- Başlatma (PM2 tercih) -----
USE_PM2=1
if [ "$USE_PM2" = "1" ]; then
  log "$emoji_pm2 PM2 ile başlatılıyor..."
  pm2 delete diyou-bot >/dev/null 2>&1 || true
  pm2 start index.js --name diyou-bot
  pm2 save || true
  # Boot'a ekle (systemd)
  if command -v systemctl >/dev/null 2>&1; then
    $SUDO env PATH=$PATH:/usr/bin pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null 2>&1 || true
  fi
  log "$emoji_ok Bot PM2 altında çalışıyor. Loglar: pm2 logs diyou-bot"
else
  log "$emoji_run NPM ile başlatılıyor (3 deneme)..."
  for i in 1 2 3; do
    echo "Deneme $i/3..."; sleep 1
    if npm start; then
      log "$emoji_ok Bot başarıyla başlatıldı!"; break
    else
      log "$emoji_err Başlatma hatası, tekrar denenecek..."
      [ "$i" = "3" ] && { log "$emoji_err 3 deneme başarısız"; exit 1; }
    fi
  done
fi

log "$emoji_ok Kurulum ve başlatma tamam."