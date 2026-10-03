// /ses-kanali: Botun sürekli duracağı ses kanalını ayarlar.
const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ChannelType, MessageFlags } = require('discord.js');
const db = require('../../lib/db');
const { replyOk, replyFail } = require('../../lib/embeds');
const voice = require('../../lib/voice');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ses-kanali')
    .setDescription('🔊 Botun 7/24 duracağı ses kanalını ayarlar.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName('ayarla').setDescription('Bot bu ses kanalına girip sürekli orada kalır')
      .addChannelOption((o) => o.setName('kanal').setDescription('Ses kanalı').setRequired(true).addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)))
    .addSubcommand((s) => s.setName('ayril').setDescription('Bot ses kanalından ayrılır ve geri dönmez'))
    .addSubcommand((s) => s.setName('durum').setDescription('Ses kanalı ayarını gösterir')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const g = db.guild(interaction.guild.id);

    if (sub === 'durum') {
      const now = interaction.guild.members.me.voice.channelId;
      return replyOk(interaction, g.voice.channelId
        ? `Ayarlı kanal: <#${g.voice.channelId}>\nŞu an: ${now ? `<#${now}> içindeyim` : 'bağlı değilim (1 dakika içinde bağlanmayı deneyeceğim)'}`
        : 'Sürekli kalınacak bir ses kanalı ayarlı değil.');
    }
    if (sub === 'ayril') {
      g.voice.channelId = null;
      db.save();
      voice.leave(interaction.guild.id);
      return replyOk(interaction, 'Ses kanalından ayrıldım, artık geri dönmeyeceğim.');
    }
    const channel = interaction.options.getChannel('kanal');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      await voice.join(interaction.guild, channel.id);
    } catch (err) {
      return replyFail(interaction, err.message);
    }
    g.voice.channelId = channel.id;
    db.save();
    return replyOk(interaction, `${channel} kanalına girdim. Artık 7/24 burada duracağım; düşersem otomatik geri dönerim. 🔊`);
  },
};
