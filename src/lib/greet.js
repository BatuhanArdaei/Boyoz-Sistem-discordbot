// Sunucu sahibi (.env.local'daki OWNER_IDS) bir kanala yazınca arada bir karşılar: her karşılamadan sonra 1-2 saat susar.
const config = require('../config');
const db = require('./db');
const { pick, randInt } = require('./util');

const GREETINGS = [
  '👑 Hoş geldin sahibim!',
  '👑 Hoş geldin sahibim! Sunucu emin ellerde. 🥐',
  '👑 Sahibim geldi! Herkes hazır olsun. 🫡',
  '👑 Hoş geldin sahibim, boyozlar fırından yeni çıktı! 🥐',
  '👑 Hoş geldin sahibim! Bir emrin var mı? 😎',
];

async function handle(message) {
  if (!config.ownerIds.includes(message.author.id)) return;
  const meta = db.data.meta;
  meta.ownerGreet ??= {};
  if (Date.now() < (meta.ownerGreet[message.author.id] || 0)) return;
  meta.ownerGreet[message.author.id] = Date.now() + randInt(60, 120) * 60000; // sonraki karşılama 1-2 saat sonra
  db.save();
  await message.reply({ content: pick(GREETINGS), allowedMentions: { repliedUser: false } }).catch(() => {});
}

module.exports = { handle };
