# 🥐 Boyoz Sistem

![Boyoz Sistem](assets/banner.jpg)

**Boyoz sunucusuna özel**, slash komutlarıyla çalışan çok amaçlı Discord botu: **moderasyon, otomasyon, log, duyuru, TikTok yayın bildirimi, 25+ oyun, eğlence** ve sadece yetkili ID'lerin kullanabildiği **özel komutlar**.

> 🔒 Bot sadece `.env.local`'daki `GUILD_ID` sunucusunda çalışır; başka bir sunucuya eklenirse kendiliğinden ayrılır. Developer Portal → Bot sekmesinde **Public Bot** seçeneğini kapatırsanız kimse davet linki de oluşturamaz.

Node.js + discord.js v14 ile yazıldı. Veriler `data/db.json` dosyasında tutulur, ek bir veritabanı kurmanıza gerek yok.

---

## 🚀 Kurulum

### 1. Discord Developer Portal
1. <https://discord.com/developers/applications> → **New Application** → isim: *Boyoz Sistem*
2. **Bot** sekmesi → **Reset Token** → token'ı kopyalayın
3. Aynı sayfada **Privileged Gateway Intents** altında şunları **açın**:
   - ✅ `SERVER MEMBERS INTENT`
   - ✅ `MESSAGE CONTENT INTENT`
4. **OAuth2 → URL Generator** → Scopes: `bot` + `applications.commands`, Bot Permissions: `Administrator` → çıkan linkle botu sunucunuza ekleyin.

### 2. Ayar dosyası
Proje klasöründe **`.env.local`** adında bir dosya oluşturun (`baslat.bat` ilk çalıştırmada kendisi oluşturur) ve doldurun:

```env
DISCORD_TOKEN=bot_tokeniniz
OWNER_IDS=sizin_discord_id,arkadasinizin_id
GUILD_ID=sunucu_id        # opsiyonel: komutlar bu sunucuda anında görünür
AUTO_DEPLOY=true
```

> ⚠️ Token'ı **sadece `.env.local`** içine yazın. Bu dosya `.gitignore`'da olduğu için GitHub'a gitmez. Token'ı başka hiçbir dosyaya yazmayın.

> Discord ID'yi almak için: Ayarlar → Gelişmiş → **Geliştirici Modu**'nu açın, sonra kullanıcıya/sunucuya sağ tıklayıp **ID'yi Kopyala**.

### 3. Çalıştırma
**En kolayı:** `baslat.bat` dosyasına çift tıklayın. Paketleri kendisi kurar, bot çökerse yeniden başlatır.

Ya da terminalden:
```bash
npm install
npm start
```

Bot açılınca slash komutlarını kendisi yükler. `GUILD_ID` doluysa komutlar o sunucuda **anında**, boşsa tüm sunucularda **~1 saat içinde** görünür.

### 4. Bot profilini Boyoz yapmak
Bot açıldıktan sonra Discord'da `/bot-profil hedef: Profil fotoğrafı + banner` komutunu kullanın. `assets/` klasöründeki Boyoz görselleri botun profil fotoğrafı ve bannerı olur.

---

## 📚 Komutlar

### 👑 Özel (sadece `OWNER_IDS` + `/yetkili` ile eklenenler)
| Komut | Açıklama |
|---|---|
| `/yaz metin [kanal] [yanitla] [dosya]` | Bot metni kendi ağzından yazar, **komuttan hiçbir iz kalmaz**. `\n` alt satır yapar. |
| `/embed-yaz [kanal] [renk] [gorsel] ...` | Formdan şık embed mesaj gönderir |
| `/mesaj-duzenle mesaj` | Botun gönderdiği mesajı düzenler |
| `/tepki mesaj emojiler` | Bot adına tepki bırakır |
| `/dm kullanici metin` | Bot üzerinden DM atar |
| `/durum tur metin [statu]` | Botun durumunu değiştirir (kalıcı) |
| `/yetkili ekle/cikar/liste` | Özel komut yetkililerini yönetir |
| `/bot-profil` | Profil fotoğrafı / banner ayarlar |
| `/sunucular [ayril]` | Sunucuları listeler / sunucudan ayrılır |

> Bu komutlar varsayılan olarak sadece **Yönetici** izni olanlara görünür. Yönetici olmayan bir yetkilinin görmesi için: *Sunucu Ayarları → Entegrasyonlar → Boyoz Sistem* üzerinden izin verin. Görünse bile ID'si tanımlı olmayan kimse kullanamaz.

