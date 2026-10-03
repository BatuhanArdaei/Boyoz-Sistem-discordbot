// /ticket (destek talebi sistemi) ve /sayac (sunucu istatistik kanalları)
const {
  SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags,
} = require('discord.js');
const db = require('../../lib/db');
const community = require('../../lib/community');
const { base, replyOk, replyFail } = require('../../lib/embeds');
const { sendLog } = require('../../lib/logger');
const { colors } = require('../../config');

const T = (gid) => db.guild(gid).tickets;
const isStaff = (i, t) => i.member.permissions.has(PermissionFlagsBits.ManageMessages) || (t.staffRoleId && i.member.roles.cache.has(t.staffRoleId));

async function transcript(channel) {
  let all = []; let before;
  for (let i = 0; i < 10; i++) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch?.size) break;
    all = all.concat([...batch.values()]);
    before = batch.last().id;
  }
  const lines = all.reverse().map((m) => `[${new Date(m.createdTimestamp).toLocaleString('tr-TR')}] ${m.author.tag}: ${m.content || ''}${m.embeds.length ? ' [embed]' : ''}${m.attachments.size ? ` [ek: ${m.attachments.map((a) => a.url).join(', ')}]` : ''}`);
  return new AttachmentBuilder(Buffer.from(lines.join('\n'), 'utf8'), { name: `${channel.name}.txt` });
}

