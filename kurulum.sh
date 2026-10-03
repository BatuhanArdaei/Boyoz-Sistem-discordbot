#!/usr/bin/env bash
# Boyoz Sistem - Ubuntu sunucu kurulum scripti (Oracle Cloud, Google Cloud, herhangi bir VPS)
# Kullanım (proje klasörünün içinde):  bash kurulum.sh
# Tekrar çalıştırmak güvenlidir: güncellemek için de aynı komutu kullanabilirsiniz.
set -euo pipefail

cd "$(dirname "$0")"
yesil() { printf '\033[1;32m%s\033[0m\n' "$1"; }
sari() { printf '\033[1;33m%s\033[0m\n' "$1"; }

yesil "🥐 Boyoz Sistem kurulumu başlıyor..."

# 1) RAM 2 GB'tan azsa swap ekle (ücretsiz küçük sunucularda npm install sırasında bellek yetmeyebilir)
if [ "$(free -m | awk '/^Mem:/{print $2}')" -lt 2000 ] && ! swapon --show | grep -q .; then
  yesil "➜ 1 GB swap alanı oluşturuluyor..."
  sudo fallocate -l 1G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

# 2) Node.js 22
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  yesil "➜ Node.js 22 kuruluyor..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - >/dev/null
  sudo apt-get install -y nodejs >/dev/null
fi
yesil "✔ Node.js $(node -v)"

# 3) PM2
if ! command -v pm2 >/dev/null; then
  yesil "➜ PM2 kuruluyor..."
  sudo npm install -g pm2 >/dev/null
fi

# 4) Proje paketleri
if [ -d .git ]; then
  yesil "➜ Son sürüm çekiliyor..."
  git pull --ff-only || sari "⚠ git pull yapılamadı, mevcut sürümle devam ediliyor."
fi
yesil "➜ Paketler kuruluyor..."
npm ci --omit=dev --no-audit --no-fund

# 5) .env.local
if [ ! -f .env.local ]; then
  yesil "➜ Bot ayarları (.env.local oluşturulacak)"
  read -rsp "Discord bot token'ı (yazarken görünmez): " TOKEN; echo
  read -rp "Yetkili Discord ID'leri (virgülle ayır): " OWNERS
  read -rp "Test sunucusu ID'si (boş bırakabilirsin): " GUILD
  umask 077
  cat > .env.local <<EOF
DISCORD_TOKEN=${TOKEN}
OWNER_IDS=${OWNERS}
GUILD_ID=${GUILD}
AUTO_DEPLOY=true
EOF
  umask 022
  yesil "✔ .env.local oluşturuldu (sadece sen okuyabilirsin)."
else
  yesil "✔ .env.local zaten var, dokunulmadı."
fi

# 6) Botu başlat ve açılışta otomatik başlamasını sağla
if pm2 describe boyoz >/dev/null 2>&1; then
  pm2 restart boyoz --update-env
else
  pm2 start ecosystem.config.js
fi
pm2 save
sudo env PATH="$PATH" "$(command -v pm2)" startup systemd -u "$USER" --hp "$HOME" >/dev/null

yesil ""
yesil "🎉 Kurulum tamam! Bot 7/24 çalışıyor ve sunucu yeniden başlasa da kendiliğinden açılacak."
echo  "   Loglar:        pm2 logs boyoz"
echo  "   Durum:         pm2 status"
echo  "   Yeniden başlat: pm2 restart boyoz"
echo  "   Güncelle:      bash kurulum.sh"
sleep 3
pm2 logs boyoz --lines 15 --nostream || true
