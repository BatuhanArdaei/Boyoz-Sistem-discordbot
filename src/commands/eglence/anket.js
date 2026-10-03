// /anket: Butonlu, canlı sonuçlu anket.
const { SlashCommandBuilder, InteractionContextType, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../lib/db');
const { replyFail } = require('../../lib/embeds');
const { renderPoll, endPoll } = require('../../lib/polls');
const { parseDuration, isStaff } = require('../../lib/util');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anket')
    .setDescription('📊 Butonlu anket başlatır.')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o.setName('soru').setDescription('Anket sorusu').setRequired(true).setMaxLength(200))
    .addStringOption((o) => o.setName('secenekler').setDescription('Virgülle ayır (2-10 seçenek). Boş = Evet, Hayır').setMaxLength(1000))
    .addStringOption((o) => o.setName('sure').setDescription('Anket süresi: 30m, 1h, 1d... (boş = elle bitirilir)'))
    .addRoleOption((o) => o.setName('etiket').setDescription('Anket için etiketlenecek rol')),

  async execute(interaction) {
    const raw = interaction.options.getString('secenekler');
    const options = raw ? [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))] : ['Evet', 'Hayır'];
    if (options.length < 2 || options.length > 10) return replyFail(interaction, '2 ile 10 arasında seçenek girmelisin.');
    if (options.some((o) => o.length > 80)) return replyFail(interaction, 'Her seçenek en fazla 80 karakter olabilir.');
    const durRaw = interaction.options.getString('sure');
    const duration = durRaw ? parseDuration(durRaw) : null;
    if (durRaw && (!duration || duration > 30 * 864e5)) return replyFail(interaction, 'Süre anlaşılamadı (en fazla 30 gün). Örnek: `1h`, `1d`');

    const role = interaction.options.getRole('etiket');
    if (role && !role.mentionable && !interaction.member.permissions.has(PermissionFlagsBits.MentionEveryone)) {
      return replyFail(interaction, 'Bu rolü etiketleme iznin yok.');
    }
    const poll = {
      question: interaction.options.getString('soru'),
      options,
      votes: {},
      creatorId: interaction.user.id,
      channelId: interaction.channelId,
      createdAt: Date.now(),
      endsAt: duration ? Date.now() + duration : null,
      ended: false,
    };
    const res = await interaction.reply({
      content: role ? `${role}` : undefined,
      ...renderPoll(poll),
      allowedMentions: { roles: role ? [role.id] : [] },
      withResponse: true,
    });
    db.guild(interaction.guild.id).polls[res.resource.message.id] = poll;
    db.save();
  },

  components: {
    async oy(interaction, [idx]) {
      const g = db.guild(interaction.guild.id);
      const poll = g.polls[interaction.message.id];
      if (!poll || poll.ended) return replyFail(interaction, 'Bu anket sona ermiş.');
      const choice = Number(idx);
      const prev = poll.votes[interaction.user.id];
      if (prev === choice) delete poll.votes[interaction.user.id];
      else poll.votes[interaction.user.id] = choice;
      db.save();
      await interaction.update(renderPoll(poll));
      const msg = prev === choice ? 'Oyun geri alındı.' : `Oyun kaydedildi: **${poll.options[choice]}**`;
      await interaction.followUp({ content: `🗳️ ${msg}`, flags: MessageFlags.Ephemeral });
    },
    async bitir(interaction) {
      const poll = db.guild(interaction.guild.id).polls[interaction.message.id];
      if (!poll || poll.ended) return replyFail(interaction, 'Bu anket zaten bitmiş.');
      if (interaction.user.id !== poll.creatorId && !isStaff(interaction.member)) {
        return replyFail(interaction, 'Anketi sadece oluşturan kişi veya yetkililer bitirebilir.');
      }
      await interaction.deferUpdate();
      await endPoll(interaction.client, interaction.guild.id, interaction.message.id);
      await interaction.followUp({ content: '🔒 Anket bitirildi.', flags: MessageFlags.Ephemeral });
    },
  },
};
