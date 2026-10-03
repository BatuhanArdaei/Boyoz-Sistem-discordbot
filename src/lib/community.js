// Arka plan topluluk sistemleri: Boyozboard (starboard), sabit mesaj (sticky), doğum günü kutlaması, sayaç kanalları.
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('./db');
const economy = require('./economy');
const { base } = require('./embeds');
const { truncate } = require('./util');
const { utcOffsetMinutes } = require('../config');

// ---------------------------------------------------------------- Boyozboard
const emojiKey = (e) => e.id || e.name;
async function onReaction(reaction) {
  if (reaction.partial) await reaction.fetch().catch(() => null);
  const message = reaction.message.partial ? await reaction.message.fetch().catch(() => null) : reaction.message;
  if (!message?.guild || message.author?.bot) return;
  const sb = db.guild(message.guild.id).starboard;
  if (!sb.channelId || message.channel.id === sb.channelId) return;
  const want = sb.emoji.match(/<a?:\w+:(\d+)>/)?.[1] || sb.emoji;
  if (emojiKey(reaction.emoji) !== want) return;
  const count = reaction.users.cache.filter((u) => u.id !== message.author.id).size || reaction.count;
  const board = message.guild.channels.cache.get(sb.channelId);
  if (!board?.isTextBased()) return;
  const existing = sb.posts[message.id];
  const content = `${sb.emoji} **${count}** • ${message.channel}`;
  if (existing) {
    const post = await board.messages.fetch(existing).catch(() => null);
    if (post) await post.edit({ content }).catch(() => {});
    return;
  }
  if (count < sb.threshold) return;
  const embed = base(0xf1c40f).setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
    .setDescription(`${truncate(message.content, 3800) || ''}\n\n[➡️ Mesaja git](${message.url})`).setTimestamp(message.createdTimestamp);
  const img = message.attachments.find((a) => a.contentType?.startsWith('image/'));
  if (img) embed.setImage(img.url);
  const post = await board.send({ content, embeds: [embed], allowedMentions: { parse: [] } }).catch(() => null);
  if (!post) return;
  sb.posts[message.id] = post.id;
  const keys = Object.keys(sb.posts);
  if (keys.length > 2000) for (const k of keys.slice(0, keys.length - 2000)) delete sb.posts[k];
  economy.add(message.guild.id, message.author.id, 25);
  db.save();
}

// ---------------------------------------------------------------- sabit mesaj
const stickyTimers = new Map();
function onMessage(message) {
  const entry = db.guild(message.guild.id).sticky[message.channel.id];
  if (!entry) return;
  clearTimeout(stickyTimers.get(message.channel.id));
  stickyTimers.set(message.channel.id, setTimeout(async () => {
    const e = db.guild(message.guild.id).sticky[message.channel.id];
    if (!e) return;
    if (e.messageId) await message.channel.messages.delete(e.messageId).catch(() => {});
    const msg = await message.channel.send({ embeds: [base().setDescription(`📌 ${e.text}`)] }).catch(() => null);
    if (msg) { e.messageId = msg.id; db.save(); }
  }, 4000)); // seri mesajlarda her seferinde tekrar atmasın
}

// ---------------------------------------------------------------- doğum günleri (her sabah 09:00 TR)
async function birthdays(client) {
  const local = new Date(Date.now() + utcOffsetMinutes * 60000);
  if (local.getUTCHours() < 9) return;
  const today = local.toISOString().slice(0, 10);
  for (const [guildId, g] of Object.entries(db.data.guilds)) {
    const b = g.birthdays;
    const guild = client.guilds.cache.get(guildId);
    if (!guild || !b?.channelId || b.lastRun === today) continue;
    b.lastRun = today;
    // Dünkü doğum günü rollerini al
    for (const id of b.active || []) {
      const m = await guild.members.fetch(id).catch(() => null);
      if (b.roleId) await m?.roles.remove(b.roleId).catch(() => {});
    }
    b.active = [];
    const todays = Object.entries(b.users).filter(([, x]) => x.d === local.getUTCDate() && x.m === local.getUTCMonth() + 1).map(([id]) => id);
    const channel = guild.channels.cache.get(b.channelId);
    for (const id of todays) {
      const m = await guild.members.fetch(id).catch(() => null);
      if (!m) continue;
      b.active.push(id);
      if (b.roleId) await m.roles.add(b.roleId, 'Doğum günü').catch(() => {});
      if (b.gift) economy.add(guildId, id, b.gift);
      await channel?.send({
        content: `🎉 ${m}`,
        embeds: [base(0xff73fa).setTitle('🎂 İyi ki doğdun!').setThumbnail(m.user.displayAvatarURL({ size: 256 }))
          .setDescription(`Bugün **${m.displayName}**'in doğum günü! 🥳 Hep birlikte kutlayalım!${b.gift ? `\n🎁 Hediye: **+${b.gift} 🥐**` : ''}`)],
        allowedMentions: { users: [id] },
      }).catch(() => {});
    }
    db.save();
  }
}

// ---------------------------------------------------------------- sayaç kanalları (10 dakikada bir)
async function counters(client) {
  for (const [guildId, g] of Object.entries(db.data.guilds)) {
    const c = g.counters;
    const guild = client.guilds.cache.get(guildId);
    if (!guild || !c?.member) continue;
    const voice = guild.voiceStates.cache.filter((v) => v.channelId && !v.member?.user.bot).size;
    const names = { member: `👥 Üye: ${guild.memberCount.toLocaleString('tr-TR')}`, voice: `🔊 Seste: ${voice}`, boost: `🚀 Boost: ${guild.premiumSubscriptionCount || 0}` };
    for (const [k, name] of Object.entries(names)) {
      const ch = c[k] && guild.channels.cache.get(c[k]);
      if (ch && ch.name !== name) await ch.setName(name).catch(() => {});
    }
  }
}

async function createCounters(guild) {
  const c = db.guild(guild.id).counters;
  const category = await guild.channels.create({ name: '📊 Sunucu İstatistik', type: ChannelType.GuildCategory, position: 0 });
  const make = (name) => guild.channels.create({
    name, type: ChannelType.GuildVoice, parent: category.id,
    permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.Connect] }],
  });
  c.member = (await make('👥 Üye: …')).id;
  c.voice = (await make('🔊 Seste: …')).id;
  c.boost = (await make('🚀 Boost: …')).id;
  c.categoryId = category.id;
  db.save();
}

function start(client) {
  setInterval(() => birthdays(client).catch((e) => console.warn('[doğum günü]', e.message)), 5 * 60000);
  setTimeout(() => birthdays(client).catch(() => {}), 20000);
  setInterval(() => counters(client).catch((e) => console.warn('[sayaç]', e.message)), 10 * 60000);
  setTimeout(() => counters(client).catch(() => {}), 15000);
}

module.exports = { onReaction, onMessage, start, createCounters, counters };
