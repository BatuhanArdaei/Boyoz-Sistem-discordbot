// Kilitli ses kanalları: izin listesinde olmayan herkes (bot hariç) girer girmez sesten atılır.
const { PermissionFlagsBits } = require('discord.js');
const db = require('./db');
const { base } = require('./embeds');
const { sendLog } = require('./logger');

const locks = (guildId) => db.guild(guildId).voiceLocks;

async function kick(member, channel) {
  if (!member.guild.members.me.permissions.has(PermissionFlagsBits.MoveMembers)) return;
  const ok = await member.voice.disconnect('Kilitli ses kanalı').then(() => true).catch(() => false);
  if (!ok) return;
  await sendLog(member.guild, 'ses', base(0xed4245).setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
    .setDescription(`🔒 ${member} kilitli **${channel.name}** kanalına girmeye çalıştı ve sesten atıldı.`));
}

function allowed(member, lock) {
  return member.id === member.guild.members.me.id || lock.allowed.includes(member.id);
}

async function onVoice(oldState, newState) {
  if (!newState.channelId || newState.channelId === oldState.channelId) return;
  const lock = locks(newState.guild.id)[newState.channelId];
  const member = newState.member;
  if (!lock || !member || allowed(member, lock)) return;
  await kick(member, newState.channel);
}

// Bot kapalıyken kilitli kanala girmiş olanları da temizle
async function sweep(client) {
  for (const guild of client.guilds.cache.values()) {
    for (const [channelId, lock] of Object.entries(locks(guild.id))) {
      const channel = guild.channels.cache.get(channelId);
      for (const member of channel?.members?.values() || []) if (!allowed(member, lock)) await kick(member, channel);
    }
  }
}

module.exports = { onVoice, sweep, locks };
