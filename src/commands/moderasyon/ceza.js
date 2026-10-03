// Ban, süreli ban, unban, kick, susturma (timeout) komutları.
const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js');
const db = require('../../lib/db');
const { base, replyFail, reply } = require('../../lib/embeds');
const { createCase, notifyUser, TYPES } = require('../../lib/modcase');
const { checkHierarchy, parseDuration, formatDuration, ts } = require('../../lib/util');

const MAX_TIMEOUT = 28 * 864e5;

const build = (name, desc, perm) => new SlashCommandBuilder()
  .setName(name).setDescription(desc)
  .setDefaultMemberPermissions(perm)
  .setContexts(InteractionContextType.Guild);

function resultEmbed(type, user, reason, caseId, { duration, dmSent, extra } = {}) {
  const t = TYPES[type];
  const embed = base(t.color)
    .setTitle(`${t.emoji} ${t.label}`)
    .setDescription(`**${user.tag}** (${user}) için işlem uygulandı.`)
    .setThumbnail(user.displayAvatarURL())
    .addFields({ name: 'Sebep', value: reason || 'Belirtilmedi' });
  if (duration) embed.addFields({ name: 'Süre', value: formatDuration(duration), inline: true });
  if (extra) embed.addFields({ name: 'Bitiş', value: extra, inline: true });
  embed.addFields({ name: 'Vaka', value: `#${caseId}`, inline: true });
  if (dmSent === false) embed.addFields({ name: 'Bilgi', value: 'Kullanıcıya DM gönderilemedi.', inline: true });
  return embed;
}

