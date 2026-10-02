// Sunucu log kanallarına kayıt gönderir.
const { PermissionFlagsBits } = require('discord.js');
const db = require('./db');

const LOG_TYPES = {
  mesaj: '💬 Mesaj (silme, düzenleme)',
  uye: '👥 Üye (giriş, çıkış, rol, isim)',
  ses: '🔊 Ses (giriş, çıkış, geçiş)',
  sunucu: '🛠️ Sunucu (kanal, rol değişiklikleri)',
  moderasyon: '🛡️ Moderasyon (ban, kick, susturma, uyarı, automod)',
};

async function sendLog(guild, type, payload) {
  if (!guild) return;
  const channelId = db.guild(guild.id).logs[type];
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId);
  if (!channel?.isTextBased()) return;
  const perms = channel.permissionsFor(guild.members.me);
  if (!perms?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) return;
  const message = payload.data ? { embeds: [payload] } : payload; // EmbedBuilder veya mesaj payload'ı
  await channel.send({ ...message, allowedMentions: { parse: [] } }).catch((err) => {
    console.warn(`[log] ${guild.name} / ${type} gönderilemedi:`, err.message);
  });
}

module.exports = { sendLog, LOG_TYPES };
