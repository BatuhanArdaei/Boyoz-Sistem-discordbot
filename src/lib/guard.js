// Guard (koruma): beyaz listede olmayan birinin toplu kanal/rol silme, sağ tık ban/kick, webhook ve bot ekleme
// hareketlerini yakalar; yapanı cezalandırır ve silinenleri geri oluşturur.
const { AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const db = require('./db');
const config = require('../config');
const { isOwner } = require('./util');
const { base } = require('./embeds');
const { sendLog } = require('./logger');
const { createCase } = require('./modcase');

const actions = new Map(); // `${guildId}:${userId}` -> [zaman]
const DANGEROUS = [PermissionFlagsBits.Administrator, PermissionFlagsBits.BanMembers, PermissionFlagsBits.KickMembers, PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageWebhooks];

function trusted(guild, userId) {
  const g = db.guild(guild.id).guard;
  return userId === guild.ownerId || userId === guild.client.user.id || isOwner(userId) || g.whitelist.includes(userId);
}

async function executor(guild, type, targetId) {
  const logs = await guild.fetchAuditLogs({ type, limit: 5 }).catch(() => null);
  return logs?.entries.find((e) => (!targetId || e.target?.id === targetId || e.targetId === targetId) && Date.now() - e.createdTimestamp < 15000)?.executor || null;
}

async function alert(guild, text) {
  const g = db.guild(guild.id).guard;
  const embed = base(0xed4245).setTitle('🛡️ Guard Uyarısı').setDescription(text);
  const ch = g.logChannelId && guild.channels.cache.get(g.logChannelId);
  if (ch) await ch.send({ embeds: [embed] }).catch(() => {});
  else await sendLog(guild, 'moderasyon', embed);
  // Sahiplere DM
  for (const id of new Set([guild.ownerId, ...config.ownerIds])) {
    const u = await guild.client.users.fetch(id).catch(() => null);
    await u?.send({ embeds: [embed.setFooter({ text: guild.name })] }).catch(() => {});
  }
}

// Yapanı cezalandırır: rollerini alır veya banlar
async function punish(guild, userId, reason) {
  const g = db.guild(guild.id).guard;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;
  if (member.user.bot && member.id !== guild.client.user.id && member.bannable) {
    await member.ban({ reason: `Guard: ${reason}` }).catch(() => {});
  } else if (g.punish === 'ban' && member.bannable) {
    await member.ban({ reason: `Guard: ${reason}` }).catch(() => {});
  } else {
    const roles = member.roles.cache.filter((r) => r.id !== guild.id && r.editable && !r.managed);
    await member.roles.remove(roles, `Guard: ${reason}`).catch(() => {});
  }
  await createCase(guild, { type: 'guard', targetId: userId, modId: guild.client.user.id, reason });
  await alert(guild, `<@${userId}> (\`${userId}\`) cezalandırıldı (**${g.punish === 'ban' ? 'yasaklandı' : 'rolleri alındı'}**).\n**Sebep:** ${reason}`);
}

// Bir hareketi sayar; limit aşılırsa true döner
function hit(guild, userId) {
  const g = db.guild(guild.id).guard;
  const key = `${guild.id}:${userId}`;
  const now = Date.now();
  const list = (actions.get(key) || []).filter((t) => now - t < g.windowSec * 1000);
  list.push(now);
  actions.set(key, list);
  return list.length >= g.limit;
}

async function check(guild, auditType, targetId, label, { instant = false } = {}) {
  const g = db.guild(guild.id).guard;
  if (!g.enabled) return null;
  const ex = await executor(guild, auditType, targetId);
  if (!ex || trusted(guild, ex.id)) return null;
  if (instant || hit(guild, ex.id)) {
    actions.delete(`${guild.id}:${ex.id}`);
    await punish(guild, ex.id, label);
  } else {
    await alert(guild, `⚠️ <@${ex.id}> şüpheli işlem: **${label}** (${g.limit} tekrar olursa ceza)`);
  }
  return ex;
}

// ---------------------------------------------------------------- olaylar
async function onChannelDelete(channel) {
  if (!channel.guild) return;
  const ex = await check(channel.guild, AuditLogEvent.ChannelDelete, channel.id, `Kanal silme (#${channel.name})`);
  if (!ex) return;
  // Kanalı aynı ayarlarla geri oluştur
  await channel.guild.channels.create({
    name: channel.name, type: channel.type, parent: channel.parentId, position: channel.rawPosition, topic: channel.topic, nsfw: channel.nsfw,
    bitrate: channel.bitrate, userLimit: channel.userLimit, rateLimitPerUser: channel.rateLimitPerUser,
    permissionOverwrites: channel.permissionOverwrites?.cache.map((o) => ({ id: o.id, allow: o.allow, deny: o.deny, type: o.type })),
  }).then((c) => alert(channel.guild, `♻️ Silinen kanal geri oluşturuldu: ${c}`)).catch(() => {});
}

async function onRoleDelete(role) {
  const ex = await check(role.guild, AuditLogEvent.RoleDelete, role.id, `Rol silme (@${role.name})`);
  if (!ex) return;
  await role.guild.roles.create({ name: role.name, color: role.color, hoist: role.hoist, permissions: role.permissions, mentionable: role.mentionable, reason: 'Guard: silinen rol geri oluşturuldu' })
    .then((r) => alert(role.guild, `♻️ Silinen rol geri oluşturuldu: ${r} (üyelere tekrar verilmesi gerekebilir)`)).catch(() => {});
}

async function onBan(ban) {
  const ex = await check(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id, `Sağ tık ban (${ban.user.tag})`);
  if (ex) await ban.guild.members.unban(ban.user.id, 'Guard: izinsiz ban geri alındı').catch(() => {});
}

async function onKick(member) {
  await check(member.guild, AuditLogEvent.MemberKick, member.id, `Sağ tık kick (${member.user.tag})`);
}

async function onBotAdd(member) {
  if (!member.user.bot) return;
  const g = db.guild(member.guild.id).guard;
  if (!g.enabled) return;
  const ex = await executor(member.guild, AuditLogEvent.BotAdd, member.id);
  if (!ex || trusted(member.guild, ex.id)) return;
  await member.kick('Guard: izinsiz bot ekleme').catch(() => {});
  await punish(member.guild, ex.id, `İzinsiz bot ekleme (${member.user.tag})`);
}

async function onWebhooks(channel) {
  if (!channel.guild) return;
  const g = db.guild(channel.guild.id).guard;
  if (!g.enabled) return;
  const ex = await executor(channel.guild, AuditLogEvent.WebhookCreate);
  if (!ex || trusted(channel.guild, ex.id)) return;
  const hooks = await channel.fetchWebhooks().catch(() => null);
  for (const h of hooks?.values() || []) if (h.owner?.id === ex.id && Date.now() - h.createdTimestamp < 30000) await h.delete('Guard: izinsiz webhook').catch(() => {});
  await punish(channel.guild, ex.id, 'İzinsiz webhook oluşturma');
}

// Bir role tehlikeli yetki verilirse geri alır
async function onRoleUpdate(oldRole, newRole) {
  const g = db.guild(newRole.guild.id).guard;
  if (!g.enabled) return;
  const added = DANGEROUS.filter((p) => !oldRole.permissions.has(p) && newRole.permissions.has(p));
  if (!added.length) return;
  const ex = await executor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
  if (!ex || trusted(newRole.guild, ex.id)) return;
  await newRole.setPermissions(oldRole.permissions, 'Guard: tehlikeli yetki geri alındı').catch(() => {});
  await punish(newRole.guild, ex.id, `@${newRole.name} rolüne tehlikeli yetki verme`);
}

// Sunucu adı / ikon / özel URL değişirse geri al
async function onGuildUpdate(oldGuild, newGuild) {
  const g = db.guild(newGuild.id).guard;
  if (!g.enabled) return;
  if (oldGuild.name === newGuild.name && oldGuild.vanityURLCode === newGuild.vanityURLCode && oldGuild.icon === newGuild.icon) return;
  const ex = await executor(newGuild, AuditLogEvent.GuildUpdate);
  if (!ex || trusted(newGuild, ex.id)) return;
  if (oldGuild.name !== newGuild.name) await newGuild.setName(oldGuild.name, 'Guard').catch(() => {});
  if (oldGuild.icon !== newGuild.icon && oldGuild.iconURL()) await newGuild.setIcon(oldGuild.iconURL({ size: 1024 }), 'Guard').catch(() => {});
  if (oldGuild.vanityURLCode && oldGuild.vanityURLCode !== newGuild.vanityURLCode) {
    await newGuild.client.rest.patch(`/guilds/${newGuild.id}/vanity-url`, { body: { code: oldGuild.vanityURLCode }, reason: 'Guard: URL koruma' }).catch(() => {});
  }
  await punish(newGuild, ex.id, 'İzinsiz sunucu ayarı değişikliği (isim/ikon/URL)');
}

module.exports = { onChannelDelete, onRoleDelete, onBan, onKick, onBotAdd, onWebhooks, onRoleUpdate, onGuildUpdate, trusted };
