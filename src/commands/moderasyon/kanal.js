// Kanal ve üye yönetimi: temizle, yavaş mod, kilitle, rol, takma ad.
const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ChannelType, MessageFlags } = require('discord.js');
const { base, replyOk, replyFail, reply } = require('../../lib/embeds');
const { createCase } = require('../../lib/modcase');
const { checkHierarchy, parseDuration, formatDuration } = require('../../lib/util');
const { colors } = require('../../config');

const build = (name, desc, perm) => new SlashCommandBuilder()
  .setName(name).setDescription(desc)
  .setDefaultMemberPermissions(perm)
  .setContexts(InteractionContextType.Guild);

const TEXT_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice, ChannelType.GuildForum];

async function setLock(interaction, locked) {
  const channel = interaction.options.getChannel('kanal') || interaction.channel;
  const reason = interaction.options.getString('sebep');
  const everyone = interaction.guild.roles.everyone;
  await channel.permissionOverwrites.edit(everyone, {
    SendMessages: locked ? false : null,
    SendMessagesInThreads: locked ? false : null,
    CreatePublicThreads: locked ? false : null,
    AddReactions: locked ? false : null,
  }, { reason: `${interaction.user.tag}: ${reason || (locked ? 'Kanal kilitlendi' : 'Kilit açıldı')}` });
  await createCase(interaction.guild, { type: locked ? 'lock' : 'unlock', target: `${channel}`, modId: interaction.user.id, reason });
  const embed = base(locked ? colors.warning : colors.success)
    .setDescription(locked ? `🔒 Bu kanal kilitlendi.${reason ? `\n**Sebep:** ${reason}` : ''}` : '🔓 Kanalın kilidi açıldı, sohbete devam! 🥐');
  if (channel.id !== interaction.channel.id) {
    await channel.send({ embeds: [embed] }).catch(() => {});
    return replyOk(interaction, `${channel} ${locked ? 'kilitlendi' : 'kilidi açıldı'}.`);
  }
  return reply(interaction, embed, { ephemeral: false });
}

