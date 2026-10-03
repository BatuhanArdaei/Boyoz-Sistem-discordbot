// Mesaj başına XP ve seviye sistemi (MEE6 benzeri formül).
const db = require('./db');
const { fillTemplate, randInt } = require('./util');

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

async function handle(message) {
  const cfg = db.guild(message.guild.id).levels;
  if (!cfg.enabled) return;
  const now = Date.now();
  const user = (cfg.users[message.author.id] ??= { xp: 0, level: 0, last: 0, messages: 0 });
  user.messages += 1;
  if (now - user.last < COOLDOWN) { db.save(); return; }
  user.last = now;
  user.xp += randInt(15, 25);
  const { level } = levelFromXp(user.xp);
  db.save();
  if (level <= user.level) return;
  user.level = level;
  db.save();

  if (message.member) await applyRewards(message.member, level, cfg.rewards);
  const channel = (cfg.channel && message.guild.channels.cache.get(cfg.channel)) || message.channel;
  const text = fillTemplate(cfg.message, { member: message.member, user: message.author, guild: message.guild, extra: { seviye: level } });
  await channel.send({ content: text, allowedMentions: { users: [message.author.id] } }).catch(() => {});
}

module.exports = { handle, levelFromXp, xpForNext, getUser, ranking, applyRewards };
