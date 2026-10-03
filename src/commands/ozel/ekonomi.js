// /boyoz-yonet: Bot yetkililerinin boyoz ekonomisine müdahalesi. Her işlem moderasyon log kanalına düşer.
const {
  SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const db = require('../../lib/db');
const economy = require('../../lib/economy');
const { base, reply, replyFail } = require('../../lib/embeds');
const { sendLog } = require('../../lib/logger');
const { ts } = require('../../lib/util');
const { colors } = require('../../config');

const { fmt } = economy;
const COOLDOWNS = { lastDaily: 'Günlük ödül', lastWork: 'Çalışma', lastSpin: 'Şans çarkı' };

async function logAction(interaction, title, details) {
  await sendLog(interaction.guild, 'moderasyon', base(colors.brand).setTitle(`🥐 Boyoz Yönetimi • ${title}`)
    .setDescription(details).addFields({ name: 'Yetkili', value: `${interaction.user} (\`${interaction.user.id}\`)` }));
}

async function notify(user, guild, text) {
  await user.send({ embeds: [base().setAuthor({ name: guild.name, iconURL: guild.iconURL() || undefined }).setDescription(text)] }).catch(() => {});
}

const userOpt = (o) => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true);
const amountOpt = (o) => o.setName('miktar').setDescription('Boyoz miktarı').setRequired(true).setMinValue(1).setMaxValue(10_000_000);
const reasonOpt = (o) => o.setName('sebep').setDescription('Sebep (log\'a ve DM\'e yazılır)').setMaxLength(200);
const dmOpt = (o) => o.setName('bildir').setDescription('Kullanıcıya DM ile haber ver');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('boyoz-yonet')
    .setDescription('👑 Boyoz ekonomisini yönetir: puan ver, al, ayarla, sıfırla.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName('ver').setDescription('Kullanıcıya boyoz verir')
      .addUserOption(userOpt).addIntegerOption(amountOpt).addStringOption(reasonOpt).addBooleanOption(dmOpt))
    .addSubcommand((s) => s.setName('al').setDescription('Kullanıcıdan boyoz alır')
      .addUserOption(userOpt).addIntegerOption(amountOpt).addStringOption(reasonOpt).addBooleanOption(dmOpt))
    .addSubcommand((s) => s.setName('ayarla').setDescription('Kullanıcının bakiyesini tam olarak bu değere ayarlar')
      .addUserOption(userOpt)
      .addIntegerOption((o) => o.setName('miktar').setDescription('Yeni bakiye').setRequired(true).setMinValue(0).setMaxValue(10_000_000))
      .addStringOption(reasonOpt))
    .addSubcommand((s) => s.setName('sifirla').setDescription('Kullanıcının bakiyesini veya bekleme sürelerini sıfırlar')
      .addUserOption(userOpt)
      .addStringOption((o) => o.setName('ne').setDescription('Neyi sıfırlayalım?').setRequired(true).addChoices(
        { name: 'Bakiye (0 yap)', value: 'bakiye' },
        { name: 'Bekleme süreleri (günlük, çalış, çark hemen kullanılabilsin)', value: 'sureler' },
        { name: 'Her şey (bakiye, yenen boyoz, seri, galibiyet, süreler)', value: 'hepsi' },
      )))
    .addSubcommand((s) => s.setName('toplu-ver').setDescription('Bir roldeki herkese boyoz verir')
      .addRoleOption((o) => o.setName('rol').setDescription('Rol (@everyone = herkes)').setRequired(true))
      .addIntegerOption(amountOpt).addStringOption(reasonOpt))
    .addSubcommand((s) => s.setName('bilgi').setDescription('Kullanıcının tüm ekonomi bilgilerini gösterir')
      .addUserOption(userOpt))
    .addSubcommand((s) => s.setName('herkesi-sifirla').setDescription('⚠️ Sunucudaki TÜM boyoz ekonomisini sıfırlar (onay ister)')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const gid = interaction.guild.id;
    const user = interaction.options.getUser('kullanici');
    const amount = interaction.options.getInteger('miktar');
    const reason = interaction.options.getString('sebep');
    const reasonText = reason ? `\n📝 Sebep: ${reason}` : '';

    if (user?.bot) return replyFail(interaction, 'Botların cüzdanı olmaz. 🤖');

    switch (sub) {
      case 'ver': {
        const bal = economy.add(gid, user.id, amount);
        await logAction(interaction, 'Boyoz verildi', `${user} → +${fmt(amount)}\nYeni bakiye: ${fmt(bal)}${reasonText}`);
        if (interaction.options.getBoolean('bildir')) await notify(user, interaction.guild, `🎁 Hesabına ${fmt(amount)} eklendi!${reasonText}\nYeni bakiye: ${fmt(bal)}`);
        return reply(interaction, base(colors.success).setDescription(`🎁 ${user} kullanıcısına +${fmt(amount)} verildi.\nYeni bakiye: ${fmt(bal)}${reasonText}`));
      }
      case 'al': {
        const before = economy.wallet(gid, user.id).balance;
        const bal = economy.add(gid, user.id, -amount);
        const taken = before - bal;
        await logAction(interaction, 'Boyoz alındı', `${user} → -${fmt(taken)}\nYeni bakiye: ${fmt(bal)}${reasonText}`);
        if (interaction.options.getBoolean('bildir')) await notify(user, interaction.guild, `💸 Hesabından ${fmt(taken)} düşüldü.${reasonText}\nYeni bakiye: ${fmt(bal)}`);
        return reply(interaction, base(colors.warning).setDescription(`💸 ${user} kullanıcısından -${fmt(taken)} alındı${taken < amount ? ` (bakiyesi yetmediği için ${amount} yerine)` : ''}.\nYeni bakiye: ${fmt(bal)}${reasonText}`));
      }
      case 'ayarla': {
        const w = economy.wallet(gid, user.id);
        const before = w.balance;
        w.balance = amount;
        db.save();
        await logAction(interaction, 'Bakiye ayarlandı', `${user}: ${fmt(before)} → ${fmt(amount)}${reasonText}`);
        return reply(interaction, base(colors.success).setDescription(`✏️ ${user} bakiyesi ${fmt(before)} → ${fmt(amount)} olarak ayarlandı.${reasonText}`));
      }
      case 'sifirla': {
        const what = interaction.options.getString('ne');
        const w = economy.wallet(gid, user.id);
        if (what === 'bakiye') w.balance = 0;
        if (what === 'sureler') for (const k of Object.keys(COOLDOWNS)) w[k] = 0;
        if (what === 'hepsi') Object.assign(w, { balance: 0, eaten: 0, lastDaily: 0, streak: 0, lastWork: 0, lastSpin: 0, wins: 0 });
        db.save();
        const label = { bakiye: 'bakiyesi', sureler: 'bekleme süreleri', hepsi: 'tüm ekonomi verileri' }[what];
        await logAction(interaction, 'Sıfırlama', `${user} kullanıcısının ${label} sıfırlandı.`);
        return reply(interaction, base(colors.success).setDescription(`🔄 ${user} kullanıcısının **${label}** sıfırlandı.`));
      }
      case 'toplu-ver': {
        const role = interaction.options.getRole('rol');
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await interaction.guild.members.fetch().catch(() => {});
        const members = role.id === gid
          ? interaction.guild.members.cache.filter((m) => !m.user.bot)
          : role.members.filter((m) => !m.user.bot);
        for (const m of members.values()) economy.add(gid, m.id, amount);
        await logAction(interaction, 'Toplu boyoz', `${role} rolündeki **${members.size}** kişiye +${fmt(amount)} verildi.${reasonText}`);
        return interaction.editReply({ embeds: [base(colors.success).setDescription(`🎉 ${role} rolündeki **${members.size}** kişiye +${fmt(amount)} verildi.\nToplam dağıtılan: ${fmt(amount * members.size)}${reasonText}`)] });
      }
      case 'bilgi': {
        const w = economy.wallet(gid, user.id);
        const rank = Object.entries(db.guild(gid).economy).sort((a, b) => b[1].balance - a[1].balance).findIndex(([id]) => id === user.id) + 1;
        const cd = (k, ms) => (Date.now() - (w[k] || 0) >= ms ? '✅ Hazır' : ts((w[k] || 0) + ms, 'R'));
        return reply(interaction, base().setAuthor({ name: user.username, iconURL: user.displayAvatarURL() }).setTitle('👛 Ekonomi Bilgisi').addFields(
          { name: 'Bakiye', value: fmt(w.balance), inline: true },
          { name: 'Sıralama', value: rank ? `#${rank}` : '—', inline: true },
          { name: 'Galibiyet', value: String(w.wins || 0), inline: true },
          { name: 'Yenen boyoz', value: String(w.eaten || 0), inline: true },
          { name: 'Günlük seri', value: `🔥 ${w.streak || 0}`, inline: true },
          { name: '​', value: '​', inline: true },
          { name: 'Günlük ödül', value: cd('lastDaily', 864e5), inline: true },
          { name: 'Çalışma', value: cd('lastWork', 36e5), inline: true },
          { name: 'Şans çarkı', value: cd('lastSpin', 3 * 36e5), inline: true },
        ));
      }
      case 'herkesi-sifirla': {
        const count = Object.keys(db.guild(gid).economy).length;
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('eco-reset:evet').setLabel(`Evet, ${count} cüzdanı sıfırla`).setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('eco-reset:hayir').setLabel('Vazgeç').setStyle(ButtonStyle.Secondary),
        );
        const res = await interaction.reply({
          embeds: [base(colors.error).setTitle('⚠️ Emin misin?').setDescription(`Sunucudaki **${count}** kişinin tüm boyozları, serileri ve istatistikleri silinecek. **Bu işlem geri alınamaz.**`)],
          components: [row], flags: MessageFlags.Ephemeral, withResponse: true,
        });
        try {
          const btn = await res.resource.message.awaitMessageComponent({ time: 30000 });
          if (btn.customId !== 'eco-reset:evet') return btn.update({ embeds: [base().setDescription('İptal edildi.')], components: [] });
          db.guild(gid).economy = {};
          db.save();
          await logAction(interaction, 'TÜM EKONOMİ SIFIRLANDI', `**${count}** cüzdan silindi.`);
          return btn.update({ embeds: [base(colors.success).setDescription(`🔄 Tüm boyoz ekonomisi sıfırlandı (${count} cüzdan).`)], components: [] });
        } catch {
          return interaction.editReply({ embeds: [base().setDescription('⏰ Süre doldu, hiçbir şey silinmedi.')], components: [] });
        }
      }
      default:
        return replyFail(interaction, 'Bilinmeyen işlem.');
    }
  },
};
