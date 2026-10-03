// Genel bilgi ve yardımcı komutlar.
const {
  SlashCommandBuilder, InteractionContextType, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, PermissionsBitField, version: djsVersion,
} = require('discord.js');
const db = require('../../lib/db');
const { base, replyOk, replyFail, files, urls } = require('../../lib/embeds');
const { CATEGORIES } = require('../../lib/registry');
const levels = require('../../lib/levels');
const { isOwner, ts, formatDuration, parseDuration, truncate } = require('../../lib/util');

const guildOnly = (b) => b.setContexts(InteractionContextType.Guild);

const OPTION_TYPES = { 3: 'metin', 4: 'tam sayı', 5: 'evet/hayır', 6: 'kullanıcı', 7: 'kanal', 8: 'rol', 9: 'kullanıcı/rol', 10: 'sayı', 11: 'dosya' };
const PERMISSION_NAMES = {
  Administrator: 'Yönetici', ManageGuild: 'Sunucuyu Yönet', ManageMessages: 'Mesajları Yönet', ManageChannels: 'Kanalları Yönet',
  ManageRoles: 'Rolleri Yönet', ManageNicknames: 'Takma Adları Yönet', BanMembers: 'Üyeleri Yasakla', KickMembers: 'Üyeleri At',
  ModerateMembers: 'Üyelere Zaman Aşımı Uygula',
};
const LEADING_EMOJI = /^(\p{Extended_Pictographic}️?(‍\p{Extended_Pictographic}️?)*)\s*/u;

const visibleCategories = (userId) => Object.entries(CATEGORIES).filter(([k]) => k !== 'ozel' || isOwner(userId));
const commandsIn = (client, cat) => [...client.commands.values()].filter((c) => c.category === cat).sort((a, b) => a.data.name.localeCompare(b.data.name, 'tr'));

// Kategori menüsü + (kategori seçiliyse) komut menüsü. 25'ten fazla komut varsa birden çok menüye bölünür.
function helpMenus(client, userId, cat = null, selected = null) {
  const catMenu = new StringSelectMenuBuilder().setCustomId(`yardim:kategori:${userId}`).setPlaceholder('📂 Kategori seç...')
    .addOptions([
      { label: 'Ana sayfa', value: 'ana', emoji: '🏠' },
      ...visibleCategories(userId).map(([k, c]) => ({ label: c.label, value: k, emoji: c.emoji, description: c.description.slice(0, 100), default: k === cat })),
    ]);
  const rows = [new ActionRowBuilder().addComponents(catMenu)];
  if (cat) {
    const cmds = commandsIn(client, cat);
    for (let i = 0; i < cmds.length && rows.length < 5; i += 25) {
      const chunk = cmds.slice(i, i + 25);
      rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
        .setCustomId(`yardim:komut:${userId}:${cat}:${i}`)
        .setPlaceholder(cmds.length > 25 ? `🔎 Komut seç (${i + 1}-${i + chunk.length})...` : '🔎 Komut seç...')
        .addOptions(chunk.map((c) => {
          const desc = c.data.description;
          const emoji = desc.match(LEADING_EMOJI)?.[1];
          return {
            label: `${emoji ? `${emoji} ` : ''}/${c.data.name}`.slice(0, 100),
            value: c.data.name,
            description: desc.replace(LEADING_EMOJI, '').slice(0, 100) || undefined,
            default: c.data.name === selected,
          };
        }))));
    }
  }
  return rows;
}

function helpHome(client, userId) {
  const counts = {};
  for (const cmd of client.commands.values()) counts[cmd.category] = (counts[cmd.category] || 0) + 1;
  const embed = base()
    .setTitle('🥐 Boyoz Sistem • Yardım')
    .setDescription('Sunucunun her işine koşan, çıtır çıtır bir bot.\nAşağıdan bir **kategori** seç, ardından açılan menüden bir **komut** seçerek detaylarını gör.\n​')
    .setThumbnail(urls.logo)
    .setImage(urls.banner)
    .addFields(visibleCategories(userId).map(([k, c]) => ({ name: `${c.emoji} ${c.label} (${counts[k] || 0})`, value: c.description, inline: true })));
  return { embeds: [embed], components: helpMenus(client, userId), files: [files.logo(), files.banner()] };
}