module.exports = [
  // ---------------------------------------------------------------- /temizle
  {
    data: build('temizle', '🧹 Kanaldaki mesajları toplu siler (14 günden yeni).', PermissionFlagsBits.ManageMessages)
      .addIntegerOption((o) => o.setName('miktar').setDescription('Silinecek mesaj sayısı (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
      .addUserOption((o) => o.setName('kullanici').setDescription('Sadece bu kullanıcının mesajları'))
      .addStringOption((o) => o.setName('filtre').setDescription('Ek filtre').addChoices(
        { name: 'Sadece botlar', value: 'bot' }, { name: 'Sadece insanlar', value: 'insan' },
        { name: 'Link içerenler', value: 'link' }, { name: 'Ek/görsel içerenler', value: 'ek' },
      )),
    async execute(interaction) {
      const amount = interaction.options.getInteger('miktar');
      const user = interaction.options.getUser('kullanici');
      const filter = interaction.options.getString('filtre');
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      let messages = await interaction.channel.messages.fetch({ limit: 100 });
      const twoWeeks = Date.now() - 14 * 864e5 + 60000;
      messages = messages.filter((m) => m.createdTimestamp > twoWeeks && !m.pinned);
      if (user) messages = messages.filter((m) => m.author.id === user.id);
      if (filter === 'bot') messages = messages.filter((m) => m.author.bot);
      if (filter === 'insan') messages = messages.filter((m) => !m.author.bot);
      if (filter === 'link') messages = messages.filter((m) => /https?:\/\//i.test(m.content));
      if (filter === 'ek') messages = messages.filter((m) => m.attachments.size > 0);
      const toDelete = [...messages.values()].slice(0, amount);
      if (!toDelete.length) return interaction.editReply('❌ Silinecek uygun mesaj bulunamadı (14 günden eski mesajlar silinemez).');

      const deleted = await interaction.channel.bulkDelete(toDelete, true);
      await createCase(interaction.guild, {
        type: 'purge', target: `${interaction.channel}`, modId: interaction.user.id,
        reason: `${deleted.size} mesaj silindi${user ? ` (${user.tag})` : ''}${filter ? ` [filtre: ${filter}]` : ''}`,
      });
      await interaction.editReply(`🧹 **${deleted.size}** mesaj silindi.`);
    },
  },

  // ---------------------------------------------------------------- /yavasmod
  {
    data: build('yavasmod', '🐢 Kanala yavaş mod ayarlar.', PermissionFlagsBits.ManageChannels)
      .addStringOption((o) => o.setName('sure').setDescription('Süre: 5s, 30s, 1m, 1h... (0 = kapat)').setRequired(true))
      .addChannelOption((o) => o.setName('kanal').setDescription('Kanal (varsayılan: bu kanal)').addChannelTypes(...TEXT_TYPES)),
    async execute(interaction) {
      const channel = interaction.options.getChannel('kanal') || interaction.channel;
      const raw = interaction.options.getString('sure');
      const ms = raw === '0' ? 0 : parseDuration(/^\d+$/.test(raw) ? `${raw}s` : raw);
      if (ms === null || ms > 6 * 36e5) return replyFail(interaction, 'Geçerli bir süre gir (0 - 6 saat). Örnek: `10s`, `1m`');
      await channel.setRateLimitPerUser(Math.floor(ms / 1000), `${interaction.user.tag} tarafından`);
      return replyOk(interaction, ms ? `${channel} için yavaş mod **${formatDuration(ms)}** olarak ayarlandı.` : `${channel} için yavaş mod kapatıldı.`, { ephemeral: false });
    },
  },

  // ---------------------------------------------------------------- /kilitle /kilit-ac
  {
    data: build('kilitle', '🔒 Kanalı herkese kapatır (mesaj yazılamaz).', PermissionFlagsBits.ManageChannels)
      .addChannelOption((o) => o.setName('kanal').setDescription('Kanal (varsayılan: bu kanal)').addChannelTypes(...TEXT_TYPES))
      .addStringOption((o) => o.setName('sebep').setDescription('Sebep').setMaxLength(300)),
    execute: (interaction) => setLock(interaction, true),
  },
  {
    data: build('kilit-ac', '🔓 Kilitli kanalı tekrar açar.', PermissionFlagsBits.ManageChannels)
      .addChannelOption((o) => o.setName('kanal').setDescription('Kanal (varsayılan: bu kanal)').addChannelTypes(...TEXT_TYPES))
      .addStringOption((o) => o.setName('sebep').setDescription('Sebep').setMaxLength(300)),
    execute: (interaction) => setLock(interaction, false),
  },

  // ---------------------------------------------------------------- /rol
  {
    data: build('rol', '🎭 Kullanıcıya rol verir veya alır.', PermissionFlagsBits.ManageRoles)
      .addSubcommand((s) => s.setName('ver').setDescription('Rol verir')
        .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
        .addRoleOption((o) => o.setName('rol').setDescription('Rol').setRequired(true)))
      .addSubcommand((s) => s.setName('al').setDescription('Rol alır')
        .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
        .addRoleOption((o) => o.setName('rol').setDescription('Rol').setRequired(true))),
    async execute(interaction) {
      const sub = interaction.options.getSubcommand();
      const member = interaction.options.getMember('kullanici');
      const role = interaction.options.getRole('rol');
      if (!member) return replyFail(interaction, 'Bu kullanıcı sunucuda değil.');
      if (role.managed || role.id === interaction.guild.id) return replyFail(interaction, 'Bu rol elle verilemez/alınamaz.');
      if (!role.editable) return replyFail(interaction, 'Bu rol benim en yüksek rolümden yukarıda.');
      if (interaction.user.id !== interaction.guild.ownerId && role.position >= interaction.member.roles.highest.position) {
        return replyFail(interaction, 'Bu rol senin en yüksek rolünden yukarıda veya eşit.');
      }
      if (sub === 'ver') {
        if (member.roles.cache.has(role.id)) return replyFail(interaction, 'Kullanıcıda bu rol zaten var.');
        await member.roles.add(role, `${interaction.user.tag} tarafından`);
        return replyOk(interaction, `${member} kullanıcısına ${role} rolü verildi.`, { ephemeral: false });
      }
      if (!member.roles.cache.has(role.id)) return replyFail(interaction, 'Kullanıcıda bu rol yok.');
      await member.roles.remove(role, `${interaction.user.tag} tarafından`);
      return replyOk(interaction, `${member} kullanıcısından ${role} rolü alındı.`, { ephemeral: false });
    },
  },

  // ---------------------------------------------------------------- /takmaad
  {
    data: build('takmaad', '✏️ Kullanıcının sunucu takma adını değiştirir.', PermissionFlagsBits.ManageNicknames)
      .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
      .addStringOption((o) => o.setName('isim').setDescription('Yeni takma ad (boş = sıfırla)').setMaxLength(32)),
    async execute(interaction) {
      const member = interaction.options.getMember('kullanici');
      const nick = interaction.options.getString('isim');
      if (!member) return replyFail(interaction, 'Bu kullanıcı sunucuda değil.');
      if (member.id !== interaction.user.id) {
        const err = checkHierarchy(interaction, member);
        if (err) return replyFail(interaction, err);
      }
      if (!member.manageable) return replyFail(interaction, 'Bu kullanıcının takma adını değiştiremiyorum.');
      await member.setNickname(nick || null, `${interaction.user.tag} tarafından`);
      return replyOk(interaction, nick ? `${member} takma adı **${nick}** olarak değiştirildi.` : `${member} takma adı sıfırlandı.`);
    },
  },
];

const { regroup } = require('../../lib/group');

module.exports = regroup(module.exports, [
  {
    name: 'kilit', description: '🔒 Kanalı kilitler veya kilidini açar.', perm: PermissionFlagsBits.ManageChannels,
    parts: [{ sub: 'kapat', from: 'kilitle' }, { sub: 'ac', from: 'kilit-ac' }],
  },
]);
