// /afk: Kullanıcıyı AFK yapar. Yazınca veya seste hareket edince otomatik kalkar.
const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { base, replyFail } = require('../../lib/embeds');
const afk = require('../../lib/afk');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('💤 AFK ol: seni etiketleyenlere sebebini söylerim, döndüğünde otomatik kalkar.')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o.setName('sebep').setDescription('Neden AFK\'sın? (ör: yemekteyim)').setMaxLength(150)),

  async execute(interaction) {
    if (afk.get(interaction.guild.id, interaction.user.id)) return replyFail(interaction, 'Zaten AFK\'sın! Bir mesaj yazınca otomatik kalkar.');
    const reason = interaction.options.getString('sebep')?.replace(/@(everyone|here)/g, '@​$1') || null;
    const entry = await afk.set(interaction.member, reason);
    const nickNote = entry.nickChanged ? '' : '\n*(Takma adını değiştiremedim: rolün benimkinden yüksek ya da sunucu sahibisin.)*';
    await interaction.reply({
      embeds: [base(0x99aab5).setDescription(`💤 **${interaction.user.username}** artık AFK${reason ? `: *${reason}*` : '.'}${nickNote}\nBir mesaj yazınca ya da seste hareket edince AFK otomatik kalkar.`)],
      allowedMentions: { parse: [] },
    });
  },
};
