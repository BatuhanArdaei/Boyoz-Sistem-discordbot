// /hosgeldin ve /otorol: Karşılama, veda ve otomatik rol ayarları.
const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ChannelType } = require('discord.js');
const db = require('../../lib/db');
const { base, replyOk, replyFail, reply } = require('../../lib/embeds');
const { buildWelcome, buildGoodbye } = require('../../lib/welcome');
const { available: cardAvailable } = require('../../lib/card');

const PLACEHOLDERS = '`{kullanici}` etiket • `{kullanici_adi}` • `{isim}` • `{sunucu}` • `{uye_sayisi}` • `\\n` alt satır';

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('hosgeldin')
      .setDescription('👋 Hoş geldin ve veda mesajlarını ayarlar.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setContexts(InteractionContextType.Guild)
      .addSubcommand((s) => s.setName('ayarla').setDescription('Hoş geldin mesajını açar/ayarlar')
        .addChannelOption((o) => o.setName('kanal').setDescription('Karşılama kanalı').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addStringOption((o) => o.setName('mesaj').setDescription('Mesaj (değişkenler: {kullanici} {sunucu} {uye_sayisi} ...)').setMaxLength(1500))
        .addBooleanOption((o) => o.setName('kart').setDescription('Kullanıcının avatarıyla Boyoz temalı karşılama kartı oluştur')))
      .addSubcommand((s) => s.setName('dm').setDescription('Yeni üyelere özel mesaj gönderimini ayarlar')
        .addBooleanOption((o) => o.setName('aktif').setDescription('Açık/kapalı').setRequired(true))
        .addStringOption((o) => o.setName('mesaj').setDescription('DM mesajı').setMaxLength(1500)))
      .addSubcommand((s) => s.setName('veda').setDescription('Ayrılan üyeler için veda mesajını ayarlar')
        .addChannelOption((o) => o.setName('kanal').setDescription('Veda kanalı').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addStringOption((o) => o.setName('mesaj').setDescription('Mesaj (değişkenler: {kullanici_adi} {sunucu} {uye_sayisi})').setMaxLength(1500)))
      .addSubcommand((s) => s.setName('kapat').setDescription('Karşılama veya vedayı kapatır')
        .addStringOption((o) => o.setName('hangisi').setDescription('Hangisi?').setRequired(true).addChoices(
          { name: 'Hoş geldin', value: 'welcome' }, { name: 'Veda', value: 'goodbye' }, { name: 'İkisi de', value: 'ikisi' },
        )))
      .addSubcommand((s) => s.setName('test').setDescription('Karşılama ve veda mesajlarını kendinle test eder'))
      .addSubcommand((s) => s.setName('durum').setDescription('Mevcut ayarları gösterir')),

    async execute(interaction) {
      const sub = interaction.options.getSubcommand();
      const g = db.guild(interaction.guild.id);

      if (sub === 'ayarla') {
        g.welcome.enabled = true;
        g.welcome.channel = interaction.options.getChannel('kanal').id;
        const msg = interaction.options.getString('mesaj');
        const card = interaction.options.getBoolean('kart');
        if (msg) g.welcome.message = msg;
        if (card !== null) g.welcome.card = card;
        db.save();
        return replyOk(interaction, `Hoş geldin mesajları <#${g.welcome.channel}> kanalına gönderilecek.\n**Değişkenler:** ${PLACEHOLDERS}\n\`/hosgeldin test\` ile deneyebilirsin.`);
      }
      if (sub === 'dm') {
        g.welcome.dm = interaction.options.getBoolean('aktif');
        const msg = interaction.options.getString('mesaj');
        if (msg) g.welcome.dmMessage = msg;
        db.save();
        return replyOk(interaction, `Yeni üyelere DM ${g.welcome.dm ? 'gönderilecek' : 'gönderilmeyecek'}.`);
      }
      if (sub === 'veda') {
        g.goodbye.enabled = true;
        g.goodbye.channel = interaction.options.getChannel('kanal').id;
        const msg = interaction.options.getString('mesaj');
        if (msg) g.goodbye.message = msg;
        db.save();
        return replyOk(interaction, `Veda mesajları <#${g.goodbye.channel}> kanalına gönderilecek.`);
      }
      if (sub === 'kapat') {
        const which = interaction.options.getString('hangisi');
        if (which !== 'goodbye') g.welcome.enabled = false;
        if (which !== 'welcome') g.goodbye.enabled = false;
        db.save();
        return replyOk(interaction, 'Kapatıldı.');
      }
      if (sub === 'test') {
        await interaction.deferReply();
        const welcome = await buildWelcome(interaction.member);
        await interaction.editReply({ content: '🧪 **Hoş geldin önizlemesi:**', embeds: welcome.embeds, files: welcome.files, allowedMentions: { parse: [] } });
        await interaction.followUp({ content: '🧪 **Veda önizlemesi:**', ...buildGoodbye(interaction.member) });
        return;
      }
      // durum
      const embed = base().setTitle('👋 Karşılama Ayarları').addFields(
        { name: 'Hoş geldin', value: g.welcome.enabled ? `✅ <#${g.welcome.channel}>` : '❌ Kapalı', inline: true },
        { name: 'Görsel kart', value: g.welcome.card ? (cardAvailable() ? '✅ Açık' : '⚠️ Açık ama canvas yüklenemedi') : '❌ Kapalı', inline: true },
        { name: 'DM', value: g.welcome.dm ? '✅ Açık' : '❌ Kapalı', inline: true },
        { name: 'Hoş geldin mesajı', value: `\`\`\`${g.welcome.message.slice(0, 900)}\`\`\`` },
        { name: 'Veda', value: g.goodbye.enabled ? `✅ <#${g.goodbye.channel}>` : '❌ Kapalı', inline: true },
        { name: 'Veda mesajı', value: `\`\`\`${g.goodbye.message.slice(0, 900)}\`\`\`` },
        { name: 'Değişkenler', value: PLACEHOLDERS },
      );
      return reply(interaction, embed);
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('otorol')
      .setDescription('🎭 Sunucuya katılanlara otomatik verilecek rolleri ayarlar.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .setContexts(InteractionContextType.Guild)
      .addSubcommand((s) => s.setName('ekle').setDescription('Otomatik rol ekler')
        .addRoleOption((o) => o.setName('rol').setDescription('Rol').setRequired(true))
        .addStringOption((o) => o.setName('kime').setDescription('Kimlere verilsin?').addChoices({ name: 'İnsanlara', value: 'human' }, { name: 'Botlara', value: 'bot' })))
      .addSubcommand((s) => s.setName('cikar').setDescription('Otomatik rolü kaldırır')
        .addRoleOption((o) => o.setName('rol').setDescription('Rol').setRequired(true)))
      .addSubcommand((s) => s.setName('liste').setDescription('Otomatik rolleri listeler')),

    async execute(interaction) {
      const sub = interaction.options.getSubcommand();
      const cfg = db.guild(interaction.guild.id).autorole;
      if (sub === 'liste') {
        const fmt = (arr) => (arr.length ? arr.map((id) => `<@&${id}>`).join(' ') : '—');
        return reply(interaction, base().setTitle('🎭 Otorol').addFields({ name: '👤 İnsanlar', value: fmt(cfg.human) }, { name: '🤖 Botlar', value: fmt(cfg.bot) }));
      }
      const role = interaction.options.getRole('rol');
      if (sub === 'ekle') {
        if (role.managed || role.id === interaction.guild.id) return replyFail(interaction, 'Bu rol otomatik verilemez.');
        if (!role.editable) return replyFail(interaction, 'Bu rol benim rolümden yukarıda, veremem. Rolümü yukarı taşı.');
        const kime = interaction.options.getString('kime') || 'human';
        if (cfg[kime].includes(role.id)) return replyFail(interaction, 'Bu rol zaten listede.');
        cfg[kime].push(role.id);
        db.save();
        return replyOk(interaction, `${role} artık ${kime === 'bot' ? 'botlara' : 'yeni üyelere'} otomatik verilecek.`);
      }
      cfg.human = cfg.human.filter((id) => id !== role.id);
      cfg.bot = cfg.bot.filter((id) => id !== role.id);
      db.save();
      return replyOk(interaction, `${role} otorolden kaldırıldı.`);
    },
  },
];
