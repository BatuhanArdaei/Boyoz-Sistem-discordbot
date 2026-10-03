// Duyuru mesajı oluşturma ve gönderme (anlık ve zamanlanmış duyurular ortak kullanır).
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { files, urls } = require('./embeds');
const { colors } = require('../config');

function mentionText(mention) {
  if (!mention) return { content: undefined, allowed: { parse: [] } };
  if (mention === 'everyone') return { content: '@everyone', allowed: { parse: ['everyone'] } };
  if (mention === 'here') return { content: '@here', allowed: { parse: ['everyone'] } };
  return { content: `<@&${mention}>`, allowed: { roles: [mention] } };
}

function buildAnnouncement(guild, a) {
  const embed = new EmbedBuilder()
    .setColor(a.color ?? colors.brand)
    .setAuthor({ name: `${guild.name} • Duyuru`, iconURL: guild.iconURL() || undefined })
    .setDescription(a.content)
    .setFooter({ text: 'Boyoz Sistem 🥐' })
    .setTimestamp();
  if (a.title) embed.setTitle(`📢 ${a.title}`);
  const attach = [];
  if (a.image) embed.setImage(a.image);
  else if (a.banner) { embed.setImage(urls.banner); attach.push(files.banner()); }
  if (a.authorId && a.showAuthor) embed.addFields({ name: '​', value: `— <@${a.authorId}>` });

  const { content, allowed } = mentionText(a.mention);
  return { content, embeds: [embed], files: attach, allowedMentions: allowed };
}

// Duyuruyu gönderir, gönderilen mesajı döner. Hata durumunda Error fırlatır.
async function sendAnnouncement(guild, a) {
  const channel = guild.channels.cache.get(a.channelId);
  if (!channel?.isTextBased()) throw new Error('Duyuru kanalı bulunamadı.');
  const perms = channel.permissionsFor(guild.members.me);
  if (!perms?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
    throw new Error(`${channel} kanalına mesaj gönderme iznim yok.`);
  }
  const msg = await channel.send(buildAnnouncement(guild, a));
  // Duyuru kanalıysa (announcement) takipçi sunuculara da yayınla
  if (a.publish && msg.crosspostable) await msg.crosspost().catch(() => {});
  if (a.react) await msg.react('🥐').catch(() => {});
  return msg;
}

module.exports = { buildAnnouncement, sendAnnouncement };
