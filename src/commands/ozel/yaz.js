// /yaz: Bot, verilen metni kanala kendisi yazar. Komut izi kalmaz (gizli yanıt anında silinir).
const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags, ChannelType } = require('discord.js');
const { replyFail } = require('../../lib/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('yaz')
    .setDescription('👑 Botun ağzından mesaj yazar (komut iz bırakmaz).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o.setName('metin').setDescription('Yazılacak metin (alt satır için \\n kullan)').setRequired(true).setMaxLength(2000))
    .addChannelOption((o) => o.setName('kanal').setDescription('Mesajın gönderileceği kanal (varsayılan: bu kanal)')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.GuildVoice))
    .addStringOption((o) => o.setName('yanitla').setDescription('Yanıt verilecek mesajın ID\'si veya linki'))
    .addAttachmentOption((o) => o.setName('dosya').setDescription('Mesaja eklenecek dosya/görsel')),

  async execute(interaction) {
    const channel = interaction.options.getChannel('kanal') || interaction.channel;
    const text = interaction.options.getString('metin').replace(/\\n/g, '\n');
    const replyRaw = interaction.options.getString('yanitla');
    const file = interaction.options.getAttachment('dosya');

    if (!channel.permissionsFor(interaction.guild.members.me)?.has(PermissionFlagsBits.SendMessages)) {
      return replyFail(interaction, `${channel} kanalına mesaj gönderme iznim yok.`);
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const payload = {
      content: text,
      files: file ? [{ attachment: file.url, name: file.name }] : [],
      allowedMentions: { parse: ['users', 'roles', 'everyone'] }, // yetkililer etiket atabilir
    };
    if (replyRaw) {
      const messageId = replyRaw.split('/').pop().trim();
      payload.reply = { messageReference: messageId, failIfNotExists: false };
    }

    try {
      await channel.send(payload);
      await interaction.deleteReply(); // komuttan hiçbir iz kalmasın
    } catch (err) {
      await interaction.editReply({ content: `❌ Mesaj gönderilemedi: ${err.message}` });
    }
  },
};
