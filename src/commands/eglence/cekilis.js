// /cekilis: çekiliş başlat, bitir, yeniden çek, listele.
const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ChannelType, MessageFlags } = require('discord.js');
const db = require('../../lib/db');
const giveaways = require('../../lib/giveaways');
const { base, replyOk, replyFail, reply } = require('../../lib/embeds');
const { parseDuration, ts, truncate } = require('../../lib/util');

const idFrom = (raw) => raw.split('/').pop().trim();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cekilis')
    .setDescription('🎉 Çekiliş sistemi: butonla katılım, rol şartı, boyoz ödülü.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName('baslat').setDescription('Yeni çekiliş başlatır')
      .addStringOption((o) => o.setName('odul').setDescription('Ödül (ör: Discord Nitro)').setRequired(true).setMaxLength(200))
      .addStringOption((o) => o.setName('sure').setDescription('Süre: 30m, 2h, 1d, 7d').setRequired(true))
      .addIntegerOption((o) => o.setName('kazanan').setDescription('Kazanan sayısı (varsayılan 1)').setMinValue(1).setMaxValue(20))
      .addRoleOption((o) => o.setName('rol-sarti').setDescription('Sadece bu role sahip olanlar katılabilir'))
      .addIntegerOption((o) => o.setName('boyoz').setDescription('Kazananlara otomatik verilecek boyoz').setMinValue(1).setMaxValue(1000000))
      .addStringOption((o) => o.setName('aciklama').setDescription('Ek açıklama').setMaxLength(500))
      .addChannelOption((o) => o.setName('kanal').setDescription('Kanal (varsayılan: burası)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
      .addRoleOption((o) => o.setName('etiket').setDescription('Duyuru için etiketlenecek rol')))
    .addSubcommand((s) => s.setName('bitir').setDescription('Çekilişi hemen bitirir')
      .addStringOption((o) => o.setName('mesaj').setDescription('Çekiliş mesajının ID\'si/linki').setRequired(true)))
    .addSubcommand((s) => s.setName('yeniden-cek').setDescription('Biten çekilişte 1 yeni kazanan seçer')
      .addStringOption((o) => o.setName('mesaj').setDescription('Çekiliş mesajının ID\'si/linki').setRequired(true)))
    .addSubcommand((s) => s.setName('liste').setDescription('Aktif çekilişleri listeler')),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const all = db.guild(interaction.guild.id).giveaways;

    if (sub === 'liste') {
      const active = Object.entries(all).filter(([, g]) => !g.ended);
      return reply(interaction, base().setTitle('🎉 Aktif Çekilişler').setDescription(active.length
        ? active.map(([id, g]) => `**${truncate(g.prize, 60)}** • <#${g.channelId}> • bitiş ${ts(g.endsAt, 'R')} • 👥 ${g.entrants.length} • \`${id}\``).join('\n')
        : 'Aktif çekiliş yok.'));
    }
    if (sub === 'bitir' || sub === 'yeniden-cek') {
      const id = idFrom(interaction.options.getString('mesaj'));
      const gw = all[id];
      if (!gw) return replyFail(interaction, 'Çekiliş bulunamadı.');
      if (sub === 'bitir' && gw.ended) return replyFail(interaction, 'Bu çekiliş zaten bitmiş. Yeni kazanan için `yeniden-cek` kullan.');
      if (sub === 'yeniden-cek' && !gw.ended) return replyFail(interaction, 'Çekiliş henüz bitmedi.');
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const winners = await giveaways.end(client, interaction.guild.id, id, { reroll: sub === 'yeniden-cek' });
      return interaction.editReply(winners?.length ? `✅ Kazanan: ${winners.map((w) => `<@${w}>`).join(', ')}` : '😔 Seçilecek uygun katılımcı yok.');
    }

    const ms = parseDuration(interaction.options.getString('sure'));
    if (!ms || ms < 60000 || ms > 60 * 864e5) return replyFail(interaction, 'Süre 1 dakika ile 60 gün arasında olmalı. Örnek: `2h`, `1d`');
    const channel = interaction.options.getChannel('kanal') || interaction.channel;
    const gw = {
      prize: interaction.options.getString('odul'), description: interaction.options.getString('aciklama'),
      endsAt: Date.now() + ms, winnerCount: interaction.options.getInteger('kazanan') || 1,
      roleReq: interaction.options.getRole('rol-sarti')?.id || null, boyoz: interaction.options.getInteger('boyoz') || 0,
      hostId: interaction.user.id, channelId: channel.id, entrants: [], winners: [], ended: false,
    };
    const tag = interaction.options.getRole('etiket');
    const msg = await channel.send({ ...giveaways.render(gw), content: tag ? `${tag} 🎉 Yeni çekiliş!` : undefined, allowedMentions: { roles: tag ? [tag.id] : [] } });
    all[msg.id] = gw;
    db.save();
    return replyOk(interaction, `Çekiliş başladı! [Mesaja git](${msg.url}) • Bitiş: ${ts(gw.endsAt, 'R')}`);
  },

  components: {
    async katil(interaction) {
      const gw = db.guild(interaction.guild.id).giveaways[interaction.message.id];
      if (!gw || gw.ended) return replyFail(interaction, 'Bu çekiliş bitmiş.');
      if (gw.roleReq && !interaction.member.roles.cache.has(gw.roleReq)) return replyFail(interaction, `Katılmak için <@&${gw.roleReq}> rolüne sahip olmalısın.`);
      const i = gw.entrants.indexOf(interaction.user.id);
      if (i >= 0) gw.entrants.splice(i, 1); else gw.entrants.push(interaction.user.id);
      db.save();
      await interaction.update(giveaways.render(gw));
      await interaction.followUp({ content: i >= 0 ? '🚪 Çekilişten çıktın.' : '🎉 Çekilişe katıldın, bol şans!', flags: MessageFlags.Ephemeral });
    },
    async liste(interaction) {
      const gw = db.guild(interaction.guild.id).giveaways[interaction.message.id];
      if (!gw) return replyFail(interaction, 'Çekiliş bulunamadı.');
      return reply(interaction, base().setTitle(`👥 Katılımcılar (${gw.entrants.length})`).setDescription(truncate(gw.entrants.map((id) => `<@${id}>`).join(' '), 4000) || 'Henüz katılan yok.'));
    },
  },
};