function describeCommand(cmd) {
  const json = cmd.data.toJSON();
  const subs = (json.options || []).filter((o) => o.type === 1);
  if (!subs.length) return [`**/${json.name}** — ${json.description}`];
  return [`**/${json.name}** — ${json.description}`, ...subs.map((s) => `└ \`/${json.name} ${s.name}\` ${s.description}`)];
}

function categoryEmbed(client, cat) {
  const c = CATEGORIES[cat];
  let text = '';
  for (const line of commandsIn(client, cat).flatMap(describeCommand)) {
    if (text.length + line.length > 3900) { text += '\n… ve daha fazlası, aşağıdaki menüden seç.'; break; }
    text += `${line}\n`;
  }
  return base().setTitle(`${c.emoji} ${c.label} Komutları`).setDescription(text).setThumbnail(urls.logo)
    .setFooter({ text: '🔎 Detay için aşağıdaki menüden bir komut seç' });
}

// Seçenekleri "• `ad` (tür, zorunlu) açıklama" biçiminde listeler
function formatOptions(options = []) {
  return options.map((o) => {
    let line = `• \`${o.name}\` *(${OPTION_TYPES[o.type] || 'değer'}${o.required ? ', **zorunlu**' : ', isteğe bağlı'})* ${o.description}`;
    if (o.choices?.length) line += `\n  ↳ Seçimler: ${o.choices.slice(0, 12).map((ch) => `\`${ch.name}\``).join(', ')}${o.choices.length > 12 ? '…' : ''}`;
    if (o.min_value !== undefined || o.max_value !== undefined) line += `\n  ↳ Aralık: ${o.min_value ?? '…'} – ${o.max_value ?? '…'}`;
    return line;
  }).join('\n');
}
const usage = (name, options = []) => `\`/${name}${options.map((o) => (o.required ? ` ${o.name}:…` : ` [${o.name}]`)).join('')}\``;

function commandDetail(cmd) {
  const json = cmd.data.toJSON();
  const c = CATEGORIES[cmd.category];
  const embed = base().setTitle(`/${json.name}`).setDescription(json.description).setThumbnail(urls.logo)
    .setAuthor({ name: `${c.emoji} ${c.label}` });

  const subs = (json.options || []).filter((o) => o.type === 1);
  if (subs.length) {
    for (const s of subs.slice(0, 20)) {
      const opts = formatOptions(s.options);
      embed.addFields({ name: `▸ /${json.name} ${s.name}`, value: truncate(`${s.description}\n${usage(`${json.name} ${s.name}`, s.options)}${opts ? `\n${opts}` : ''}`, 1024) });
    }
  } else {
    embed.addFields({ name: '📝 Kullanım', value: usage(json.name, json.options) });
    if (json.options?.length) embed.addFields({ name: '⚙️ Seçenekler', value: truncate(formatOptions(json.options), 1024) });
  }

  let who = 'Herkes';
  if (cmd.ownerOnly) who = '👑 Sadece bot yetkilileri';
  else if (json.default_member_permissions && json.default_member_permissions !== '0') {
    const names = new PermissionsBitField(BigInt(json.default_member_permissions)).toArray().map((p) => PERMISSION_NAMES[p] || p);
    who = `🛡️ "${names.join(', ')}" iznine sahip olanlar`;
  }
  embed.addFields({ name: '🔐 Kimler kullanabilir?', value: who });
  return embed.setFooter({ text: '[köşeli parantez] = isteğe bağlı • Başka bir komut seçebilirsin' });
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
        if (cat === 'ana') return interaction.update({ ...helpHome(client, ownerId), attachments: [] });
        if (cat === 'ozel' && !isOwner(interaction.user.id)) return replyFail(interaction, 'Bu kategori sadece bot yetkililerine açık.');
        return interaction.update({ embeds: [categoryEmbed(client, cat)], components: helpMenus(client, ownerId, cat), files: [files.logo()], attachments: [] });
      },
      async komut(interaction, [ownerId, cat], client) {
        if (interaction.user.id !== ownerId) return replyFail(interaction, 'Bu menü başkasına ait, kendi `/yardim` komutunu kullan.');
        const cmd = client.commands.get(interaction.values[0]);
        if (!cmd) return replyFail(interaction, 'Bu komut artık yok.');
        if (cmd.ownerOnly && !isOwner(interaction.user.id)) return replyFail(interaction, 'Bu komut sadece bot yetkililerine açık.');
        return interaction.update({ embeds: [commandDetail(cmd)], components: helpMenus(client, ownerId, cat, cmd.data.name), files: [files.logo()], attachments: [] });
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
