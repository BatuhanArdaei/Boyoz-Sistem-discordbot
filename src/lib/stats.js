// Ses ve mesaj istatistikleri + ses XP'si / ses boyozu.
// Ses süresi dakikalık "tik"lerle eklenir; böylece bot yeniden başlasa bile en fazla 1 dakika kaybolur.
const db = require('./db');
const economy = require('./economy');
const levels = require('./levels');
const { utcOffsetMinutes } = require('../config');

const TICK = 60 * 1000;
const KEEP_DAYS = 35;
const VOICE_BOYOZ_EVERY = 10; // her 10 uygun dakikada 1 boyoz
const sessions = new Map(); // `${guildId}:${userId}` -> { channelId, last }

const dayKey = (ts = Date.now()) => new Date(ts + utcOffsetMinutes * 60000).toISOString().slice(0, 10);

function user(guildId, userId) {
  const users = db.guild(guildId).stats.users;
  return (users[userId] ??= { msg: 0, voice: 0, stream: 0, days: {}, vch: {}, mch: {}, earnMin: 0 });
}

function prune(u) {
  const keys = Object.keys(u.days);
  if (keys.length <= KEEP_DAYS) return;
  for (const k of keys.sort().slice(0, keys.length - KEEP_DAYS)) delete u.days[k];
}

function onMessage(message) {
  const u = user(message.guild.id, message.author.id);
  const d = (u.days[dayKey()] ??= { m: 0, v: 0 });
  u.msg += 1; d.m += 1;
  u.mch[message.channel.id] = (u.mch[message.channel.id] || 0) + 1;
  prune(u);
  db.save();
}

// Ses kanalına girme / çıkma / değiştirme
function onVoice(oldState, newState) {
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;
  const key = `${member.guild.id}:${member.id}`;
  if (oldState.channelId) flush(member.guild, member.id, sessions.get(key));
  if (newState.channelId) sessions.set(key, { channelId: newState.channelId, last: Date.now() });
  else sessions.delete(key);
}

// Son tikten bu yana geçen süreyi istatistiğe yazar
function flush(guild, userId, s) {
  if (!s) return 0;
  const now = Date.now();
  const ms = now - s.last;
  s.last = now;
  if (ms <= 0) return 0;
  const u = user(guild.id, userId);
  const d = (u.days[dayKey()] ??= { m: 0, v: 0 });
  u.voice += ms; d.v += ms;
  u.vch[s.channelId] = (u.vch[s.channelId] || 0) + ms;
  const vs = guild.members.cache.get(userId)?.voice;
  if (vs?.streaming) u.stream += ms;
  prune(u);
  return ms;
}

// Ödül için uygun mu? (sağır değil, AFK kanalında değil, kanalda en az bir insan daha var)
function eligible(guild, member) {
  const vs = member.voice;
  if (!vs?.channel || vs.selfDeaf || vs.serverDeaf) return false;
  if (guild.afkChannelId && vs.channelId === guild.afkChannelId) return false;
  return vs.channel.members.filter((m) => !m.user.bot).size >= 2;
}

async function tick(client) {
  for (const [key, s] of sessions) {
    const [guildId, userId] = key.split(':');
    const guild = client.guilds.cache.get(guildId);
    const member = guild?.members.cache.get(userId);
    if (!guild || !member?.voice.channelId) { sessions.delete(key); continue; }
    s.channelId = member.voice.channelId;
    const ms = flush(guild, userId, s);
    if (ms < 30000 || !eligible(guild, member)) continue;
    const u = user(guildId, userId);
    u.earnMin += 1;
    if (u.earnMin % VOICE_BOYOZ_EVERY === 0) economy.add(guildId, userId, 1);
    if (db.guild(guildId).levels.voiceXp) await levels.grantXp(guild, member, 5).catch(() => {});
  }
  db.save();
}

function start(client) {
  // Bot açıldığında zaten seste olanları başlat
  for (const guild of client.guilds.cache.values()) {
    for (const vs of guild.voiceStates.cache.values()) {
      if (vs.channelId && !vs.member?.user.bot) sessions.set(`${guild.id}:${vs.id}`, { channelId: vs.channelId, last: Date.now() });
    }
  }
  setInterval(() => tick(client).catch((e) => console.error('[istatistik]', e)), TICK);
}

// Belirli dönem için toplam: 'bugun' | 'hafta' (son 7 gün) | 'ay' (son 30 gün) | 'toplam'
function period(u, p) {
  if (p === 'toplam') return { m: u.msg, v: u.voice };
  const days = p === 'bugun' ? 1 : p === 'hafta' ? 7 : 30;
  let m = 0; let v = 0;
  for (let i = 0; i < days; i++) {
    const d = u.days[dayKey(Date.now() - i * 864e5)];
    if (d) { m += d.m; v += d.v; }
  }
  return { m, v };
}

// Canlı oturumu da hesaba katarak kullanıcının verisini döner
function snapshot(guild, userId) {
  const s = sessions.get(`${guild.id}:${userId}`);
  if (s) flush(guild, userId, s);
  return user(guild.id, userId);
}

const fmtVoice = (ms) => {
  const h = Math.floor(ms / 36e5); const m = Math.floor((ms % 36e5) / 6e4);
  return h ? `${h} sa ${m} dk` : `${m} dk`;
};

module.exports = { onMessage, onVoice, start, period, snapshot, user, fmtVoice, dayKey, sessions };
