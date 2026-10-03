// Sürekli kanal oyunları: sayma ve kelime zinciri. messageCreate içinden çağrılır.
const db = require('./db');
const economy = require('./economy');

const lower = (s) => s.toLocaleLowerCase('tr');
const WORD_RE = /^[a-zçğıöşüâîû]{2,30}$/;

async function temp(message, text) {
  const m = await message.reply({ content: text, allowedMentions: { repliedUser: false } }).catch(() => null);
  if (m) setTimeout(() => m.delete().catch(() => {}), 6000);
}

async function counting(message, cfg) {
  const text = message.content.trim();
  if (!/^\d+$/.test(text)) return; // sayı olmayan mesajlar sohbet sayılır
  const n = Number(text);
  const expected = cfg.current + 1;
  if (message.author.id === cfg.lastUser) {
    cfg.current = 0; cfg.lastUser = null; db.save();
    await message.react('❌').catch(() => {});
    return message.reply(`🚫 ${message.author} üst üste iki kez sayamazsın! Sayaç sıfırlandı. Sıradaki sayı: **1** • Rekor: **${cfg.record}**`).catch(() => {});
  }
  if (n !== expected) {
    const reached = cfg.current;
    cfg.current = 0; cfg.lastUser = null; db.save();
    await message.react('❌').catch(() => {});
    return message.reply(`💥 ${message.author} **${expected}** yazmalıydın! **${reached}**'e kadar gelmiştik. Sayaç sıfırlandı, sıradaki: **1** • Rekor: **${cfg.record}**`).catch(() => {});
  }
  cfg.current = n; cfg.lastUser = message.author.id;
  const newRecord = n > cfg.record;
  if (newRecord) cfg.record = n;
  db.save();
  economy.add(message.guild.id, message.author.id, 1);
  await message.react(newRecord && n > 10 ? '🏆' : '✅').catch(() => {});
  if (n % 100 === 0) await message.channel.send(`🎉 **${n}**'e ulaştık! Böyle devam! 🥐`).catch(() => {});
}

// Kelime "ğ" ile biterse (Türkçede ğ ile başlayan kelime yok) bir önceki harf kullanılır
function requiredLetter(word) {
  const letters = [...word];
  let last = letters.pop();
  while (last === 'ğ' && letters.length) last = letters.pop();
  return last;
}

async function wordChain(message, cfg) {
  const word = lower(message.content.trim());
  if (!WORD_RE.test(word)) return; // tek kelime değilse sohbet sayılır
  if (message.author.id === cfg.lastUser) {
    await message.react('❌').catch(() => {});
    return temp(message, '⏳ Üst üste iki kelime yazamazsın, başkasını bekle!');
  }
  if (cfg.lastWord) {
    const need = requiredLetter(cfg.lastWord);
    if (!word.startsWith(need)) {
      await message.react('❌').catch(() => {});
      return temp(message, `🔤 Kelime **${need.toLocaleUpperCase('tr')}** harfiyle başlamalı! (Önceki: **${cfg.lastWord}**)`);
    }
  }
  if (cfg.used.includes(word)) {
    await message.react('❌').catch(() => {});
    return temp(message, `🔁 **${word}** daha önce kullanıldı!`);
  }
  cfg.used.push(word);
  if (cfg.used.length > 3000) cfg.used.splice(0, cfg.used.length - 3000);
  cfg.lastWord = word; cfg.lastUser = message.author.id; cfg.count += 1;
  if (cfg.count > cfg.record) cfg.record = cfg.count;
  db.save();
  economy.add(message.guild.id, message.author.id, 1);
  await message.react('✅').catch(() => {});
  if (cfg.count % 50 === 0) await message.channel.send(`🔗 Zincir **${cfg.count}** kelimeye ulaştı! 🥐`).catch(() => {});
}

// Mesaj bir oyun kanalındaysa işler ve true döner
async function handle(message) {
  const cg = db.guild(message.guild.id).channelGames;
  if (cg.sayma.channelId === message.channel.id) { await counting(message, cg.sayma); return true; }
  if (cg.kelime.channelId === message.channel.id) { await wordChain(message, cg.kelime); return true; }
  return false;
}

module.exports = { handle, requiredLetter };
