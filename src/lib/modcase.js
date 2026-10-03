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
  return { caseId: c.id, total: g.warnings[userId].length };
}

module.exports = { createCase, caseEmbed, notifyUser, addWarning, TYPES };
