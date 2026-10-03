// /ses-kilit: Ses kanalını kilitler; izin listesinde olmayan herkes girer girmez atılır (sadece bot yetkilileri).
const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ChannelType } = require('discord.js');
const db = require('../../lib/db');
const voicelock = require('../../lib/voicelock');
const { base, reply, replyOk, replyFail } = require('../../lib/embeds');

const voiceTypes = [ChannelType.GuildVoice, ChannelType.GuildStageVoice];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ses-kilit')
    .setDescription('👑 Ses kanalını kilitler: izinli olmayan herkes girer girmez sesten atılır.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName('ekle').setDescription('Kanalı kilitler (komutu kullanan otomatik izinli olur)')
      .addChannelOption((o) => o.setName('kanal').setDescription('Ses kanalı').setRequired(true).addChannelTypes(...voiceTypes)))
    .addSubcommand((s) => s.setName('kaldir').setDescription('Kanalın kilidini kaldırır')
      .addChannelOption((o) => o.setName('kanal').setDescription('Ses kanalı').setRequired(true).addChannelTypes(...voiceTypes)))
    .addSubcommand((s) => s.setName('izin').setDescription('Kişiye kanala girme izni verir / izni geri alır')
      .addChannelOption((o) => o.setName('kanal').setDescription('Ses kanalı').setRequired(true).addChannelTypes(...voiceTypes))
      .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true)))
    .addSubcommand((s) => s.setName('liste').setDescription('Kilitli kanalları ve izinlileri gösterir')),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const locks = voicelock.locks(interaction.guild.id);

    if (sub === 'liste') {
      const lines = Object.entries(locks).map(([id, l]) => `🔒 <#${id}> → izinli: ${l.allowed.map((u) => `<@${u}>`).join(' ') || 'kimse'}`);
      return reply(interaction, base().setTitle('🔒 Kilitli Ses Kanalları').setDescription(lines.join('\n') || 'Kilitli kanal yok.'));
    }

    const channel = interaction.options.getChannel('kanal');
    if (sub === 'ekle') {
      if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.MoveMembers)) return replyFail(interaction, 'Üyeleri sesten atabilmem için "Üyeleri Taşı" iznim olmalı.');
      locks[channel.id] ??= { allowed: [] };
      if (!locks[channel.id].allowed.includes(interaction.user.id)) locks[channel.id].allowed.push(interaction.user.id);
      db.save();
      await voicelock.sweep(client);
      return replyOk(interaction, `${channel} kilitlendi. İzinli: ${locks[channel.id].allowed.map((u) => `<@${u}>`).join(' ')}. Başka giren herkes atılacak.`);
    }
    if (!locks[channel.id]) return replyFail(interaction, 'Bu kanal kilitli değil.');
    if (sub === 'kaldir') {
      delete locks[channel.id];
      db.save();
      return replyOk(interaction, `${channel} kilidi kaldırıldı, herkes girebilir.`);
    }
    // izin
    const user = interaction.options.getUser('kullanici');
    const list = locks[channel.id].allowed;
    const i = list.indexOf(user.id);
    if (i >= 0) list.splice(i, 1); else list.push(user.id);
    db.save();
    if (i >= 0) await voicelock.sweep(client);
    return replyOk(interaction, i >= 0 ? `${user} artık ${channel} kanalına giremez (içerideyse atıldı).` : `${user} artık ${channel} kanalına girebilir.`);
  },
};
