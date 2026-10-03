// Mesaj başına XP ve seviye sistemi (MEE6 benzeri formül).
const db = require('./db');
const { fillTemplate, randInt } = require('./util');
const economy = require('./economy');

const COOLDOWN = 60000;

// L seviyesinden L+1'e geçmek için gereken XP
const xpForNext = (level) => 5 * level ** 2 + 50 * level + 100;

function levelFromXp(totalXp) {
  let level = 0;
  let remaining = totalXp;
  while (remaining >= xpForNext(level)) {
    remaining -= xpForNext(level);
    level += 1;
  }
  return { level, current: remaining, needed: xpForNext(level) };
}

function getUser(guildId, userId) {
  const users = db.guild(guildId).levels.users;
  return users[userId] || { xp: 0, level: 0, last: 0, messages: 0 };
}

function ranking(guildId) {
  return Object.entries(db.guild(guildId).levels.users)
    .map(([id, u]) => ({ id, ...u }))
    .sort((a, b) => b.xp - a.xp);
}

async function applyRewards(member, level, rewards) {
  const roles = rewards.filter((r) => r.level <= level).map((r) => r.roleId)
    .filter((id) => !member.roles.cache.has(id) && member.guild.roles.cache.get(id)?.editable);
  if (roles.length) await member.roles.add(roles, `Seviye ödülü (seviye ${level})`).catch(() => {});
}

// XP ekler; seviye atlanırsa rol ödülü + boyoz hediyesi verir ve duyurur. (Mesaj ve ses XP'si ortak kullanır.)
async function grantXp(guild, member, amount, fallbackChannel) {
  const cfg = db.guild(guild.id).levels;
  if (!cfg.enabled || !member) return;
  const user = (cfg.users[member.id] ??= { xp: 0, level: 0, last: 0, messages: 0 });
  user.xp += amount;
  const { level } = levelFromXp(user.xp);
  db.save();
  if (level <= user.level) return;
  user.level = level;
  db.save();

  await applyRewards(member, level, cfg.rewards);
  const gift = level * (cfg.boyozPerLevel ?? 25);
  if (gift > 0) economy.add(guild.id, member.id, gift);
  const channel = (cfg.channel && guild.channels.cache.get(cfg.channel)) || fallbackChannel;
  if (!channel?.isTextBased()) return;
  const text = fillTemplate(cfg.message, { member, user: member.user, guild, extra: { seviye: level } });
  await channel.send({ content: `${text}${gift > 0 ? ` 🎁 **+${gift.toLocaleString('tr-TR')} 🥐** hediye!` : ''}`, allowedMentions: { users: [member.id] } }).catch(() => {});
}

async function handle(message) {
  const cfg = db.guild(message.guild.id).levels;
  if (!cfg.enabled) return;
  const now = Date.now();
  const user = (cfg.users[message.author.id] ??= { xp: 0, level: 0, last: 0, messages: 0 });
  user.messages += 1;
  if (now - user.last < COOLDOWN) { db.save(); return; }
  user.last = now;
  await grantXp(message.guild, message.member, randInt(15, 25), message.channel);
}

module.exports = { handle, grantXp, levelFromXp, xpForNext, getUser, ranking, applyRewards };
