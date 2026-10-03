// Üye giriş/çıkış: karşılama, veda, otorol ve üye logları.
const { Events, AuditLogEvent } = require('discord.js');
const db = require('../lib/db');
const { base, files, urls } = require('../lib/embeds');
const { buildWelcome, buildGoodbye } = require('../lib/welcome');
const { sendLog } = require('../lib/logger');
const { fillTemplate, ts, formatDuration } = require('../lib/util');
const { colors } = require('../config');

async function fetchAudit(guild, type, targetId) {
  const logs = await guild.fetchAuditLogs({ type, limit: 5 }).catch(() => null);
  const entry = logs?.entries.find((e) => e.target?.id === targetId && Date.now() - e.createdTimestamp < 10000);
  return entry || null;
}

module.exports = [
  {
    name: Events.GuildMemberAdd,
    async execute(member) {
      const g = db.guild(member.guild.id);

      // Otorol
      const roleIds = member.user.bot ? g.autorole.bot : g.autorole.human;
      const roles = roleIds.filter((id) => member.guild.roles.cache.get(id)?.editable);
      if (roles.length) await member.roles.add(roles, 'Otorol').catch((err) => console.warn('[otorol]', err.message));

      // Karşılama
      if (g.welcome.enabled && g.welcome.channel) {
        const channel = member.guild.channels.cache.get(g.welcome.channel);
        if (channel?.isTextBased()) await channel.send(await buildWelcome(member)).catch((err) => console.warn('[hoşgeldin]', err.message));
      }
      if (g.welcome.dm && !member.user.bot) {
        const text = fillTemplate(g.welcome.dmMessage, { member, guild: member.guild });
        await member.send({ embeds: [base().setDescription(text).setImage(urls.banner)], files: [files.banner()] }).catch(() => {});
      }

      // Log
      const age = Date.now() - member.user.createdTimestamp;
      const embed = base(colors.success)
        .setTitle('📥 Üye Katıldı')
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
          { name: 'Kullanıcı', value: `${member} \`${member.user.tag}\`\n\`${member.id}\`` },
          { name: 'Hesap Oluşturma', value: `${ts(member.user.createdTimestamp)} (${ts(member.user.createdTimestamp, 'R')})`, inline: true },
          { name: 'Üye Sayısı', value: String(member.guild.memberCount), inline: true },
        );
      if (age < 7 * 864e5) embed.addFields({ name: '⚠️ Uyarı', value: `Yeni hesap! (${formatDuration(age)} önce açılmış)` });
      await sendLog(member.guild, 'uye', embed);
    },
  },
  {
    name: Events.GuildMemberRemove,
    async execute(member) {
      const g = db.guild(member.guild.id);
      if (g.goodbye.enabled && g.goodbye.channel) {
        const channel = member.guild.channels.cache.get(g.goodbye.channel);
        if (channel?.isTextBased()) await channel.send(buildGoodbye(member)).catch(() => {});
      }

      const kick = await fetchAudit(member.guild, AuditLogEvent.MemberKick, member.id);
      const roles = member.roles?.cache.filter((r) => r.id !== member.guild.id).map((r) => `${r}`).join(' ') || '—';
      const embed = base(colors.error)
        .setTitle(kick ? '👢 Üye Atıldı' : '📤 Üye Ayrıldı')
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
          { name: 'Kullanıcı', value: `${member.user} \`${member.user.tag}\`\n\`${member.id}\`` },
          { name: 'Katılma', value: member.joinedTimestamp ? ts(member.joinedTimestamp, 'R') : 'Bilinmiyor', inline: true },
          { name: 'Üye Sayısı', value: String(member.guild.memberCount), inline: true },
          { name: 'Roller', value: roles.slice(0, 1024) },
        );
      if (kick) embed.addFields({ name: 'Atan', value: `${kick.executor}`, inline: true }, { name: 'Sebep', value: kick.reason || 'Belirtilmedi', inline: true });
      await sendLog(member.guild, 'uye', embed);
    },
  },
  {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember) {
      if (oldMember.partial) return;
      const embeds = [];
      const who = { name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL() };

      if (oldMember.nickname !== newMember.nickname) {
        embeds.push(base(colors.info).setAuthor(who).setTitle('✏️ Takma Ad Değişti').addFields(
          { name: 'Kullanıcı', value: `${newMember}` },
          { name: 'Eski', value: oldMember.nickname || '*yok*', inline: true },
          { name: 'Yeni', value: newMember.nickname || '*yok*', inline: true },
        ));
      }
      const added = newMember.roles.cache.filter((r) => !oldMember.roles.cache.has(r.id));
      const removed = oldMember.roles.cache.filter((r) => !newMember.roles.cache.has(r.id));
      if (added.size || removed.size) {
        const e = base(colors.info).setAuthor(who).setTitle('🎭 Roller Güncellendi').addFields({ name: 'Kullanıcı', value: `${newMember}` });
        if (added.size) e.addFields({ name: '➕ Eklenen', value: added.map((r) => `${r}`).join(' ').slice(0, 1024), inline: true });
        if (removed.size) e.addFields({ name: '➖ Alınan', value: removed.map((r) => `${r}`).join(' ').slice(0, 1024), inline: true });
        embeds.push(e);
      }
      const oldTo = oldMember.communicationDisabledUntilTimestamp || 0;
      const newTo = newMember.communicationDisabledUntilTimestamp || 0;
      if (oldTo !== newTo && newTo > Date.now()) {
        embeds.push(base(colors.warning).setAuthor(who).setTitle('🔇 Zaman Aşımı Verildi').addFields(
          { name: 'Kullanıcı', value: `${newMember}`, inline: true },
          { name: 'Bitiş', value: ts(newTo, 'R'), inline: true },
        ));
      }
      if (oldMember.avatar !== newMember.avatar) {
        embeds.push(base(colors.info).setAuthor(who).setTitle('🖼️ Sunucu Avatarı Değişti').setThumbnail(newMember.displayAvatarURL()).addFields({ name: 'Kullanıcı', value: `${newMember}` }));
      }
      for (const e of embeds) await sendLog(newMember.guild, 'uye', e);
    },
  },
];
