# 🥐 Boyoz Sistem

![Boyoz Sistem](assets/banner.jpg)

Slash komutlarıyla çalışan, çok amaçlı Discord sunucu botu: **moderasyon, otomasyon, log, duyuru, eğlence** ve sadece yetkili ID'lerin kullanabildiği **özel komutlar**.

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
`.env.example` dosyasını `.env.local` adıyla kopyalayıp doldurun:

```env
DISCORD_TOKEN=bot_tokeniniz
OWNER_IDS=sizin_discord_id,arkadasinizin_id
GUILD_ID=sunucu_id        # opsiyonel: komutlar bu sunucuda anında görünür
AUTO_DEPLOY=true
```

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

### 🎉 Eğlence
`/boyoz` ekonomisi (günlük ödül + seri bonusu, çalış, ye, hediye et, bahis, sıralama, boyoz bilgileri) · `/anket` (butonlu, canlı sonuçlu, süreli) · `/xox` (arkadaşına karşı veya bota karşı) · `/tkm` · `/zar` · `/yazitura` · `/8top` · `/sec` · `/espri` · `/iltifat` · `/ask-olcer` · `/slot`

### 📌 Genel
`/yardim` (kategorili menü) · `/ping` · `/bot-bilgi` · `/kullanici-bilgi` · `/sunucu-bilgi` · `/avatar` · `/seviye` · `/siralama` · `/hatirlat`

---

## ⚠️ Önemli notlar
- **Botun rolü**, yöneteceği rollerin (otorol, rol menüsü, susturulacak kişiler) **üstünde** olmalı. *Sunucu Ayarları → Roller*'den Boyoz Sistem rolünü yukarı sürükleyin.
- `GUILD_ID` doluyken global'e geçerseniz komutlar iki kez görünebilir. Bu durumda `npm run deploy:temizle` sonra `npm run deploy` çalıştırın.
- Veriler `data/db.json` içindedir. Yedek almak için bu dosyayı kopyalamanız yeterli.
- `.env.local` ve `data/` git'e gönderilmez (`.gitignore`).

## 📁 Proje yapısı
```
assets/            Boyoz görselleri (kaynak/ altında orijinaller)
src/
  index.js         Giriş noktası
  deploy.js        Slash komut yükleyici
  config.js        .env.local okuma ve sabitler
  commands/<kategori>/*.js
  events/          Discord olayları (etkileşim, mesaj, üye, loglar)
  lib/             db, automod, seviye, zamanlayıcı, kart, log, vaka...
```

Yeni komut eklemek için `src/commands/<kategori>/` altına `{ data, execute }` export eden bir dosya koymanız yeterli; bot açılışta otomatik yükler.