module.exports = [
  // ---------------------------------------------------------------- /ban
  {
    data: build('ban', '🔨 Kullanıcıyı sunucudan yasaklar (isteğe bağlı süreli).', PermissionFlagsBits.BanMembers)
      .addUserOption((o) => o.setName('kullanici').setDescription('Yasaklanacak kullanıcı').setRequired(true))
      .addStringOption((o) => o.setName('sebep').setDescription('Sebep').setMaxLength(400))
      .addStringOption((o) => o.setName('sure').setDescription('Süreli ban: 30m, 12h, 7d... (boş = kalıcı)'))
      .addIntegerOption((o) => o.setName('mesaj-sil').setDescription('Son kaç günün mesajları silinsin? (0-7)').setMinValue(0).setMaxValue(7)),
    async execute(interaction) {
      const user = interaction.options.getUser('kullanici');
      const member = interaction.options.getMember('kullanici');
      const reason = interaction.options.getString('sebep');
      const durationRaw = interaction.options.getString('sure');
      const duration = durationRaw ? parseDuration(durationRaw) : null;
      if (durationRaw && !duration) return replyFail(interaction, 'Süre anlaşılamadı. Örnek: `30m`, `12h`, `7d`');

      const err = checkHierarchy(interaction, member);
      if (err) return replyFail(interaction, err);
      if (member && !member.bannable) return replyFail(interaction, 'Bu kullanıcıyı yasaklayamıyorum.');

      await interaction.deferReply();
      const type = duration ? 'tempban' : 'ban';
      const dmSent = member ? await notifyUser(user, interaction.guild, type, reason, duration) : undefined;
      await interaction.guild.members.ban(user.id, {
        reason: `${interaction.user.tag}: ${reason || 'Sebep yok'}`,
        deleteMessageSeconds: (interaction.options.getInteger('mesaj-sil') || 0) * 86400,
      });
      if (duration) {
        const g = db.guild(interaction.guild.id);
        g.tempbans = g.tempbans.filter((b) => b.userId !== user.id);
        g.tempbans.push({ userId: user.id, until: Date.now() + duration });
        db.save();
      }
      const c = await createCase(interaction.guild, { type, targetId: user.id, modId: interaction.user.id, reason, duration });
      await interaction.editReply({ embeds: [resultEmbed(type, user, reason, c.id, { duration, dmSent, extra: duration ? ts(Date.now() + duration, 'R') : null })] });
    },
  },

  // ---------------------------------------------------------------- /unban
  {
    data: build('unban', '🔓 Kullanıcının yasağını kaldırır.', PermissionFlagsBits.BanMembers)
      .addStringOption((o) => o.setName('kullanici-id').setDescription('Yasağı kaldırılacak kullanıcının ID\'si').setRequired(true).setAutocomplete(true))
      .addStringOption((o) => o.setName('sebep').setDescription('Sebep').setMaxLength(400)),
    async autocomplete(interaction) {
      const focused = interaction.options.getFocused().toLowerCase();
      const bans = await interaction.guild.bans.fetch({ limit: 1000 }).catch(() => null);
      if (!bans) return interaction.respond([]);
      const list = bans.filter((b) => b.user.tag.toLowerCase().includes(focused) || b.user.id.includes(focused)).first(25);
      await interaction.respond(list.map((b) => ({ name: `${b.user.tag} (${b.user.id})`.slice(0, 100), value: b.user.id })));
    },
    async execute(interaction) {
      const id = interaction.options.getString('kullanici-id').replace(/\D/g, '');
      const reason = interaction.options.getString('sebep');
      const ban = await interaction.guild.bans.fetch(id).catch(() => null);
      if (!ban) return replyFail(interaction, 'Bu kullanıcı yasaklı değil.');
      await interaction.guild.members.unban(id, `${interaction.user.tag}: ${reason || 'Sebep yok'}`);
      const g = db.guild(interaction.guild.id);
      g.tempbans = g.tempbans.filter((b) => b.userId !== id);
      db.save();
      const c = await createCase(interaction.guild, { type: 'unban', targetId: id, modId: interaction.user.id, reason });
      await reply(interaction, resultEmbed('unban', ban.user, reason, c.id), { ephemeral: false });
    },
  },

  // ---------------------------------------------------------------- /kick
  {
    data: build('kick', '👢 Kullanıcıyı sunucudan atar.', PermissionFlagsBits.KickMembers)
      .addUserOption((o) => o.setName('kullanici').setDescription('Atılacak kullanıcı').setRequired(true))
      .addStringOption((o) => o.setName('sebep').setDescription('Sebep').setMaxLength(400)),
    async execute(interaction) {
      const member = interaction.options.getMember('kullanici');
      const reason = interaction.options.getString('sebep');
      if (!member) return replyFail(interaction, 'Bu kullanıcı sunucuda değil.');
      const err = checkHierarchy(interaction, member);
      if (err) return replyFail(interaction, err);
      if (!member.kickable) return replyFail(interaction, 'Bu kullanıcıyı atamıyorum.');

      await interaction.deferReply();
      const dmSent = await notifyUser(member.user, interaction.guild, 'kick', reason);
      await member.kick(`${interaction.user.tag}: ${reason || 'Sebep yok'}`);
      const c = await createCase(interaction.guild, { type: 'kick', targetId: member.id, modId: interaction.user.id, reason });
      await interaction.editReply({ embeds: [resultEmbed('kick', member.user, reason, c.id, { dmSent })] });
    },
  },

  // ---------------------------------------------------------------- /sustur
  {
    data: build('sustur', '🔇 Kullanıcıya zaman aşımı (timeout) uygular.', PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName('kullanici').setDescription('Susturulacak kullanıcı').setRequired(true))
      .addStringOption((o) => o.setName('sure').setDescription('Süre: 10m, 1h, 1d... (en fazla 28 gün)').setRequired(true)
        .addChoices(
          { name: '60 saniye', value: '60s' }, { name: '5 dakika', value: '5m' }, { name: '10 dakika', value: '10m' },
          { name: '30 dakika', value: '30m' }, { name: '1 saat', value: '1h' }, { name: '6 saat', value: '6h' },
          { name: '12 saat', value: '12h' }, { name: '1 gün', value: '1d' }, { name: '3 gün', value: '3d' }, { name: '1 hafta', value: '7d' },
          { name: '28 gün', value: '28d' },
        ))
      .addStringOption((o) => o.setName('sebep').setDescription('Sebep').setMaxLength(400)),
    async execute(interaction) {
      const member = interaction.options.getMember('kullanici');
      const reason = interaction.options.getString('sebep');
      const duration = parseDuration(interaction.options.getString('sure'));
      if (!member) return replyFail(interaction, 'Bu kullanıcı sunucuda değil.');
      if (!duration || duration > MAX_TIMEOUT) return replyFail(interaction, 'Geçerli bir süre gir (en fazla 28 gün).');
      const err = checkHierarchy(interaction, member);
      if (err) return replyFail(interaction, err);
      if (!member.moderatable) return replyFail(interaction, 'Bu kullanıcıyı susturamıyorum.');

      await interaction.deferReply();
      await member.timeout(duration, `${interaction.user.tag}: ${reason || 'Sebep yok'}`);
      const dmSent = await notifyUser(member.user, interaction.guild, 'timeout', reason, duration);
      const c = await createCase(interaction.guild, { type: 'timeout', targetId: member.id, modId: interaction.user.id, reason, duration });
      await interaction.editReply({ embeds: [resultEmbed('timeout', member.user, reason, c.id, { duration, dmSent, extra: ts(Date.now() + duration, 'R') })] });
    },
  },

  // ---------------------------------------------------------------- /susturma-kaldir
  {
    data: build('susturma-kaldir', '🔊 Kullanıcının zaman aşımını kaldırır.', PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
      .addStringOption((o) => o.setName('sebep').setDescription('Sebep').setMaxLength(400)),
    async execute(interaction) {
      const member = interaction.options.getMember('kullanici');
      const reason = interaction.options.getString('sebep');
      if (!member) return replyFail(interaction, 'Bu kullanıcı sunucuda değil.');
      if (!member.isCommunicationDisabled()) return replyFail(interaction, 'Bu kullanıcı susturulmuş değil.');
      if (!member.moderatable) return replyFail(interaction, 'Bu kullanıcı üzerinde işlem yapamıyorum.');
      await member.timeout(null, `${interaction.user.tag}: ${reason || 'Sebep yok'}`);
      const c = await createCase(interaction.guild, { type: 'untimeout', targetId: member.id, modId: interaction.user.id, reason });
      await reply(interaction, resultEmbed('untimeout', member.user, reason, c.id), { ephemeral: false });
    },
  },
];
