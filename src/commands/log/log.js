// /log: Log kanallarını ayarlar. Tek kanala tüm loglar ya da türlere göre ayrı kanallar.
const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ChannelType, OverwriteType } = require('discord.js');
const db = require('../../lib/db');
const { base, replyOk, replyFail, reply } = require('../../lib/embeds');
const { LOG_TYPES } = require('../../lib/logger');

const typeChoices = [{ name: 'Hepsi', value: 'hepsi' }, ...Object.entries(LOG_TYPES).map(([value, name]) => ({ name, value }))];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('log')
    .setDescription('📜 Sunucu log (kayıt) kanallarını yönetir.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName('ayarla').setDescription('Bir log türü için kanal ayarlar')
      .addStringOption((o) => o.setName('tur').setDescription('Log türü').setRequired(true).addChoices(...typeChoices))
      .addChannelOption((o) => o.setName('kanal').setDescription('Log kanalı').setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand((s) => s.setName('kapat').setDescription('Bir log türünü kapatır')
      .addStringOption((o) => o.setName('tur').setDescription('Log türü').setRequired(true).addChoices(...typeChoices)))
    .addSubcommand((s) => s.setName('kur').setDescription('"Boyoz Log" kategorisi ve tüm log kanallarını otomatik oluşturur (sadece yetkililer görür)'))
    .addSubcommand((s) => s.setName('durum').setDescription('Log ayarlarını gösterir')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const g = db.guild(interaction.guild.id);

    if (sub === 'durum') {
      const lines = Object.entries(LOG_TYPES).map(([k, label]) => `${label}\n└ ${g.logs[k] ? `<#${g.logs[k]}>` : '`kapalı`'}`);
      return reply(interaction, base().setTitle('📜 Log Ayarları').setDescription(lines.join('\n\n')));
    }

    if (sub === 'kur') {
      const me = interaction.guild.members.me;
      if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) return replyFail(interaction, '"Kanalları Yönet" iznim yok.');
      await interaction.deferReply();
      const overwrites = [
        { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel], type: OverwriteType.Role },
        { id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles], type: OverwriteType.Member },
      ];
      const category = await interaction.guild.channels.create({ name: '🥐 Boyoz Log', type: ChannelType.GuildCategory, permissionOverwrites: overwrites });
      const names = { mesaj: 'mesaj-log', uye: 'üye-log', ses: 'ses-log', sunucu: 'sunucu-log', moderasyon: 'moderasyon-log' };
      for (const [type, name] of Object.entries(names)) {
        const ch = await interaction.guild.channels.create({ name, type: ChannelType.GuildText, parent: category.id, topic: `Boyoz Sistem • ${LOG_TYPES[type]}` });
        g.logs[type] = ch.id;
      }
      db.save();
      return interaction.editReply({ embeds: [base().setTitle('✅ Log sistemi kuruldu').setDescription(`${category} kategorisi altında tüm log kanalları oluşturuldu. Kategori @everyone'a gizli; yetkililerin görmesi için kategori izinlerinden rollerine erişim ver.`)] });
    }

    const type = interaction.options.getString('tur');
    const types = type === 'hepsi' ? Object.keys(LOG_TYPES) : [type];

    if (sub === 'ayarla') {
      const channel = interaction.options.getChannel('kanal');
      const perms = channel.permissionsFor(interaction.guild.members.me);
      if (!perms.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
        return replyFail(interaction, `${channel} kanalında mesaj/embed gönderme iznim yok.`);
      }
      for (const t of types) g.logs[t] = channel.id;
      db.save();
      return replyOk(interaction, `${types.map((t) => LOG_TYPES[t]).join(', ')} logları artık ${channel} kanalına gidecek.`);
    }

    for (const t of types) g.logs[t] = null;
    db.save();
    return replyOk(interaction, `${type === 'hepsi' ? 'Tüm loglar' : LOG_TYPES[type]} kapatıldı.`);
  },
};
