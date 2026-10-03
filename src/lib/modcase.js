// Moderasyon vakaları: her işlem numaralı bir kayıt olarak saklanır ve moderasyon log kanalına düşer.
const db = require('./db');
const { base } = require('./embeds');
const { sendLog } = require('./logger');
const { formatDuration, ts } = require('./util');
const { colors } = require('../config');

const TYPES = {
  ban: { label: 'Yasaklama', emoji: '🔨', color: colors.error },
  tempban: { label: 'Süreli Yasaklama', emoji: '⏳', color: colors.error },
  unban: { label: 'Yasak Kaldırma', emoji: '🔓', color: colors.success },
  kick: { label: 'Atma', emoji: '👢', color: 0xe67e22 },
  timeout: { label: 'Susturma', emoji: '🔇', color: colors.warning },
  untimeout: { label: 'Susturma Kaldırma', emoji: '🔊', color: colors.success },
  warn: { label: 'Uyarı', emoji: '⚠️', color: colors.warning },
  unwarn: { label: 'Uyarı Silme', emoji: '🧽', color: colors.success },
  automod: { label: 'AutoMod', emoji: '🤖', color: 0x95a5a6 },
  purge: { label: 'Mesaj Temizleme', emoji: '🧹', color: colors.info },
  lock: { label: 'Kanal Kilitleme', emoji: '🔒', color: colors.warning },
  unlock: { label: 'Kanal Kilit Açma', emoji: '🔓', color: colors.success },
  jail: { label: 'Cezalı (Jail)', emoji: '⛓️', color: colors.error },
  unjail: { label: 'Cezalıdan Çıkarma', emoji: '🔓', color: colors.success },
  guard: { label: 'Koruma (Guard)', emoji: '🛡️', color: colors.error },
};

function caseEmbed(c) {
  const t = TYPES[c.type] || { label: c.type, emoji: '📝', color: colors.brand };
  const embed = base(t.color)
    .setTitle(`${t.emoji} ${t.label} • Vaka #${c.id}`)
    .addFields(
      { name: 'Hedef', value: c.targetId ? `<@${c.targetId}> (\`${c.targetId}\`)` : (c.target || '—'), inline: true },
      { name: 'Yetkili', value: `<@${c.modId}>`, inline: true },
      { name: 'Tarih', value: ts(c.at), inline: true },
      { name: 'Sebep', value: c.reason || 'Belirtilmedi' },
    );
  if (c.duration) embed.addFields({ name: 'Süre', value: formatDuration(c.duration), inline: true });
  if (c.extra) embed.addFields({ name: 'Detay', value: c.extra });
  return embed;
}

// Vaka oluşturur, kaydeder ve log kanalına gönderir.
async function createCase(guild, { type, targetId = null, target = null, modId, reason, duration = null, extra = null }) {
  const g = db.guild(guild.id);
  g.caseCount += 1;
  const c = { id: g.caseCount, type, targetId, target, modId, reason: reason || null, duration, extra, at: Date.now() };
  g.cases.push(c);
  if (g.cases.length > 2000) g.cases.splice(0, g.cases.length - 2000);
  db.save();
  await sendLog(guild, 'moderasyon', caseEmbed(c));
  return c;
}

// Kullanıcıya ceza bildirimi DM'i göndermeyi dener.
async function notifyUser(user, guild, type, reason, duration) {
  const t = TYPES[type];
  if (!t || !user) return false;
  const embed = base(t.color)
    .setTitle(`${t.emoji} ${guild.name} sunucusunda ${t.label.toLowerCase()} aldın`)
    .addFields({ name: 'Sebep', value: reason || 'Belirtilmedi' })
    .setThumbnail(guild.iconURL());
  if (duration) embed.addFields({ name: 'Süre', value: formatDuration(duration) });
  return user.send({ embeds: [embed] }).then(() => true).catch(() => false);
}

// Uyarı ekler (vaka numarası uyarı ID'si olarak kullanılır). Kullanıcının toplam uyarı sayısını döner.
async function addWarning(guild, userId, modId, reason) {
  const c = await createCase(guild, { type: 'warn', targetId: userId, modId, reason });
  const g = db.guild(guild.id);
  (g.warnings[userId] ??= []).push({ id: c.id, modId, reason: reason || null, at: c.at });
  db.save();
  const total = g.warnings[userId].length;
  await escalate(guild, userId, total).catch((err) => console.warn('[uyarı cezası]', err.message));
  return { caseId: c.id, total };
}

// /uyari-ceza kuralı varsa uyarı sayısına göre otomatik ceza uygular
async function escalate(guild, userId, total) {
  const rule = db.guild(guild.id).warnPunish.find((r) => r.count === total);
  if (!rule) return;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;
  const me = guild.members.me.id;
  const reason = `Otomatik: ${total}. uyarıya ulaştı`;
  if (rule.action === 'sustur' && member.moderatable) {
    await member.timeout(rule.ms, reason);
    await createCase(guild, { type: 'timeout', targetId: userId, modId: me, reason, duration: rule.ms });
  } else if (rule.action === 'at' && member.kickable) {
    await notifyUser(member.user, guild, 'kick', reason);
    await member.kick(reason);
    await createCase(guild, { type: 'kick', targetId: userId, modId: me, reason });
  } else if (rule.action === 'ban' && member.bannable) {
    await notifyUser(member.user, guild, 'ban', reason);
    await member.ban({ reason });
    await createCase(guild, { type: 'ban', targetId: userId, modId: me, reason });
  } else if (rule.action === 'jail') {
    const j = db.guild(guild.id).jail;
    if (!j.roleId || j.users[userId]) return;
    const saved = member.roles.cache.filter((r) => r.id !== guild.id && !r.managed && r.editable).map((r) => r.id);
    j.users[userId] = { roles: saved, until: rule.ms ? Date.now() + rule.ms : null, reason, by: me };
    db.save();
    await member.roles.remove(saved, reason).catch(() => {});
    await member.roles.add(j.roleId, reason).catch(() => {});
    await createCase(guild, { type: 'jail', targetId: userId, modId: me, reason, duration: rule.ms });
  }
}

module.exports = { createCase, caseEmbed, notifyUser, addWarning, TYPES };
