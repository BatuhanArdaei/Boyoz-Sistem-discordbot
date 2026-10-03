// Sunucu sahibi (.env.local OWNER_IDS): botu etiketleyince "Buyrun sahibim", herhangi bir yere yazınca 1-2 saatte bir "Hoş geldin sahibim".
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

const SUMMONS = [
  '👑 Buyrun sahibim!',
  '👑 Buyrun sahibim, emrinizdeyim!',
  '👑 Buyrun sahibim, ne emredersiniz? 🫡',
  '👑 Buyrun sahibim! 🥐',
];

async function handle(message) {
  if (!config.ownerIds.includes(message.author.id)) return;
  const meta = db.data.meta;
  meta.ownerGreet ??= {};

  // Sahip botu bizzat etiketlediyse (yanıtlardaki otomatik etiket sayılmaz) her seferinde cevap ver
  const botId = message.client.user.id;
  if (new RegExp(`<@!?${botId}>`).test(message.content)) {
    meta.ownerGreet[message.author.id] = Date.now() + randInt(60, 120) * 60000; // bu karşılama da sayılsın
    db.save();
    await message.reply({ content: pick(SUMMONS), allowedMentions: { repliedUser: false } }).catch(() => {});
    return;
  }

  if (Date.now() < (meta.ownerGreet[message.author.id] || 0)) return;
  meta.ownerGreet[message.author.id] = Date.now() + randInt(60, 120) * 60000; // sonraki karşılama 1-2 saat sonra
  db.save();
  await message.reply({ content: pick(GREETINGS), allowedMentions: { repliedUser: false } }).catch(() => {});
}

module.exports = { handle };
