// /embed-yaz: Açılan formdan bot adına şık bir embed mesaj gönderir.
const {
  SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ChannelType, MessageFlags,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder,
} = require('discord.js');
const { replyFail, files, urls } = require('../../lib/embeds');
const { parseColor, isUrl } = require('../../lib/util');

const pending = new Map(); // nonce -> seçenekler

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed-yaz')
    .setDescription('👑 Bot adına embed (kutulu) mesaj gönderir.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addChannelOption((o) => o.setName('kanal').setDescription('Gönderilecek kanal').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addStringOption((o) => o.setName('renk').setDescription('Renk: hex (#ff9900) veya turuncu/kirmizi/yesil/mavi/sari/mor/pembe/siyah'))
    .addStringOption((o) => o.setName('gorsel').setDescription('Büyük görsel URL\'si'))
    .addStringOption((o) => o.setName('kucuk-gorsel').setDescription('Sağ üst küçük görsel URL\'si'))
    .addBooleanOption((o) => o.setName('boyoz-banner').setDescription('Boyoz bannerını görsel olarak ekle'))
    .addStringOption((o) => o.setName('ust-yazi').setDescription('Embed üstüne normal mesaj olarak yazılacak metin (etiket vb.)')),

  async execute(interaction) {
    const nonce = interaction.id;
    pending.set(nonce, {
      channelId: (interaction.options.getChannel('kanal') || interaction.channel).id,
      color: parseColor(interaction.options.getString('renk')),
      image: interaction.options.getString('gorsel'),
      thumb: interaction.options.getString('kucuk-gorsel'),
      banner: interaction.options.getBoolean('boyoz-banner') || false,
      top: interaction.options.getString('ust-yazi'),
    });
    setTimeout(() => pending.delete(nonce), 15 * 60000);

    const modal = new ModalBuilder().setCustomId(`embed-yaz:gonder:${nonce}`).setTitle('Embed Mesaj').addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('baslik').setLabel('Başlık').setStyle(TextInputStyle.Short).setMaxLength(256).setRequired(false)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('aciklama').setLabel('İçerik').setStyle(TextInputStyle.Paragraph).setMaxLength(4000).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('altbilgi').setLabel('Alt bilgi (footer)').setStyle(TextInputStyle.Short).setMaxLength(200).setRequired(false)),
    );
    await interaction.showModal(modal);
  },

  components: {
    async gonder(interaction, [nonce]) {
      const opts = pending.get(nonce);
      if (!opts) return replyFail(interaction, 'Form süresi doldu, komutu tekrar kullan.');
      pending.delete(nonce);

      const channel = interaction.guild.channels.cache.get(opts.channelId);
      const embed = new EmbedBuilder()
        .setColor(opts.color)
        .setDescription(interaction.fields.getTextInputValue('aciklama'));
      const title = interaction.fields.getTextInputValue('baslik');
      const footer = interaction.fields.getTextInputValue('altbilgi');
      if (title) embed.setTitle(title);
      if (footer) embed.setFooter({ text: footer });
      if (isUrl(opts.thumb)) embed.setThumbnail(opts.thumb);
      const attach = [];
      if (isUrl(opts.image)) embed.setImage(opts.image);
      else if (opts.banner) { embed.setImage(urls.banner); attach.push(files.banner()); }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        await channel.send({ content: opts.top?.replace(/\\n/g, '\n') || undefined, embeds: [embed], files: attach, allowedMentions: { parse: ['users', 'roles', 'everyone'] } });
        await interaction.deleteReply();
      } catch (err) {
        await interaction.editReply(`❌ Gönderilemedi: ${err.message}`);
      }
    },
  },
};
