// Komut dosyalarını yükler. Her dosya tek bir komut ya da komut dizisi export edebilir:
// { data: SlashCommandBuilder, execute(i), autocomplete?(i), components?: { [aksiyon]: (i, args) => {} }, ownerOnly? }
// Bileşen customId biçimi: "<komut>:<aksiyon>:<arg1>:<arg2>..."
const fs = require('node:fs');
const path = require('node:path');

const CATEGORIES = {
  genel: { label: 'Genel', emoji: '📌', description: 'Bilgi ve yardımcı komutlar' },
  eglence: { label: 'Eğlence', emoji: '🎉', description: 'Oyunlar, boyoz ekonomisi ve eğlence' },
  moderasyon: { label: 'Moderasyon', emoji: '🛡️', description: 'Ban, kick, susturma, uyarı, temizleme' },
  otomasyon: { label: 'Otomasyon', emoji: '⚙️', description: 'Hoş geldin, otorol, automod, otocevap, seviye, rol menüsü' },
  log: { label: 'Log', emoji: '📜', description: 'Sunucu kayıt kanalları' },
  duyuru: { label: 'Duyuru', emoji: '📢', description: 'Duyuru gönderme ve zamanlama' },
  ozel: { label: 'Özel', emoji: '👑', description: 'Sadece bot yetkililerinin kullanabildiği komutlar' },
};

function loadCommands() {
  const commands = new Map();
  const dir = path.join(__dirname, '..', 'commands');
  for (const category of fs.readdirSync(dir)) {
    const catDir = path.join(dir, category);
    if (!fs.statSync(catDir).isDirectory()) continue;
    for (const file of fs.readdirSync(catDir).filter((f) => f.endsWith('.js'))) {
      const exported = require(path.join(catDir, file));
      for (const cmd of Array.isArray(exported) ? exported : [exported]) {
        if (!cmd?.data || !cmd.execute) {
          console.warn(`[komut] ${category}/${file} geçersiz, atlandı.`);
          continue;
        }
        cmd.category = category;
        if (category === 'ozel') cmd.ownerOnly = true;
        if (commands.has(cmd.data.name)) throw new Error(`Aynı isimde iki komut var: ${cmd.data.name}`);
        commands.set(cmd.data.name, cmd);
      }
    }
  }
  return commands;
}

module.exports = { loadCommands, CATEGORIES };
