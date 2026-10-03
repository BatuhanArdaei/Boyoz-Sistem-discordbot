// /ozel-oda: Join-to-create özel oda sistemi ve oda kontrol paneli butonları.
const {
  SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ChannelType, ActionRowBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder, MessageFlags,
} = require('discord.js');
const db = require('../../lib/db');
const rooms = require('../../lib/rooms');
const { replyOk, replyFail } = require('../../lib/embeds');

// Butona basanın oda sahibi olup olmadığını kontrol eder
function ownerCheck(interaction, channelId, { allowClaim = false } = {}) {
  const c = rooms.cfg(interaction.guild.id);
  const channel = interaction.guild.channels.cache.get(channelId);
  if (!channel || !c.active[channelId]) return { error: 'Bu oda artık yok.' };
  if (!allowClaim && c.active[channelId] !== interaction.user.id) return { error: 'Bu odanın sahibi değilsin.' };
  return { channel, c };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ozel-oda')
    .setDescription('🔊 "Oda Oluştur" kanalına girenlere kişisel ses odası açan sistemi kurar.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName('kur').setDescription('Özel oda kategorisini ve "Oda Oluştur" kanalını oluşturur'))
    .addSubcommand((s) => s.setName('kapat').setDescription('Sistemi kapatır (kanallar silinmez)')),

  async execute(interaction) {
    const c = rooms.cfg(interaction.guild.id);
    if (interaction.options.getSubcommand() === 'kapat') {
      c.hubId = null; db.save();
      return replyOk(interaction, 'Özel oda sistemi kapatıldı.');
    }
    const me = interaction.guild.members.me;
    if (!me.permissions.has([PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers])) {
      return replyFail(interaction, '"Kanalları Yönet" ve "Üyeleri Taşı" iznim olmalı.');
    }
    const category = await interaction.guild.channels.create({ name: '🥐 Özel Odalar', type: ChannelType.GuildCategory });
    const hub = await interaction.guild.channels.create({ name: '➕ Oda Oluştur', type: ChannelType.GuildVoice, parent: category.id, userLimit: 1 });
    Object.assign(c, { hubId: hub.id, categoryId: category.id });
    db.save();
    return replyOk(interaction, `Kuruldu! ${hub} kanalına giren herkese kendi odası açılacak. Oda boşalınca silinir. 🔊`);
  },

  components: {
    async kilit(interaction, [id]) {
      const { channel, error } = ownerCheck(interaction, id);
      if (error) return replyFail(interaction, error);
      const locked = channel.permissionOverwrites.cache.get(interaction.guild.id)?.deny.has(PermissionFlagsBits.Connect);
      await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: locked ? null : false });
      return replyOk(interaction, locked ? '🔓 Oda herkese açıldı.' : '🔒 Oda kilitlendi, sadece izin verdiklerin girebilir.');
    },
    async gizle(interaction, [id]) {
      const { channel, error } = ownerCheck(interaction, id);
      if (error) return replyFail(interaction, error);
      const hidden = channel.permissionOverwrites.cache.get(interaction.guild.id)?.deny.has(PermissionFlagsBits.ViewChannel);
      await channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: hidden ? null : false });
      return replyOk(interaction, hidden ? '👁️ Oda tekrar görünür.' : '🙈 Oda gizlendi.');
    },
    async limit(interaction, [id]) {
      const { error } = ownerCheck(interaction, id);
      if (error) return replyFail(interaction, error);
      return interaction.showModal(new ModalBuilder().setCustomId(`ozel-oda:limitkaydet:${id}`).setTitle('Kişi limiti').addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('n').setLabel('0-99 (0 = sınırsız)').setStyle(TextInputStyle.Short).setMaxLength(2).setRequired(true)),
      ));
    },
    async limitkaydet(interaction, [id]) {
      const { channel, error } = ownerCheck(interaction, id);
      if (error) return replyFail(interaction, error);
      const n = Number(interaction.fields.getTextInputValue('n'));
      if (!Number.isInteger(n) || n < 0 || n > 99) return replyFail(interaction, '0 ile 99 arasında bir sayı gir.');
      await channel.setUserLimit(n);
      return replyOk(interaction, n ? `👥 Limit **${n}** kişi.` : '👥 Limit kaldırıldı.');
    },
    async isim(interaction, [id]) {
      const { error } = ownerCheck(interaction, id);
      if (error) return replyFail(interaction, error);
      return interaction.showModal(new ModalBuilder().setCustomId(`ozel-oda:isimkaydet:${id}`).setTitle('Oda ismi').addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ad').setLabel('Yeni isim').setStyle(TextInputStyle.Short).setMaxLength(90).setRequired(true)),
      ));
    },
    async isimkaydet(interaction, [id]) {
      const { channel, error } = ownerCheck(interaction, id);
      if (error) return replyFail(interaction, error);
      await channel.setName(interaction.fields.getTextInputValue('ad')).catch(() => {});
      return replyOk(interaction, '✏️ İsim güncellendi. (Discord isim değişikliğini 10 dakikada 2 kez sınırlar.)');
    },
    async izin(interaction, [id]) {
      const { error } = ownerCheck(interaction, id);
      if (error) return replyFail(interaction, error);
      return interaction.reply({ components: [new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`ozel-oda:izinver:${id}`).setPlaceholder('Odaya girebilecek kişileri seç').setMaxValues(10))], flags: MessageFlags.Ephemeral });
    },
    async izinver(interaction, [id]) {
      const { channel, error } = ownerCheck(interaction, id);
      if (error) return replyFail(interaction, error);
      for (const uid of interaction.values) await channel.permissionOverwrites.edit(uid, { Connect: true, ViewChannel: true }).catch(() => {});
      return interaction.update({ content: `✅ ${interaction.values.map((u) => `<@${u}>`).join(' ')} artık odana girebilir.`, components: [] });
    },
    async at(interaction, [id]) {
      const { error } = ownerCheck(interaction, id);
      if (error) return replyFail(interaction, error);
      return interaction.reply({ components: [new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`ozel-oda:atkaydet:${id}`).setPlaceholder('Atılacak kişileri seç').setMaxValues(10))], flags: MessageFlags.Ephemeral });
    },
    async atkaydet(interaction, [id]) {
      const { channel, error } = ownerCheck(interaction, id);
      if (error) return replyFail(interaction, error);
      const kicked = [];
      for (const uid of interaction.values) {
        if (uid === interaction.user.id) continue;
        await channel.permissionOverwrites.edit(uid, { Connect: false }).catch(() => {});
        const m = channel.members.get(uid);
        if (m) { await m.voice.disconnect('Özel odadan atıldı').catch(() => {}); kicked.push(uid); }
      }
      return interaction.update({ content: `👢 Seçilenler odaya giremez${kicked.length ? `, ${kicked.map((u) => `<@${u}>`).join(' ')} atıldı` : ''}.`, components: [] });
    },
    async devral(interaction, [id]) {
      const { channel, c, error } = ownerCheck(interaction, id, { allowClaim: true });
      if (error) return replyFail(interaction, error);
      if (c.active[id] === interaction.user.id) return replyFail(interaction, 'Zaten odanın sahibisin.');
      if (channel.members.has(c.active[id])) return replyFail(interaction, 'Oda sahibi hâlâ odada.');
      if (!channel.members.has(interaction.user.id)) return replyFail(interaction, 'Sahipliği almak için odada olmalısın.');
      c.active[id] = interaction.user.id; db.save();
      await channel.permissionOverwrites.edit(interaction.user.id, { Connect: true, ViewChannel: true, MoveMembers: true }).catch(() => {});
      return interaction.reply({ content: `👑 ${interaction.user} odanın yeni sahibi!`, allowedMentions: { parse: [] } });
    },
  },
};
