// Genel bilgi ve yardımcı komutlar.
const {
  SlashCommandBuilder, InteractionContextType, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, version: djsVersion,
} = require('discord.js');
const db = require('../../lib/db');
const { base, replyOk, replyFail, files, urls } = require('../../lib/embeds');
const { CATEGORIES } = require('../../lib/registry');
const levels = require('../../lib/levels');
const { isOwner, ts, formatDuration, parseDuration, truncate } = require('../../lib/util');

const guildOnly = (b) => b.setContexts(InteractionContextType.Guild);

function helpHome(client, userId) {
  const cats = Object.entries(CATEGORIES).filter(([k]) => k !== 'ozel' || isOwner(userId));
  const counts = {};
  for (const cmd of client.commands.values()) counts[cmd.category] = (counts[cmd.category] || 0) + 1;
  const embed = base()
    .setTitle('🥐 Boyoz Sistem • Yardım')
    .setDescription('Sunucunun her işine koşan, çıtır çıtır bir bot. Aşağıdaki menüden bir kategori seç.\n​')
    .setThumbnail(urls.logo)
    .setImage(urls.banner)
    .addFields(cats.map(([k, c]) => ({ name: `${c.emoji} ${c.label} (${counts[k] || 0})`, value: c.description, inline: true })));
  const menu = new StringSelectMenuBuilder().setCustomId(`yardim:kategori:${userId}`).setPlaceholder('📂 Kategori seç...')
    .addOptions([{ label: 'Ana sayfa', value: 'ana', emoji: '🏠' }, ...cats.map(([k, c]) => ({ label: c.label, value: k, emoji: c.emoji, description: c.description.slice(0, 100) }))]);
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], files: [files.logo(), files.banner()] };
}

function describeCommand(cmd) {
  const json = cmd.data.toJSON();
  const subs = (json.options || []).filter((o) => o.type === 1);
  if (!subs.length) return [`**/${json.name}** — ${json.description}`];
  return [`**/${json.name}** — ${json.description}`, ...subs.map((s) => `└ \`/${json.name} ${s.name}\` ${s.description}`)];
}