### 🛡️ Moderasyon
`/ban` (süreli ban destekli) · `/unban` (yasaklılar arasında arama) · `/kick` · `/sustur` · `/susturma-kaldir` · `/uyar` · `/uyarilar` · `/uyari-sil` · `/sicil` · `/vaka` · `/temizle` (kullanıcı/bot/link/ek filtreli) · `/yavasmod` · `/kilitle` · `/kilit-ac` · `/rol ver/al` · `/takmaad`

Her işlem numaralı bir **vaka** olarak kaydedilir, moderasyon log kanalına düşer ve kullanıcıya DM ile bildirilir.

### ⚙️ Otomasyon
| Komut | Açıklama |
|---|---|
| `/hosgeldin ayarla/dm/veda/kapat/test/durum` | Avatarlı **Boyoz temalı karşılama kartı**, veda mesajı, yeni üyeye DM |
| `/otorol ekle/cikar/liste` | Katılan insanlara/botlara otomatik rol |
| `/automod ...` | Davet, link, küfür, büyük harf, spam, toplu etiket filtreleri; ceza: sil / uyar / sustur; muaf rol-kanal; izinli linkler |
| `/otocevap ekle/sil/liste` | Kelimeye otomatik cevap ve/veya tepki |
| `/seviye-ayar ...` | XP/seviye sistemi ve seviye ödül rolleri |
| `/rolmenu` | Butonlu veya açılır menülü rol seçme paneli |
| `/ses-kanali ayarla/ayril/durum` | Bot seçilen ses kanalında **7/24** durur, düşerse kendisi geri bağlanır |

Mesaj değişkenleri: `{kullanici}` `{kullanici_adi}` `{isim}` `{sunucu}` `{uye_sayisi}` `{seviye}` ve `\n`

### 📜 Log
`/log kur` tek komutla gizli bir **🥐 Boyoz Log** kategorisi ve 5 log kanalı oluşturur. Ya da `/log ayarla tur kanal` ile elle ayarlayın.

| Tür | Neler loglanır |
|---|---|
| 💬 Mesaj | Silinen, düzenlenen, toplu silinen mesajlar (toplu silmede .txt dökümü) |
| 👥 Üye | Giriş (yeni hesap uyarısı), çıkış/atılma, rol, takma ad, zaman aşımı, avatar |
| 🔊 Ses | Kanala giriş, çıkış, geçiş, sunucu susturması |
| 🛠️ Sunucu | Kanal/rol oluşturma-silme-düzenleme, izin değişiklikleri, sunucu ayarları, davetler |
| 🛡️ Moderasyon | Tüm vakalar, AutoMod işlemleri, sağ tık ile yapılan ban/unban'lar |

### 📢 Duyuru
| Komut | Açıklama |
|---|---|
| `/duyuru gonder` | Formdan duyuru yazılır, **önizleme** gösterilir, onaylayınca gönderilir |
| `/duyuru zamanla zaman [tekrar]` | `2026-10-05 20:30`, `05.10.2026 20:30`, `20:30` veya `2h` gibi zamanlar; günlük/haftalık/saatlik tekrar |
| `/duyuru liste` / `/duyuru iptal` | Zamanlanmış duyuruları yönetir |
| `/duyuru kanal` | Varsayılan duyuru kanalı |

Seçenekler: @everyone / @here / rol etiketi, renk, görsel URL'si veya Boyoz bannerı, imza, 🥐 tepkisi. Duyuru kanalı tipindeki kanallarda mesaj otomatik yayınlanır.

### 🎵 TikTok yayın bildirimi
| Komut | Açıklama |
|---|---|
| `/tiktok ekle kullanici kanal [rol] [mesaj]` | Hesabı takibe alır, kanala **sürekli duran bir durum kartı** koyar |
| `/tiktok kontrol` / `/tiktok test` / `/tiktok liste` / `/tiktok sil` | Durumu yenile, etiketsiz önizleme, liste, kaldır |

Kart yayın yokken **⚫ YAYINCI ÇEVRİMDIŞI**, yayın başlayınca **🔴 YAYINCI ÇEVRİMİÇİ** olur ve ayrı bir mesajla seçilen rol etiketlenir. Yayın bitince etiket mesajı silinir, kart çevrimdışına döner. Kontrol ~1,5 dakikada bir yapılır. TikTok'un resmi bir canlı yayın API'si olmadığı için TikTok web sitesinin kullandığı veri okunur; TikTok bunu değiştirirse güncelleme gerekebilir.

### 🎮 Oyunlar
Kazananlar **boyoz** kazanır; boyozlar `/boyoz cuzdan` ve `/boyoz siralama`'da görünür.

