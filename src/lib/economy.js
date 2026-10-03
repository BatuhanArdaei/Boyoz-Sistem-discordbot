// Boyoz ekonomisi: tüm oyunlar ve /boyoz komutu bu cüzdanları kullanır.
const db = require('./db');

function wallet(guildId, userId) {
  const eco = db.guild(guildId).economy;
  return (eco[userId] ??= { balance: 0, eaten: 0, lastDaily: 0, streak: 0, lastWork: 0, lastSpin: 0, wins: 0 });
}

// Bakiyeye ekler (negatif değer düşer), yeni bakiyeyi döner.
function add(guildId, userId, amount) {
  const w = wallet(guildId, userId);
  w.balance = Math.max(0, w.balance + amount);
  db.save();
  return w.balance;
}

// Oyun kazancı: bakiyeye ekler ve galibiyet sayar.
function reward(guildId, userId, amount) {
  const w = wallet(guildId, userId);
  w.wins = (w.wins || 0) + 1;
  return add(guildId, userId, amount);
}

// Bahis için bakiyeden düşer; yetmezse false döner.
function take(guildId, userId, amount) {
  const w = wallet(guildId, userId);
  if (w.balance < amount) return false;
  w.balance -= amount;
  db.save();
  return true;
}

const fmt = (n) => `**${Number(n).toLocaleString('tr-TR')}** 🥐`;

module.exports = { wallet, add, reward, take, fmt };