module.exports = [
  // ---------------------------------------------------------------- /yardim
  {
    dmAllowed: true,
    data: new SlashCommandBuilder().setName('yardim').setDescription('🥐 Tüm komutları ve kategorileri gösterir.'),
    async execute(interaction, client) {
      await interaction.reply(helpHome(client, interaction.user.id));
    },
    components: {
      async kategori(interaction, [ownerId], client) {
        if (interaction.user.id !== ownerId) return replyFail(interaction, 'Bu menü başkasına ait, kendi `/yardim` komutunu kullan.');
        const cat = interaction.values[0];
        if (cat === 'ana') {
          const home = helpHome(client, ownerId);
          return interaction.update({ ...home, attachments: [] });
        }
        if (cat === 'ozel' && !isOwner(interaction.user.id)) return replyFail(interaction, 'Bu kategori sadece bot yetkililerine açık.');
        const c = CATEGORIES[cat];
        const lines = [...client.commands.values()].filter((cmd) => cmd.category === cat).flatMap(describeCommand);
        const embed = base().setTitle(`${c.emoji} ${c.label} Komutları`).setDescription(lines.join('\n').slice(0, 4000)).setThumbnail(urls.logo);
        return interaction.update({ embeds: [embed], components: interaction.message.components, files: [files.logo()], attachments: [] });
      },
    },
  },

  // ---------------------------------------------------------------- /ping
  {
    dmAllowed: true,
    data: new SlashCommandBuilder().setName('ping').setDescription('🏓 Botun gecikmesini gösterir.'),
    async execute(interaction, client) {
      const sent = Date.now();
      await interaction.reply({ embeds: [base().setDescription('🏓 Ölçülüyor...')] });
      const rtt = Date.now() - sent;
      await interaction.editReply({ embeds: [base().setTitle('🏓 Pong!').addFields(
        { name: 'Mesaj gecikmesi', value: `${rtt} ms`, inline: true },
        { name: 'API (WebSocket)', value: `${Math.max(client.ws.ping, 0)} ms`, inline: true },
        { name: 'Çalışma süresi', value: formatDuration(client.uptime), inline: true },
      )] });
    },
  },

  // ---------------------------------------------------------------- /bot-bilgi
  {
    dmAllowed: true,
    data: new SlashCommandBuilder().setName('bot-bilgi').setDescription('🥐 Boyoz Sistem hakkında bilgi verir.'),
    async execute(interaction, client) {
      const users = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
      const mem = process.memoryUsage().rss / 1024 / 1024;
      const embed = base()
        .setTitle('🥐 Boyoz Sistem')
        .setDescription('Bu sunucuya özel geliştirildi. Moderasyon, otomasyon, log, duyuru, oyunlar… hepsi tek bir boyozda. 🧡')
        .setThumbnail(client.user.displayAvatarURL())
        .setImage(urls.banner)
        .addFields(
          { name: '🌍 Sunucu', value: String(client.guilds.cache.size), inline: true },
          { name: '👥 Kullanıcı', value: users.toLocaleString('tr-TR'), inline: true },
          { name: '⌨️ Komut', value: String(client.commands.size), inline: true },
          { name: '⏱️ Çalışma süresi', value: formatDuration(client.uptime), inline: true },
          { name: '💾 Bellek', value: `${mem.toFixed(1)} MB`, inline: true },
          { name: '⚙️ Altyapı', value: `Node ${process.version} • discord.js v${djsVersion}`, inline: true },
        );
      await interaction.reply({ embeds: [embed], files: [files.banner()] });
    },
  },

  // ---------------------------------------------------------------- /kullanici-bilgi
  {
    data: guildOnly(new SlashCommandBuilder().setName('kullanici-bilgi').setDescription('👤 Kullanıcı hakkında bilgi verir.'))
      .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı (boş = sen)')),
    async execute(interaction) {
      const user = await (interaction.options.getUser('kullanici') || interaction.user).fetch();
      const member = interaction.options.getMember('kullanici') || (user.id === interaction.user.id ? interaction.member : null);
      const embed = base(member?.displayColor || undefined)
        .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
        .setThumbnail(member?.displayAvatarURL({ size: 512 }) || user.displayAvatarURL({ size: 512 }))
        .addFields(
          { name: '🆔 ID', value: `\`${user.id}\``, inline: true },
          { name: '🤖 Bot mu?', value: user.bot ? 'Evet' : 'Hayır', inline: true },
          { name: '📅 Hesap', value: `${ts(user.createdTimestamp, 'D')}\n${ts(user.createdTimestamp, 'R')}`, inline: true },
        );
      if (member) {
        const roles = member.roles.cache.filter((r) => r.id !== interaction.guild.id).sort((a, b) => b.position - a.position);
        const lvl = levels.getUser(interaction.guild.id, user.id);
        const warns = db.guild(interaction.guild.id).warnings[user.id]?.length || 0;
        embed.addFields(
          { name: '📥 Katılma', value: `${ts(member.joinedTimestamp, 'D')}\n${ts(member.joinedTimestamp, 'R')}`, inline: true },
          { name: '🏷️ Takma ad', value: member.nickname || '—', inline: true },
          { name: '📈 Seviye', value: `${levels.levelFromXp(lvl.xp).level} (${lvl.xp} XP)`, inline: true },
          { name: '⚠️ Uyarı', value: String(warns), inline: true },
          { name: '🚀 Boost', value: member.premiumSince ? ts(member.premiumSinceTimestamp, 'R') : '—', inline: true },
          { name: `🎭 Roller (${roles.size})`, value: truncate(roles.map((r) => `${r}`).join(' '), 1024) || '—' },
        );
      }
      if (user.banner) embed.setImage(user.bannerURL({ size: 1024 }));
      await interaction.reply({ embeds: [embed] });
    },
  },

  // ---------------------------------------------------------------- /sunucu-bilgi
  {
    data: guildOnly(new SlashCommandBuilder().setName('sunucu-bilgi').setDescription('🏠 Sunucu hakkında bilgi verir.')),
    async execute(interaction) {
      const g = interaction.guild;
      await interaction.deferReply();
      await g.members.fetch({ time: 10000 }).catch(() => {});
      const humans = g.members.cache.filter((m) => !m.user.bot).size;
      const ch = g.channels.cache;
      const embed = base()
        .setTitle(`🏠 ${g.name}`)
        .setThumbnail(g.iconURL({ size: 512 }))
        .addFields(
          { name: '👑 Sahip', value: `<@${g.ownerId}>`, inline: true },
          { name: '🆔 ID', value: `\`${g.id}\``, inline: true },
          { name: '📅 Kuruluş', value: `${ts(g.createdTimestamp, 'D')}\n${ts(g.createdTimestamp, 'R')}`, inline: true },
          { name: '👥 Üyeler', value: `Toplam: **${g.memberCount}**\n👤 ${humans} • 🤖 ${g.memberCount - humans}`, inline: true },
          { name: '💬 Kanallar', value: `📝 ${ch.filter((c) => c.type === ChannelType.GuildText).size} • 🔊 ${ch.filter((c) => c.type === ChannelType.GuildVoice).size} • 📁 ${ch.filter((c) => c.type === ChannelType.GuildCategory).size}`, inline: true },
          { name: '🎭 Roller', value: String(g.roles.cache.size - 1), inline: true },
          { name: '🚀 Boost', value: `Seviye ${g.premiumTier} • ${g.premiumSubscriptionCount || 0} boost`, inline: true },
          { name: '😀 Emoji', value: String(g.emojis.cache.size), inline: true },
          { name: '🛡️ Doğrulama', value: ['Yok', 'Düşük', 'Orta', 'Yüksek', 'Çok yüksek'][g.verificationLevel], inline: true },
        );
      if (g.description) embed.setDescription(g.description);
      if (g.banner) embed.setImage(g.bannerURL({ size: 1024 }));
      await interaction.editReply({ embeds: [embed] });
    },
  },

  // ---------------------------------------------------------------- /avatar
  {
    dmAllowed: true,
    data: new SlashCommandBuilder().setName('avatar').setDescription('🖼️ Kullanıcının avatarını büyük gösterir.')
      .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı (boş = sen)'))
      .addBooleanOption((o) => o.setName('banner').setDescription('Avatar yerine profil bannerını göster')),
    async execute(interaction) {
      const user = await (interaction.options.getUser('kullanici') || interaction.user).fetch();
      const member = interaction.inGuild() ? (interaction.options.getMember('kullanici') || (user.id === interaction.user.id ? interaction.member : null)) : null;
      if (interaction.options.getBoolean('banner')) {
        if (!user.banner) return replyFail(interaction, 'Bu kullanıcının bannerı yok.');
        const url = user.bannerURL({ size: 4096 });
        return interaction.reply({ embeds: [base(user.accentColor || undefined).setTitle(`${user.username} • Banner`).setImage(url).setURL(url)] });
      }
      const url = (member || user).displayAvatarURL({ size: 4096 });
      const row = new ActionRowBuilder().addComponents(
        ...['png', 'jpg', 'webp'].map((ext) => new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(ext.toUpperCase()).setURL((member || user).displayAvatarURL({ size: 4096, extension: ext }))),
      );
      await interaction.reply({ embeds: [base().setTitle(`${user.username} • Avatar`).setImage(url)], components: [row] });
    },
  },

  // ---------------------------------------------------------------- /seviye
  {
    data: guildOnly(new SlashCommandBuilder().setName('seviye').setDescription('📈 Seviyeni ve XP\'ni gösterir.'))
      .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı (boş = sen)')),
    async execute(interaction) {
      const user = interaction.options.getUser('kullanici') || interaction.user;
      const cfg = db.guild(interaction.guild.id).levels;
      if (!cfg.enabled) return replyFail(interaction, 'Bu sunucuda seviye sistemi kapalı. Yetkililer `/seviye-ayar ac` ile açabilir.');
      const data = levels.getUser(interaction.guild.id, user.id);
      const { level, current, needed } = levels.levelFromXp(data.xp);
      const rank = levels.ranking(interaction.guild.id).findIndex((u) => u.id === user.id) + 1;
      const filled = Math.round((current / needed) * 15);
      const embed = base()
        .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .setTitle(`📈 Seviye ${level}`)
        .setDescription(`${'🟧'.repeat(filled)}${'⬛'.repeat(15 - filled)}\n**${current} / ${needed} XP** (%${Math.floor((current / needed) * 100)})`)
        .addFields(
          { name: '🏆 Sıralama', value: rank ? `#${rank}` : '—', inline: true },
          { name: '✨ Toplam XP', value: String(data.xp), inline: true },
          { name: '💬 Mesaj', value: String(data.messages || 0), inline: true },
        );
      const next = cfg.rewards.find((r) => r.level > level);
      if (next) embed.addFields({ name: '🎁 Sonraki ödül', value: `Seviye ${next.level} → <@&${next.roleId}>` });
      await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
    },
  },

  // ---------------------------------------------------------------- /siralama
  {
    data: guildOnly(new SlashCommandBuilder().setName('siralama').setDescription('🏆 Sunucunun seviye sıralamasını gösterir.')),
    async execute(interaction) {
      const list = levels.ranking(interaction.guild.id).slice(0, 10);
      if (!list.length) return replyFail(interaction, 'Henüz kimse XP kazanmamış.');
      const medals = ['🥇', '🥈', '🥉'];
      const lines = list.map((u, i) => `${medals[i] || `**${i + 1}.**`} <@${u.id}> • Seviye **${levels.levelFromXp(u.xp).level}** • ${u.xp} XP`);
      await interaction.reply({ embeds: [base().setTitle(`🏆 ${interaction.guild.name} • Seviye Sıralaması`).setDescription(lines.join('\n')).setThumbnail(interaction.guild.iconURL())], allowedMentions: { parse: [] } });
    },
  },

  // ---------------------------------------------------------------- /hatirlat
  {
    data: guildOnly(new SlashCommandBuilder().setName('hatirlat').setDescription('⏰ Belirttiğin süre sonra sana hatırlatma yapar.'))
      .addStringOption((o) => o.setName('sure').setDescription('Ne zaman? (10m, 2h, 1d, 1sa30dk...)').setRequired(true))
      .addStringOption((o) => o.setName('mesaj').setDescription('Neyi hatırlatayım?').setRequired(true).setMaxLength(1000))
      .addBooleanOption((o) => o.setName('dm').setDescription('Kanal yerine DM\'den hatırlat')),
    async execute(interaction) {
      const ms = parseDuration(interaction.options.getString('sure'));
      if (!ms || ms < 60000 || ms > 365 * 864e5) return replyFail(interaction, 'Süre 1 dakika ile 1 yıl arasında olmalı. Örnek: `30m`, `2h`, `1d`');
      const mine = db.data.reminders.filter((r) => r.userId === interaction.user.id);
      if (mine.length >= 25) return replyFail(interaction, 'En fazla 25 aktif hatırlatıcın olabilir.');
      const at = Date.now() + ms;
      db.data.reminders.push({
        userId: interaction.user.id,
        channelId: interaction.options.getBoolean('dm') ? null : interaction.channelId,
        text: interaction.options.getString('mesaj'),
        at, createdAt: Date.now(),
      });
      db.save();
      return replyOk(interaction, `Tamamdır! ${ts(at)} (${ts(at, 'R')}) hatırlatacağım. ⏰`);
    },
  },
];