| Tür | Komutlar |
|---|---|
| ⚡ Kanal yarışmaları (ilk bilen kazanır) | `/bilgi-yarismasi` (80 soru, butonlu, çok turlu, puan tablosu) · `/bayrak` (84 ülke) · `/emoji-bilmece` · `/matematik` · `/hizli-yaz` (yazı görsel olarak, kopyalanamaz) · `/kelime-coz` · `/sayi-tahmin` (⬆️⬇️ ipuçlu) |
| 🔤 Kelime | `/kelimebul` (Türkçe Wordle, renkli tahta + klavye görseli) · `/adam-asmaca` (kanalca) |
| 🎰 Kumarhane (sanal boyoz) | `/blackjack` (kart çek / dur / ikiye katla) · `/rulet` · `/cark` (3 saatte bir ücretsiz şans çarkı) · `/slot` |
| ⚔️ PvP | `/duello` (saldır, güçlü vuruş, savun, boyoz ye; isteğe bağlı bahis) · `/dort-bagla` · `/xox` · `/tkm` |
| 🎭 Parti | `/dogruluk-cesaret` · `/hangisi` (canlı oylama) · `/mayin-tarlasi` |
| 🔁 Sürekli kanal oyunları | `/oyun-kanali ayarla` → **Sayma kanalı** (sırayla say, yanlış yapan sıfırlar) ve **Kelime zinciri** (son harfle devam et) |

### 🎉 Eğlence
`/boyoz` ekonomisi (günlük ödül + seri bonusu, çalış, ye, hediye et, bahis, sıralama, boyoz bilgileri) · `/anket` (butonlu, canlı sonuçlu, süreli) · `/saril` `/tokat` `/op` `/oksa` `/yumruk` `/cak` `/dans` `/agla` (hareketli GIF'ler) · `/hayvan` (kedi, köpek, tilki, ördek fotoğrafları) · `/fal` · `/zar` · `/yazitura` · `/8top` · `/sec` · `/espri` · `/iltifat` · `/ask-olcer`

### 📌 Genel
`/yardim` (kategorili menü) · `/ping` · `/bot-bilgi` · `/kullanici-bilgi` · `/sunucu-bilgi` · `/avatar` · `/seviye` · `/siralama` · `/hatirlat`

---

## ☁️ Sunucuda 7/24 çalıştırma ve güncelleme
Bot bir Ubuntu sunucuda (ör. Oracle Cloud Always Free) PM2 ile çalışır. İlk kurulum, sunucunun içinde:
```bash
git clone https://github.com/BatuhanArdaei/Boyoz-Sistem-discordbot.git
cd Boyoz-Sistem-discordbot
bash kurulum.sh
```

**Yenilik getirdiğinizde:**
1. Değişikliği bilgisayarınızda yapın, commit'leyip GitHub'a push'layın.
2. `guncelle.bat` dosyasına çift tıklayın. Sunucuya bağlanıp son sürümü çeker, paketleri günceller ve botu yeniden başlatır.

Elle yapmak isterseniz: `ssh boyoz` → `cd Boyoz-Sistem-discordbot && git pull && npm ci --omit=dev && pm2 restart boyoz`

Sunucudaki veriler (`data/db.json`) ve token (`.env.local`) güncellemelerden etkilenmez.

| Sunucuda işe yarar komutlar | |
|---|---|
| `pm2 logs boyoz` | Canlı loglar |
| `pm2 status` | Bot çalışıyor mu? |
| `pm2 restart boyoz` | Yeniden başlat |
| `pm2 stop boyoz` | Durdur |

## ⚠️ Önemli notlar
- **Botun rolü**, yöneteceği rollerin (otorol, rol menüsü, susturulacak kişiler) **üstünde** olmalı. *Sunucu Ayarları → Roller*'den Boyoz Sistem rolünü yukarı sürükleyin.
- `GUILD_ID` doluyken global'e geçerseniz komutlar iki kez görünebilir. Bu durumda `npm run deploy:temizle` sonra `npm run deploy` çalıştırın.
- Veriler `data/db.json` içindedir. Yedek almak için bu dosyayı kopyalamanız yeterli.
- `.env.local` ve `data/` git'e gönderilmez (`.gitignore`).

## 📁 Proje yapısı
```
assets/            Boyoz görselleri (kaynak/ altında orijinaller), fonts/ (Poppins, OFL lisanslı)
src/
  index.js         Giriş noktası
  deploy.js        Slash komut yükleyici
  config.js        .env.local okuma ve sabitler
  commands/<kategori>/*.js
  events/          Discord olayları (etkileşim, mesaj, üye, loglar)
  lib/             db, automod, seviye, zamanlayıcı, kart, log, vaka...
```

Yeni komut eklemek için `src/commands/<kategori>/` altına `{ data, execute }` export eden bir dosya koymanız yeterli; bot açılışta otomatik yükler.
