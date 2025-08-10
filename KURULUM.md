# 🧰 Kurulum Rehberi

Bu rehber, botun Linux (Ubuntu/Debian) başta olmak üzere genel kurulum adımlarını içerir. Diğer dağıtımlarda paket isimleri küçük farklılık gösterebilir.

## 1) Önkoşullar
- İnternet erişimli bir sunucu veya bilgisayar
- Node.js LTS (18 veya 20) ve npm
- Git
- ffmpeg (önerilir)
- yt-dlp (zorunlu; proje fallback olarak `yt-dlp -f` çağırıyor)
- Python 3 ve pip (yt-dlp’yi pip ile kuracaksan)

## 2) Gerekli paketleri kur
Ubuntu/Debian için:
```bash
sudo apt update
sudo apt install -y git curl build-essential ffmpeg python3 python3-pip
```

yt-dlp kurulum seçenekleri:
- pip ile:
```bash
python3 -m pip install -U yt-dlp
```
- veya tek binary olarak PATH’e kur:
```bash
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

Node.js LTS (nvm önerilir):
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install --lts
nvm use --lts
```

## 3) Kodu indirme
Git ile:
```bash
git clone <REPO_URL> diyou
cd diyou
```
Ya da dosyaları SCP/rsync ile sunucuya kopyalayın ve klasöre geçin.

## 4) Ortam değişkenleri (.env)
```bash
cp .env.example .env
```
`.env` dosyasını açın ve Discord bot token’ınızı girin:
```
DISCORD_TOKEN=BURAYA_DISCORD_BOT_TOKEN
```
Discord Developer Portal > Bot sekmesinde token’ınızı bulabilirsiniz. Ayrıca “Message Content Intent”i açık olduğundan emin olun.

## 5) Bağımlılıkları yükle ve test çalıştırma
```bash
npm install
node index.js
```
Her şey doğruysa terminalde bot “ready” loglarını görürsünüz ve Discord’da çevrimiçi olur.

## 6) Sürekli çalıştırma
PM2 ile (önerilir):
```bash
npm i -g pm2
pm2 start index.js --name diyou-bot
pm2 save
pm2 startup systemd   # Çıktıdaki komutu bir kez çalıştırın
pm2 status
pm2 logs diyou-bot
```

systemd (alternatif): `/etc/systemd/system/diyou.service`
```
[Unit]
Description=Diyou Discord Bot
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/diyou
ExecStart=/usr/bin/node index.js
Environment=NODE_ENV=production
Environment=DISCORD_TOKEN=BURAYA_TOKEN
Restart=always
User=botuser
Group=botuser

[Install]
WantedBy=multi-user.target
```
Aktifleştirme:
```bash
sudo systemctl daemon-reload
sudo systemctl enable diyou
sudo systemctl start diyou
sudo systemctl status diyou
```
Not: Token’ı servis dosyasına yazmak yerine `/opt/diyou/.env` içinde tutup `EnvironmentFile=/opt/diyou/.env` ile de kullanabilirsiniz.

## 7) Güncelleme ve yeniden başlatma
```bash
# Kodu güncelleyin
git pull
npm install

# PM2
pm2 restart diyou-bot

# veya systemd
sudo systemctl restart diyou
```

## 8) Hızlı Komut Özeti
- Müzik: `!play`, `!stop`, `!skip`, `!queue/!kuyruk`, `!shuffle/!karistir`, `!repeat/!tekrar`, `!volume/!ses <0-10>`, `!nowplaying/!np`, `!askloop`
- Oyun: `!oyunkesfet/!oyunara <kelime>`, `!oyunpuan <oyun>`, `!oyuntur <kategori>`
- Görsel/SFW: `!panda`, `!fox/!tilki`, `!bird/!kus`, `!space/!uzay`, `!nature/!doga`, `!anime`, `!manga`

## 9) Sorun Giderme
- `yt-dlp` bulunamadı:
  - `which yt-dlp` boşsa PATH’e kurmadınız. pip ile kurduysanız pip bin dizini PATH’te olmalı veya binary’yi `/usr/local/bin`e koyun.
- Ses/oynatma çalışmıyor:
  - Botun “Connect/Speak” izinleri olduğundan emin olun; sunucuda ffmpeg kurulu.
- Mesaj içeriği okunmuyor:
  - Discord Portal’da “Message Content Intent” aktif mi kontrol edin.
- Log’lar:
  - PM2: `pm2 logs diyou-bot`
  - systemd: `journalctl -u diyou -f`