module.exports = [
  {
    data: new SlashCommandBuilder().setName('ticket').setDescription('🎫 Destek talebi (ticket) sistemi.').setContexts(InteractionContextType.Guild)
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((s) => s.setName('kur').setDescription('Bu kanala "Talep Aç" panelini kurar')
        .addRoleOption((o) => o.setName('yetkili').setDescription('Talepleri görecek yetkili rolü'))
        .addChannelOption((o) => o.setName('log').setDescription('Kapanan taleplerin dökümünün gideceği kanal').addChannelTypes(ChannelType.GuildText))
        .addStringOption((o) => o.setName('mesaj').setDescription('Panel açıklaması').setMaxLength(1000))),
    async execute(interaction) {
      const t = T(interaction.guild.id);
      if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) return replyFail(interaction, '"Kanalları Yönet" iznim olmalı.');
      let category = t.categoryId && interaction.guild.channels.cache.get(t.categoryId);
      if (!category) category = await interaction.guild.channels.create({ name: '🎫 Destek Talepleri', type: ChannelType.GuildCategory, permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] }] });
      Object.assign(t, { categoryId: category.id, staffRoleId: interaction.options.getRole('yetkili')?.id || t.staffRoleId, logChannelId: interaction.options.getChannel('log')?.id || t.logChannelId });
      db.save();
      await interaction.channel.send({
        embeds: [base().setTitle('🎫 Destek Talebi').setDescription(interaction.options.getString('mesaj') || 'Bir sorunun, şikayetin ya da önerin mi var?\nAşağıdaki butona bas, sana özel bir kanal açalım. Yetkililerimiz en kısa sürede yardımcı olacak! 🥐')],
        components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket:ac').setLabel('Talep Aç').setEmoji('🎫').setStyle(ButtonStyle.Primary))],
      });
      return replyOk(interaction, 'Ticket paneli kuruldu.');
    },
    components: {
      async ac(interaction) {
        return interaction.showModal(new ModalBuilder().setCustomId('ticket:olustur').setTitle('🎫 Destek Talebi').addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('konu').setLabel('Konu nedir?').setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(true)),
        ));
      },
      async olustur(interaction) {
        const t = T(interaction.guild.id);
        const open = Object.entries(t.open).find(([, uid]) => uid === interaction.user.id);
        if (open && interaction.guild.channels.cache.has(open[0])) return replyFail(interaction, `Zaten açık bir talebin var: <#${open[0]}>`);
        t.count += 1;
        const overwrites = [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] },
          { id: interaction.guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
        ];
        if (t.staffRoleId) overwrites.push({ id: t.staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
        const ch = await interaction.guild.channels.create({ name: `talep-${String(t.count).padStart(4, '0')}`, type: ChannelType.GuildText, parent: t.categoryId, permissionOverwrites: overwrites, topic: `${interaction.user.tag} tarafından açıldı` });
        t.open[ch.id] = interaction.user.id;
        db.save();
        await ch.send({
          content: `${interaction.user}${t.staffRoleId ? ` <@&${t.staffRoleId}>` : ''}`,
          embeds: [base().setTitle(`🎫 Talep #${t.count}`).setDescription(`**Konu:** ${interaction.fields.getTextInputValue('konu')}\n\nYetkililer birazdan burada olacak. İşin bitince talebi kapatabilirsin.`)],
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket:kapat').setLabel('Talebi Kapat').setEmoji('🔒').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('ticket:sahiplen').setLabel('Sahiplen').setEmoji('🙋').setStyle(ButtonStyle.Secondary),
          )],
          allowedMentions: { users: [interaction.user.id], roles: t.staffRoleId ? [t.staffRoleId] : [] },
        });
        return replyOk(interaction, `Talebin açıldı: ${ch}`);
      },
      async sahiplen(interaction) {
        const t = T(interaction.guild.id);
        if (!isStaff(interaction, t)) return replyFail(interaction, 'Sadece yetkililer sahiplenebilir.');
        return interaction.reply({ embeds: [base(colors.success).setDescription(`🙋 ${interaction.user} bu talebi üstlendi.`)] });
      },
      async kapat(interaction) {
        const t = T(interaction.guild.id);
        const ownerId = t.open[interaction.channelId];
        if (!ownerId) return replyFail(interaction, 'Bu bir talep kanalı değil.');
        if (interaction.user.id !== ownerId && !isStaff(interaction, t)) return replyFail(interaction, 'Bu talebi kapatamazsın.');
        await interaction.reply({ embeds: [base(colors.warning).setDescription('🔒 Talep kapatılıyor, döküm kaydediliyor... 5 saniye içinde kanal silinecek.')] });
        const file = await transcript(interaction.channel);
        const info = base().setTitle(`🎫 ${interaction.channel.name} kapandı`).addFields({ name: 'Açan', value: `<@${ownerId}>`, inline: true }, { name: 'Kapatan', value: `${interaction.user}`, inline: true });
        const logCh = t.logChannelId && interaction.guild.channels.cache.get(t.logChannelId);
        if (logCh) await logCh.send({ embeds: [info], files: [file] }).catch(() => {});
        else await sendLog(interaction.guild, 'moderasyon', { embeds: [info], files: [file] });
        const owner = await interaction.client.users.fetch(ownerId).catch(() => null);
        await owner?.send({ embeds: [base().setDescription(`🎫 **${interaction.guild.name}** sunucusundaki talebin kapatıldı. Döküm ektedir.`)], files: [await transcript(interaction.channel)] }).catch(() => {});
        delete t.open[interaction.channelId];
        db.save();
        setTimeout(() => interaction.channel.delete('Talep kapatıldı').catch(() => {}), 5000);
      },
    },
  },
  {
    data: new SlashCommandBuilder().setName('sayac').setDescription('📊 Üye, ses ve boost sayısını gösteren kanallar.').setContexts(InteractionContextType.Guild)
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((s) => s.setName('kur').setDescription('Sayaç kanallarını oluşturur'))
      .addSubcommand((s) => s.setName('kaldir').setDescription('Sayaç kanallarını siler')),
    async execute(interaction) {
      const c = db.guild(interaction.guild.id).counters;
      if (interaction.options.getSubcommand() === 'kaldir') {
        for (const k of ['member', 'voice', 'boost', 'categoryId']) {
          if (c[k]) await interaction.guild.channels.cache.get(c[k])?.delete().catch(() => {});
          c[k] = null;
        }
        db.save();
        return replyOk(interaction, 'Sayaç kanalları silindi.');
      }
      if (c.member && interaction.guild.channels.cache.has(c.member)) return replyFail(interaction, 'Sayaçlar zaten kurulu.');
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await community.createCounters(interaction.guild);
      await community.counters(interaction.client);
      return interaction.editReply('✅ Sayaç kanalları kuruldu, 10 dakikada bir güncellenir.');
    },
  },
];
