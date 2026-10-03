// Uyarı sistemi ve sicil/vaka görüntüleme.
const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js');
const db = require('../../lib/db');
const { base, replyOk, replyFail, reply } = require('../../lib/embeds');
const { addWarning, createCase, caseEmbed, notifyUser, TYPES } = require('../../lib/modcase');
const { checkHierarchy, ts, truncate } = require('../../lib/util');
const { colors } = require('../../config');

const build = (name, desc) => new SlashCommandBuilder()
  .setName(name).setDescription(desc)
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setContexts(InteractionContextType.Guild);

module.exports = [
  {
    data: build('uyar', '⚠️ Kullanıcıya uyarı verir.')
      .addUserOption((o) => o.setName('kullanici').setDescription('Uyarılacak kullanıcı').setRequired(true))
      .addStringOption((o) => o.setName('sebep').setDescription('Sebep').setRequired(true).setMaxLength(400)),
    async execute(interaction) {
      const member = interaction.options.getMember('kullanici');
      const reason = interaction.options.getString('sebep');
      if (!member) return replyFail(interaction, 'Bu kullanıcı sunucuda değil.');
      if (member.user.bot) return replyFail(interaction, 'Botlar uyarılamaz.');
      const err = checkHierarchy(interaction, member);
      if (err) return replyFail(interaction, err);

      const { caseId, total } = await addWarning(interaction.guild, member.id, interaction.user.id, reason);
      const dmSent = await notifyUser(member.user, interaction.guild, 'warn', reason);
      const embed = base(colors.warning)
        .setTitle('⚠️ Uyarı Verildi')
        .setDescription(`${member} uyarıldı.`)
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
          { name: 'Sebep', value: reason },
          { name: 'Toplam Uyarı', value: String(total), inline: true },
          { name: 'Vaka', value: `#${caseId}`, inline: true },
        );
      if (!dmSent) embed.addFields({ name: 'Bilgi', value: 'Kullanıcıya DM gönderilemedi.', inline: true });
      await reply(interaction, embed, { ephemeral: false });
    },
  },
  {
    data: build('uyarilar', '📋 Kullanıcının uyarılarını listeler.')
      .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true)),
    async execute(interaction) {
      const user = interaction.options.getUser('kullanici');
      const list = db.guild(interaction.guild.id).warnings[user.id] || [];
      const embed = base(colors.warning).setTitle(`⚠️ ${user.tag} • ${list.length} uyarı`).setThumbnail(user.displayAvatarURL());
      embed.setDescription(list.length
        ? list.slice(-15).reverse().map((w) => `**#${w.id}** • ${ts(w.at, 'd')} • <@${w.modId}>\n└ ${truncate(w.reason || 'Belirtilmedi', 200)}`).join('\n')
        : 'Bu kullanıcının hiç uyarısı yok. 😇');
      await reply(interaction, embed);
    },
  },
  {
    data: build('uyari-sil', '🧽 Kullanıcının bir veya tüm uyarılarını siler.')
      .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
      .addIntegerOption((o) => o.setName('uyari-id').setDescription('Silinecek uyarının numarası (boş = tümü)')),
    async execute(interaction) {
      const user = interaction.options.getUser('kullanici');
      const id = interaction.options.getInteger('uyari-id');
      const g = db.guild(interaction.guild.id);
      const list = g.warnings[user.id] || [];
      if (!list.length) return replyFail(interaction, 'Bu kullanıcının uyarısı yok.');
      let removed;
      if (id) {
        const idx = list.findIndex((w) => w.id === id);
        if (idx === -1) return replyFail(interaction, `#${id} numaralı uyarı bulunamadı.`);
        removed = list.splice(idx, 1).length;
      } else {
        removed = list.length;
        delete g.warnings[user.id];
      }
      db.save();
      await createCase(interaction.guild, { type: 'unwarn', targetId: user.id, modId: interaction.user.id, reason: id ? `#${id} numaralı uyarı silindi` : 'Tüm uyarılar silindi' });
      return replyOk(interaction, `${user} kullanıcısının ${removed} uyarısı silindi.`);
    },
  },
  {
    data: build('sicil', '📁 Kullanıcının tüm moderasyon geçmişini gösterir.')
      .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true)),
    async execute(interaction) {
      const user = interaction.options.getUser('kullanici');
      const cases = db.guild(interaction.guild.id).cases.filter((c) => c.targetId === user.id);
      const counts = {};
      for (const c of cases) counts[c.type] = (counts[c.type] || 0) + 1;
      const summary = Object.entries(counts).map(([t, n]) => `${TYPES[t]?.emoji || '•'} ${TYPES[t]?.label || t}: **${n}**`).join(' • ');
      const embed = base().setTitle(`📁 ${user.tag} • Sicil`).setThumbnail(user.displayAvatarURL())
        .setDescription(cases.length
          ? `${summary}\n\n${cases.slice(-12).reverse().map((c) => `**#${c.id}** ${TYPES[c.type]?.emoji || ''} ${TYPES[c.type]?.label || c.type} • ${ts(c.at, 'd')}\n└ ${truncate(c.reason || 'Belirtilmedi', 150)}`).join('\n')}`
          : 'Temiz sicil. 🥐');
      await reply(interaction, embed);
    },
  },
  {
    data: build('vaka', '🔎 Bir moderasyon vakasının detayını gösterir.')
      .addIntegerOption((o) => o.setName('numara').setDescription('Vaka numarası').setRequired(true).setMinValue(1)),
    async execute(interaction) {
      const id = interaction.options.getInteger('numara');
      const c = db.guild(interaction.guild.id).cases.find((x) => x.id === id);
      if (!c) return replyFail(interaction, `#${id} numaralı vaka bulunamadı.`);
      await reply(interaction, caseEmbed(c));
    },
  },
];

// Discord'un 100 komut sınırı için alt komutlara birleştirilir: /uyari ver|liste|sil|ceza, /sicil kullanici|vaka
const { regroup } = require('../../lib/group');
const { ceza } = require('./ekstra');

module.exports = regroup(module.exports, [
  {
    name: 'uyari', description: '⚠️ Uyarı sistemi: uyar, listele, sil, otomatik cezalar.', perm: PermissionFlagsBits.ModerateMembers,
    parts: [
      { sub: 'ver', from: 'uyar' }, { sub: 'liste', from: 'uyarilar' }, { sub: 'sil', from: 'uyari-sil' },
      { sub: 'ceza', from: 'uyari-ceza', cmd: ceza, perm: PermissionFlagsBits.ManageGuild },
    ],
  },
  {
    name: 'sicil', description: '📁 Moderasyon geçmişi ve vaka detayları.', perm: PermissionFlagsBits.ModerateMembers,
    parts: [{ sub: 'kullanici', from: 'sicil' }, { sub: 'vaka', from: 'vaka' }],
  },
]);
