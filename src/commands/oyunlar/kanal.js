// /oyun-kanali: Sayma ve kelime zinciri kanallarını ayarlar.
const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ChannelType } = require('discord.js');
const db = require('../../lib/db');
const { base, replyOk, reply } = require('../../lib/embeds');

const TYPES = { sayma: '🔢 Sayma', kelime: '🔗 Kelime Zinciri' };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('oyun-kanali')
    .setDescription('🎮 Sürekli oynanan sayma / kelime zinciri kanallarını ayarlar.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName('ayarla').setDescription('Bir kanalı oyun kanalı yapar')
      .addStringOption((o) => o.setName('oyun').setDescription('Oyun').setRequired(true).addChoices(...Object.entries(TYPES).map(([value, name]) => ({ name, value }))))
      .addChannelOption((o) => o.setName('kanal').setDescription('Kanal').setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand((s) => s.setName('kapat').setDescription('Oyun kanalını kapatır')
      .addStringOption((o) => o.setName('oyun').setDescription('Oyun').setRequired(true).addChoices(...Object.entries(TYPES).map(([value, name]) => ({ name, value })))))
    .addSubcommand((s) => s.setName('sifirla').setDescription('Oyunun ilerlemesini sıfırlar')
      .addStringOption((o) => o.setName('oyun').setDescription('Oyun').setRequired(true).addChoices(...Object.entries(TYPES).map(([value, name]) => ({ name, value })))))
    .addSubcommand((s) => s.setName('durum').setDescription('Oyun kanallarının durumunu gösterir')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const cg = db.guild(interaction.guild.id).channelGames;

    if (sub === 'durum') {
      return reply(interaction, base().setTitle('🎮 Oyun Kanalları').addFields(
        { name: TYPES.sayma, value: cg.sayma.channelId ? `<#${cg.sayma.channelId}>\nŞu an: **${cg.sayma.current}** • Rekor: **${cg.sayma.record}**` : 'Kapalı', inline: true },
        { name: TYPES.kelime, value: cg.kelime.channelId ? `<#${cg.kelime.channelId}>\nZincir: **${cg.kelime.count}** • Son kelime: **${cg.kelime.lastWord || '—'}**` : 'Kapalı', inline: true },
      ), { ephemeral: false });
    }

    const type = interaction.options.getString('oyun');
    if (sub === 'kapat') {
      cg[type].channelId = null;
      db.save();
      return replyOk(interaction, `${TYPES[type]} kanalı kapatıldı.`);
    }
    if (sub === 'sifirla') {
      if (type === 'sayma') Object.assign(cg.sayma, { current: 0, lastUser: null });
      else Object.assign(cg.kelime, { lastWord: null, lastUser: null, used: [], count: 0 });
      db.save();
      return replyOk(interaction, `${TYPES[type]} sıfırlandı.`);
    }

    const channel = interaction.options.getChannel('kanal');
    const otherType = type === 'sayma' ? 'kelime' : 'sayma';
    if (cg[otherType].channelId === channel.id) cg[otherType].channelId = null;
    cg[type].channelId = channel.id;
    db.save();
    const rules = type === 'sayma'
      ? '🔢 **Sayma Kanalı**\n1\'den başlayarak sırayla sayın!\n• Kimse üst üste iki kez sayamaz.\n• Yanlış sayı yazılırsa sayaç **sıfırlanır**.\n• Her doğru sayı **+1 🥐**'
      : '🔗 **Kelime Zinciri**\nHer kelime, önceki kelimenin **son harfiyle** başlamalı!\n• Aynı kelime iki kez kullanılamaz.\n• Kimse üst üste iki kelime yazamaz.\n• "ğ" ile biten kelimelerde bir önceki harf kullanılır.\n• Her doğru kelime **+1 🥐**';
    await channel.send({ embeds: [base().setTitle('🎮 Oyun başladı!').setDescription(`${rules}${type === 'sayma' ? `\n\nİlk sayı: **${cg.sayma.current + 1}**` : ''}`)] }).catch(() => {});
    return replyOk(interaction, `${channel} artık ${TYPES[type]} kanalı.`);
  },
};
