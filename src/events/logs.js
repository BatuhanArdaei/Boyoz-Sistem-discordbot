// Mesaj, ses, ban ve sunucu (kanal/rol) logları.
const { Events, AuditLogEvent, ChannelType, AttachmentBuilder } = require('discord.js');
const { base } = require('../lib/embeds');
const { sendLog } = require('../lib/logger');
const { truncate, ts } = require('../lib/util');
const { colors } = require('../config');

const CHANNEL_TYPES = {
  [ChannelType.GuildText]: 'Metin', [ChannelType.GuildVoice]: 'Ses', [ChannelType.GuildCategory]: 'Kategori',
  [ChannelType.GuildAnnouncement]: 'Duyuru', [ChannelType.GuildStageVoice]: 'Sahne', [ChannelType.GuildForum]: 'Forum',
};

async function executorOf(guild, type, targetId) {
  const logs = await guild.fetchAuditLogs({ type, limit: 5 }).catch(() => null);
  const entry = logs?.entries.find((e) => (!targetId || e.target?.id === targetId) && Date.now() - e.createdTimestamp < 10000);
  return entry?.executor || null;
}

module.exports = [
  // ---------------- Mesaj ----------------
  {
    name: Events.MessageDelete,
    async execute(message) {
      require('../lib/snipe').add(message);
      if (!message.guild || message.author?.bot) return;
      const embed = base(colors.error).setTitle('🗑️ Mesaj Silindi').addFields(
        { name: 'Kanal', value: `${message.channel}`, inline: true },
        { name: 'Yazar', value: message.author ? `${message.author} \`${message.author.tag}\`` : 'Bilinmiyor (önbellekte yok)', inline: true },
        { name: 'İçerik', value: truncate(message.content, 1024) || (message.partial ? '*önbellekte yok*' : '*boş*') },
      );
      if (message.attachments?.size) embed.addFields({ name: 'Ekler', value: message.attachments.map((a) => a.name).join(', ').slice(0, 1024) });
      if (message.author) embed.setThumbnail(message.author.displayAvatarURL());
      embed.addFields({ name: 'Mesaj ID', value: `\`${message.id}\`` });
      await sendLog(message.guild, 'mesaj', embed);
    },
  },
  {
    name: Events.MessageUpdate,
    async execute(oldMsg, newMsg) {
      if (!newMsg.guild || newMsg.author?.bot || oldMsg.content === newMsg.content || oldMsg.partial) return;
      const embed = base(colors.warning).setTitle('✏️ Mesaj Düzenlendi')
        .setDescription(`[Mesaja git](${newMsg.url})`)
        .setThumbnail(newMsg.author.displayAvatarURL())
        .addFields(
          { name: 'Kanal', value: `${newMsg.channel}`, inline: true },
          { name: 'Yazar', value: `${newMsg.author} \`${newMsg.author.tag}\``, inline: true },
          { name: 'Eski', value: truncate(oldMsg.content, 1024) || '*boş*' },
          { name: 'Yeni', value: truncate(newMsg.content, 1024) || '*boş*' },
        );
      await sendLog(newMsg.guild, 'mesaj', embed);
    },
  },
  {
    name: Events.MessageBulkDelete,
    async execute(messages, channel) {
      if (!channel.guild) return;
      const lines = [...messages.values()].reverse()
        .map((m) => `[${new Date(m.createdTimestamp).toLocaleString('tr-TR')}] ${m.author?.tag || 'bilinmiyor'}: ${m.content || '(içerik yok)'}`);
      const file = new AttachmentBuilder(Buffer.from(lines.join('\n'), 'utf8'), { name: `silinen-mesajlar-${channel.name}.txt` });
      const embed = base(colors.error).setTitle('🧹 Toplu Mesaj Silindi').addFields(
        { name: 'Kanal', value: `${channel}`, inline: true },
        { name: 'Adet', value: String(messages.size), inline: true },
      );
      await sendLog(channel.guild, 'mesaj', { embeds: [embed], files: [file] });
    },
  },

  // ---------------- Ses ----------------
  {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
      const member = newState.member || oldState.member;
      if (!member || member.user.bot) return;
      const who = { name: member.user.tag, iconURL: member.user.displayAvatarURL() };
      let embed = null;
      if (!oldState.channelId && newState.channelId) {
        embed = base(colors.success).setAuthor(who).setDescription(`🔊 ${member} **${newState.channel}** ses kanalına katıldı.`);
      } else if (oldState.channelId && !newState.channelId) {
        embed = base(colors.error).setAuthor(who).setDescription(`🔇 ${member} **${oldState.channel}** ses kanalından ayrıldı.`);
      } else if (oldState.channelId !== newState.channelId) {
        embed = base(colors.info).setAuthor(who).setDescription(`🔁 ${member} **${oldState.channel}** → **${newState.channel}** kanalına geçti.`);
      } else if (oldState.serverMute !== newState.serverMute || oldState.serverDeaf !== newState.serverDeaf) {
        const parts = [];
        if (oldState.serverMute !== newState.serverMute) parts.push(newState.serverMute ? 'sunucu tarafından susturuldu' : 'susturması kaldırıldı');
        if (oldState.serverDeaf !== newState.serverDeaf) parts.push(newState.serverDeaf ? 'sağırlaştırıldı' : 'sağırlaştırması kaldırıldı');
        embed = base(colors.warning).setAuthor(who).setDescription(`🎙️ ${member} ${parts.join(', ')}.`);
      }
      if (embed) await sendLog(newState.guild, 'ses', embed);
    },
  },

  // ---------------- Ban (komut dışı yapılanlar dahil) ----------------
  {
    name: Events.GuildBanAdd,
    async execute(ban) {
      const executor = await executorOf(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
      if (executor?.id === ban.client.user.id) return; // bot yaptıysa vaka zaten loglandı
      await sendLog(ban.guild, 'moderasyon', base(colors.error).setTitle('🔨 Üye Yasaklandı (manuel)')
        .setThumbnail(ban.user.displayAvatarURL())
        .addFields(
          { name: 'Kullanıcı', value: `${ban.user} \`${ban.user.tag}\`` },
          { name: 'Yasaklayan', value: executor ? `${executor}` : 'Bilinmiyor', inline: true },
          { name: 'Sebep', value: ban.reason || 'Belirtilmedi', inline: true },
        ));
    },
  },
  {
    name: Events.GuildBanRemove,
    async execute(ban) {
      const executor = await executorOf(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
      if (executor?.id === ban.client.user.id) return;
      await sendLog(ban.guild, 'moderasyon', base(colors.success).setTitle('🔓 Yasak Kaldırıldı (manuel)')
        .addFields(
          { name: 'Kullanıcı', value: `${ban.user} \`${ban.user.tag}\`` },
          { name: 'Kaldıran', value: executor ? `${executor}` : 'Bilinmiyor', inline: true },
        ));
    },
  },

  // ---------------- Sunucu: kanal ----------------
  {
    name: Events.ChannelCreate,
    async execute(channel) {
      if (!channel.guild) return;
      const executor = await executorOf(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
      await sendLog(channel.guild, 'sunucu', base(colors.success).setTitle('📁 Kanal Oluşturuldu').addFields(
        { name: 'Kanal', value: `${channel} \`${channel.name}\``, inline: true },
        { name: 'Tür', value: CHANNEL_TYPES[channel.type] || 'Diğer', inline: true },
        { name: 'Oluşturan', value: executor ? `${executor}` : 'Bilinmiyor', inline: true },
      ));
    },
  },
  {
    name: Events.ChannelDelete,
    async execute(channel) {
      if (!channel.guild) return;
      const executor = await executorOf(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
      await sendLog(channel.guild, 'sunucu', base(colors.error).setTitle('🗑️ Kanal Silindi').addFields(
        { name: 'Kanal', value: `\`#${channel.name}\``, inline: true },
        { name: 'Tür', value: CHANNEL_TYPES[channel.type] || 'Diğer', inline: true },
        { name: 'Silen', value: executor ? `${executor}` : 'Bilinmiyor', inline: true },
      ));
    },
  },
  {
    name: Events.ChannelUpdate,
    async execute(oldCh, newCh) {
      if (!newCh.guild) return;
      const changes = [];
      if (oldCh.name !== newCh.name) changes.push(`**İsim:** \`${oldCh.name}\` → \`${newCh.name}\``);
      if (oldCh.topic !== newCh.topic) changes.push(`**Konu:** ${truncate(oldCh.topic, 300) || '*yok*'} → ${truncate(newCh.topic, 300) || '*yok*'}`);
      if (oldCh.rateLimitPerUser !== newCh.rateLimitPerUser) changes.push(`**Yavaş mod:** ${oldCh.rateLimitPerUser || 0}sn → ${newCh.rateLimitPerUser || 0}sn`);
      if (oldCh.nsfw !== newCh.nsfw) changes.push(`**NSFW:** ${newCh.nsfw ? 'açıldı' : 'kapandı'}`);
      if (oldCh.parentId !== newCh.parentId) changes.push(`**Kategori:** ${oldCh.parent?.name || '*yok*'} → ${newCh.parent?.name || '*yok*'}`);
      if (!changes.length) return;
      await sendLog(newCh.guild, 'sunucu', base(colors.info).setTitle('🛠️ Kanal Güncellendi')
        .setDescription(`${newCh}\n\n${changes.join('\n')}`));
    },
  },

  // ---------------- Sunucu: rol ----------------
  {
    name: Events.GuildRoleCreate,
    async execute(role) {
      const executor = await executorOf(role.guild, AuditLogEvent.RoleCreate, role.id);
      await sendLog(role.guild, 'sunucu', base(colors.success).setTitle('🎭 Rol Oluşturuldu').addFields(
        { name: 'Rol', value: `${role} \`${role.name}\``, inline: true },
        { name: 'Oluşturan', value: executor ? `${executor}` : 'Bilinmiyor', inline: true },
      ));
    },
  },
  {
    name: Events.GuildRoleDelete,
    async execute(role) {
      const executor = await executorOf(role.guild, AuditLogEvent.RoleDelete, role.id);
      await sendLog(role.guild, 'sunucu', base(colors.error).setTitle('🎭 Rol Silindi').addFields(
        { name: 'Rol', value: `\`${role.name}\``, inline: true },
        { name: 'Silen', value: executor ? `${executor}` : 'Bilinmiyor', inline: true },
      ));
    },
  },
  {
    name: Events.GuildRoleUpdate,
    async execute(oldRole, newRole) {
      const changes = [];
      if (oldRole.name !== newRole.name) changes.push(`**İsim:** \`${oldRole.name}\` → \`${newRole.name}\``);
      if (oldRole.color !== newRole.color) changes.push(`**Renk:** \`${oldRole.hexColor}\` → \`${newRole.hexColor}\``);
      if (oldRole.hoist !== newRole.hoist) changes.push(`**Ayrı göster:** ${newRole.hoist ? 'açık' : 'kapalı'}`);
      if (oldRole.mentionable !== newRole.mentionable) changes.push(`**Etiketlenebilir:** ${newRole.mentionable ? 'evet' : 'hayır'}`);
      if (!oldRole.permissions.equals(newRole.permissions)) {
        const added = newRole.permissions.missing(oldRole.permissions);
        const removed = oldRole.permissions.missing(newRole.permissions);
        if (added.length) changes.push(`**➕ Eklenen izinler:** ${added.join(', ')}`);
        if (removed.length) changes.push(`**➖ Alınan izinler:** ${removed.join(', ')}`);
      }
      if (!changes.length) return;
      const executor = await executorOf(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
      await sendLog(newRole.guild, 'sunucu', base(colors.info).setTitle('🎭 Rol Güncellendi')
        .setDescription(`${newRole}\n\n${changes.join('\n')}`.slice(0, 4000))
        .addFields({ name: 'Düzenleyen', value: executor ? `${executor}` : 'Bilinmiyor' }));
    },
  },

  // ---------------- Sunucu: genel ----------------
  {
    name: Events.GuildUpdate,
    async execute(oldGuild, newGuild) {
      const changes = [];
      if (oldGuild.name !== newGuild.name) changes.push(`**İsim:** \`${oldGuild.name}\` → \`${newGuild.name}\``);
      if (oldGuild.icon !== newGuild.icon) changes.push('**Sunucu ikonu** değişti');
      if (oldGuild.banner !== newGuild.banner) changes.push('**Sunucu bannerı** değişti');
      if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) changes.push(`**Özel URL:** ${oldGuild.vanityURLCode || '*yok*'} → ${newGuild.vanityURLCode || '*yok*'}`);
      if (!changes.length) return;
      await sendLog(newGuild, 'sunucu', base(colors.info).setTitle('🏠 Sunucu Güncellendi').setDescription(changes.join('\n')).setThumbnail(newGuild.iconURL()));
    },
  },
  {
    name: Events.InviteCreate,
    async execute(invite) {
      if (!invite.guild) return;
      require('../lib/invites').onInviteCreate(invite);
      await sendLog(invite.guild, 'sunucu', base(colors.info).setTitle('🔗 Davet Oluşturuldu').addFields(
        { name: 'Kod', value: `\`${invite.code}\``, inline: true },
        { name: 'Kanal', value: `${invite.channel}`, inline: true },
        { name: 'Oluşturan', value: invite.inviter ? `${invite.inviter}` : 'Bilinmiyor', inline: true },
        { name: 'Süre', value: invite.expiresTimestamp ? ts(invite.expiresTimestamp, 'R') : 'Süresiz', inline: true },
        { name: 'Max Kullanım', value: invite.maxUses ? String(invite.maxUses) : 'Sınırsız', inline: true },
      ));
    },
  },
];
