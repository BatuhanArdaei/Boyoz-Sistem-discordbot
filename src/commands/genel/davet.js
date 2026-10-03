// /davet ve /davet-bonus: davet istatistikleri.
const { SlashCommandBuilder, InteractionContextType, PermissionFlagsBits } = require('discord.js');
const db = require('../../lib/db');
const invites = require('../../lib/invites');
const { base, replyOk } = require('../../lib/embeds');

module.exports = [
  {
    data: new SlashCommandBuilder().setName('davet').setDescription('📨 Davet istatistiklerini gösterir.').setContexts(InteractionContextType.Guild)
      .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı (boş = sen)')),
    async execute(interaction) {
      const user = interaction.options.getUser('kullanici') || interaction.user;
      const s = invites.stat(interaction.guild.id, user.id);
      const joins = db.guild(interaction.guild.id).invites.joins;
      const recent = Object.entries(joins).filter(([, j]) => j.inviterId === user.id).sort((a, b) => b[1].at - a[1].at).slice(0, 8)
        .map(([id, j]) => `<@${id}> ${j.fake ? '⚠️ sahte' : ''} • <t:${Math.floor(j.at / 1000)}:R>`);
      const myJoin = joins[user.id];
      await interaction.reply({ embeds: [base().setAuthor({ name: `${user.username} • Davetler`, iconURL: user.displayAvatarURL() })
        .setDescription(`Toplam: **${invites.total(s)}** davet\n✅ Gerçek: **${s.regular}** • ⚠️ Sahte: **${s.fake}** • 🚪 Ayrılan: **${s.left}** • 🎁 Bonus: **${s.bonus}**\n\nHer gerçek davet **+${invites.REWARD} 🥐** kazandırır!`)
        .addFields(
          { name: '🆕 Son getirdikleri', value: recent.join('\n') || '—' },
          { name: '🔗 Kendisini davet eden', value: myJoin?.inviterId ? `<@${myJoin.inviterId}>` : myJoin?.vanity ? 'Özel URL' : 'Bilinmiyor' },
        )], allowedMentions: { parse: [] } });
    },
  },
  {
    data: new SlashCommandBuilder().setName('davet-bonus').setDescription('🎁 Kullanıcıya bonus davet ekler/çıkarır.').setContexts(InteractionContextType.Guild)
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
      .addIntegerOption((o) => o.setName('miktar').setDescription('Eklenecek (eksi = çıkar)').setRequired(true).setMinValue(-10000).setMaxValue(10000)),
    async execute(interaction) {
      const user = interaction.options.getUser('kullanici');
      const s = invites.stat(interaction.guild.id, user.id);
      s.bonus += interaction.options.getInteger('miktar');
      db.save();
      return replyOk(interaction, `${user} bonus davet: **${s.bonus}** • Toplam: **${invites.total(s)}**`);
    },
  },
];

const { regroup } = require('../../lib/group');

module.exports = regroup(module.exports, [
  {
    name: 'davet', description: '📨 Davet istatistikleri (gerçek, sahte, ayrılan, bonus).',
    parts: [{ sub: 'bilgi', from: 'davet' }, { sub: 'bonus', from: 'davet-bonus', perm: PermissionFlagsBits.ManageGuild }],
  },
]);
