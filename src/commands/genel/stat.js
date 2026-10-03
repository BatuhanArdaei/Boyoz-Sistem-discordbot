// /stat ve /top: ses ve mesaj istatistikleri, sıralamalar.
const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const db = require('../../lib/db');
const stats = require('../../lib/stats');
const levels = require('../../lib/levels');
const { base, replyFail } = require('../../lib/embeds');

const PERIODS = { bugun: 'Bugün', hafta: 'Son 7 gün', ay: 'Son 30 gün', toplam: 'Tüm zamanlar' };
const medal = (i) => ['🥇', '🥈', '🥉'][i] || `**${i + 1}.**`;

module.exports = [
  {
    data: new SlashCommandBuilder().setName('stat').setDescription('📊 Ses ve mesaj istatistiklerini gösterir.').setContexts(InteractionContextType.Guild)
      .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı (boş = sen)')),
    async execute(interaction) {
      const user = interaction.options.getUser('kullanici') || interaction.user;
      if (user.bot) return replyFail(interaction, 'Botların istatistiği tutulmaz.');
      const u = stats.snapshot(interaction.guild, user.id);
      const rows = Object.entries(PERIODS).map(([k, label]) => {
        const p = stats.period(u, k);
        return `**${label}:** 🔊 ${stats.fmtVoice(p.v)} • 💬 ${p.m.toLocaleString('tr-TR')} mesaj`;
      });
      const topV = Object.entries(u.vch).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, ms]) => `<#${id}> — ${stats.fmtVoice(ms)}`);
      const topM = Object.entries(u.mch).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => `<#${id}> — ${n}`);
      const inv = db.guild(interaction.guild.id).invites.users[user.id];
      const lvl = levels.levelFromXp(levels.getUser(interaction.guild.id, user.id).xp).level;
      const embed = base().setAuthor({ name: `${user.username} • İstatistik`, iconURL: user.displayAvatarURL() })
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .setDescription(rows.join('\n'))
        .addFields(
          { name: '🔊 En çok takıldığı ses kanalları', value: topV.join('\n') || '—', inline: true },
          { name: '💬 En çok yazdığı kanallar', value: topM.join('\n') || '—', inline: true },
          { name: '​', value: `📺 Yayın: **${stats.fmtVoice(u.stream)}** • 📈 Seviye: **${lvl}** • 📨 Davet: **${inv ? inv.regular + inv.bonus - inv.left : 0}**` },
        );
      const live = stats.sessions.get(`${interaction.guild.id}:${user.id}`);
      if (live) embed.setFooter({ text: '🟢 Şu an seste' });
      await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
    },
  },
  {
    data: new SlashCommandBuilder().setName('top').setDescription('🏆 Sunucu sıralamaları: ses, mesaj, davet, seviye, boyoz.').setContexts(InteractionContextType.Guild)
      .addStringOption((o) => o.setName('tur').setDescription('Neye göre?').setRequired(true).addChoices(
        { name: '🔊 Ses süresi', value: 'ses' }, { name: '💬 Mesaj', value: 'mesaj' }, { name: '📨 Davet', value: 'davet' },
        { name: '📈 Seviye', value: 'seviye' }, { name: '🥐 Boyoz', value: 'boyoz' }, { name: '📺 Yayın süresi', value: 'yayin' },
      ))
      .addStringOption((o) => o.setName('donem').setDescription('Dönem (ses ve mesaj için)').addChoices(...Object.entries(PERIODS).map(([value, name]) => ({ name, value })))),
    async execute(interaction) {
      const type = interaction.options.getString('tur');
      const p = interaction.options.getString('donem') || 'hafta';
      const g = db.guild(interaction.guild.id);
      let list; let title; let fmt;
      if (type === 'ses' || type === 'mesaj') {
        for (const key of stats.sessions.keys()) if (key.startsWith(interaction.guild.id)) stats.snapshot(interaction.guild, key.split(':')[1]);
        list = Object.entries(g.stats.users).map(([id, u]) => [id, stats.period(u, p)[type === 'ses' ? 'v' : 'm']]);
        title = `${type === 'ses' ? '🔊 Ses' : '💬 Mesaj'} Sıralaması • ${PERIODS[p]}`;
        fmt = type === 'ses' ? stats.fmtVoice : (n) => `${n.toLocaleString('tr-TR')} mesaj`;
      } else if (type === 'yayin') {
        list = Object.entries(g.stats.users).map(([id, u]) => [id, u.stream]); title = '📺 Yayın Süresi Sıralaması'; fmt = stats.fmtVoice;
      } else if (type === 'davet') {
        list = Object.entries(g.invites.users).map(([id, u]) => [id, u.regular + u.bonus - u.left]); title = '📨 Davet Sıralaması'; fmt = (n) => `${n} davet`;
      } else if (type === 'seviye') {
        list = Object.entries(g.levels.users).map(([id, u]) => [id, u.xp]); title = '📈 Seviye Sıralaması'; fmt = (xp) => `Seviye ${levels.levelFromXp(xp).level} (${xp} XP)`;
      } else {
        list = Object.entries(g.economy).map(([id, w]) => [id, w.balance]); title = '🥐 Boyoz Sıralaması'; fmt = (n) => `${n.toLocaleString('tr-TR')} 🥐`;
      }
      list = list.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
      if (!list.length) return replyFail(interaction, 'Bu sıralama için henüz veri yok.');
      const me = list.findIndex(([id]) => id === interaction.user.id);
      const embed = base().setTitle(`🏆 ${title}`).setThumbnail(interaction.guild.iconURL())
        .setDescription(list.slice(0, 15).map(([id, v], i) => `${medal(i)} <@${id}> • ${fmt(v)}`).join('\n'));
      if (me >= 0) embed.setFooter({ text: `Senin sıran: #${me + 1}` });
      await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
    },
  },
];
