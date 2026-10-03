// /duyuru: Anlık veya zamanlanmış (tek seferlik / tekrarlı) duyurular.
const {
  SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ChannelType, MessageFlags,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const db = require('../../lib/db');
const { base, ok, replyOk, replyFail, reply } = require('../../lib/embeds');
const { buildAnnouncement, sendAnnouncement } = require('../../lib/announce');
const { parseColor, parseWhen, parseDuration, isUrl, ts, truncate, formatDuration, isOwner } = require('../../lib/util');

const pending = new Map(); // nonce -> duyuru seçenekleri

const addCommonOptions = (s) => s
  .addChannelOption((o) => o.setName('kanal').setDescription('Duyuru kanalı (boş = varsayılan duyuru kanalı)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
  .addStringOption((o) => o.setName('etiket').setDescription('Kimler etiketlensin?').addChoices(
    { name: '@everyone', value: 'everyone' }, { name: '@here', value: 'here' }, { name: 'Bir rol (rol seçeneğini doldur)', value: 'rol' }, { name: 'Etiket yok', value: 'yok' },
  ))
  .addRoleOption((o) => o.setName('rol').setDescription('Etiketlenecek rol'))
  .addStringOption((o) => o.setName('renk').setDescription('Renk: hex veya turuncu/kirmizi/yesil/mavi/sari/mor/pembe'))
  .addStringOption((o) => o.setName('gorsel').setDescription('Görsel URL\'si'))
  .addBooleanOption((o) => o.setName('boyoz-banner').setDescription('Boyoz bannerını görsel olarak ekle'))
  .addBooleanOption((o) => o.setName('imza').setDescription('Duyurunun altına adını ekle'))
  .addBooleanOption((o) => o.setName('tepki').setDescription('Duyuruya 🥐 tepkisi ekle'));

function collectOptions(interaction) {
  const g = db.guild(interaction.guild.id);
  const channel = interaction.options.getChannel('kanal') || (g.announce.channel && interaction.guild.channels.cache.get(g.announce.channel));
  if (!channel) return { error: 'Kanal seçmedin ve varsayılan duyuru kanalı ayarlı değil. `/duyuru kanal` ile ayarlayabilirsin.' };
  const tag = interaction.options.getString('etiket') || 'yok';
  const role = interaction.options.getRole('rol');
  if (tag === 'rol' && !role) return { error: '"Bir rol" seçtin ama rol belirtmedin.' };
  const image = interaction.options.getString('gorsel');
  if (image && !isUrl(image)) return { error: 'Görsel geçerli bir URL olmalı (https://...).' };
  if ((tag === 'everyone' || tag === 'here') && !interaction.member.permissions.has(PermissionFlagsBits.MentionEveryone) && !isOwner(interaction.user.id)) {
    return { error: '@everyone/@here etiketleme iznin yok.' };
  }
  return {
    channelId: channel.id,
    mention: tag === 'rol' ? role.id : (tag === 'yok' ? null : tag),
    color: parseColor(interaction.options.getString('renk')),
    image,
    banner: interaction.options.getBoolean('boyoz-banner') || false,
    showAuthor: interaction.options.getBoolean('imza') || false,
    react: interaction.options.getBoolean('tepki') || false,
    publish: true,
    authorId: interaction.user.id,
  };
}

function contentModal(customId, title) {
  return new ModalBuilder().setCustomId(customId).setTitle(title).addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('baslik').setLabel('Başlık').setStyle(TextInputStyle.Short).setMaxLength(240).setRequired(false)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('icerik').setLabel('Duyuru metni').setStyle(TextInputStyle.Paragraph).setMaxLength(4000).setRequired(true)
      .setPlaceholder('Markdown desteklenir: **kalın**, *italik*, > alıntı, - liste ...')),
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('duyuru')
    .setDescription('📢 Duyuru gönderir veya zamanlar.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => addCommonOptions(s.setName('gonder').setDescription('Hemen duyuru gönderir (önizleme ile)')))
    .addSubcommand((s) => addCommonOptions(s.setName('zamanla').setDescription('İleri bir tarihe duyuru zamanlar')
      .addStringOption((o) => o.setName('zaman').setDescription('"2026-10-05 20:30", "05.10.2026 20:30", "20:30" veya "2h"').setRequired(true)))
      .addStringOption((o) => o.setName('tekrar').setDescription('Tekrarlansın mı?').addChoices(
        { name: 'Tekrar yok', value: 'yok' }, { name: 'Her gün', value: '1d' }, { name: 'Her hafta', value: '7d' }, { name: 'Her saat', value: '1h' },
      )))
    .addSubcommand((s) => s.setName('liste').setDescription('Zamanlanmış duyuruları listeler'))
    .addSubcommand((s) => s.setName('iptal').setDescription('Zamanlanmış duyuruyu iptal eder')
      .addIntegerOption((o) => o.setName('id').setDescription('Duyuru ID\'si').setRequired(true).setAutocomplete(true)))
    .addSubcommand((s) => s.setName('kanal').setDescription('Varsayılan duyuru kanalını ayarlar')
      .addChannelOption((o) => o.setName('kanal').setDescription('Kanal').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))),

  async autocomplete(interaction) {
    const list = db.guild(interaction.guild.id).announce.schedules;
    await interaction.respond(list.slice(0, 25).map((s) => ({
      name: `#${s.id} • ${new Date(s.at + 3 * 36e5).toISOString().slice(0, 16).replace('T', ' ')} • ${s.title || truncate(s.content, 40)}`.slice(0, 100),
      value: s.id,
    })));
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const g = db.guild(interaction.guild.id);

    if (sub === 'kanal') {
      const channel = interaction.options.getChannel('kanal');
      g.announce.channel = channel.id;
      db.save();
      return replyOk(interaction, `Varsayılan duyuru kanalı ${channel} olarak ayarlandı.`);
    }

    if (sub === 'liste') {
      const list = [...g.announce.schedules].sort((a, b) => a.at - b.at);
      return reply(interaction, base().setTitle('🗓️ Zamanlanmış Duyurular').setDescription(list.length
        ? list.map((s) => `**#${s.id}** • ${ts(s.at)} (${ts(s.at, 'R')}) → <#${s.channelId}>${s.repeat ? ` • 🔁 ${formatDuration(s.repeat)}` : ''}\n└ ${truncate(s.title || s.content, 80)}`).join('\n')
        : 'Zamanlanmış duyuru yok.'));
    }

    if (sub === 'iptal') {
      const id = interaction.options.getInteger('id');
      const idx = g.announce.schedules.findIndex((s) => s.id === id);
      if (idx === -1) return replyFail(interaction, `#${id} numaralı duyuru bulunamadı.`);
      g.announce.schedules.splice(idx, 1);
      db.save();
      return replyOk(interaction, `#${id} numaralı zamanlanmış duyuru iptal edildi.`);
    }

    const opts = collectOptions(interaction);
    if (opts.error) return replyFail(interaction, opts.error);

    if (sub === 'zamanla') {
      const at = parseWhen(interaction.options.getString('zaman'));
      if (!at || at <= Date.now() + 30000) return replyFail(interaction, 'Zaman anlaşılamadı veya geçmişte. Örnek: `2026-10-05 20:30`, `20:30`, `2h`');
      const repeat = interaction.options.getString('tekrar');
      opts.at = at;
      opts.repeat = repeat && repeat !== 'yok' ? parseDuration(repeat) : null;
    }

    pending.set(interaction.id, { ...opts, mode: sub });
    setTimeout(() => pending.delete(interaction.id), 30 * 60000);
    await interaction.showModal(contentModal(`duyuru:form:${interaction.id}`, sub === 'zamanla' ? 'Zamanlanmış Duyuru' : 'Yeni Duyuru'));
  },

  components: {
    // Form gönderildi -> önizleme göster
    async form(interaction, [nonce]) {
      const opts = pending.get(nonce);
      if (!opts) return replyFail(interaction, 'Form süresi doldu, komutu tekrar kullan.');
      opts.title = interaction.fields.getTextInputValue('baslik') || null;
      opts.content = interaction.fields.getTextInputValue('icerik');

      const preview = buildAnnouncement(interaction.guild, opts);
      const info = opts.mode === 'zamanla'
        ? `🗓️ **Önizleme** — ${ts(opts.at)} (${ts(opts.at, 'R')}) tarihinde <#${opts.channelId}> kanalına gönderilecek.${opts.repeat ? ` 🔁 Her ${formatDuration(opts.repeat)}` : ''}`
        : `👀 **Önizleme** — <#${opts.channelId}> kanalına gönderilecek.`;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`duyuru:onay:${nonce}`).setLabel(opts.mode === 'zamanla' ? 'Zamanla' : 'Gönder').setEmoji('✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`duyuru:vazgec:${nonce}`).setLabel('Vazgeç').setStyle(ButtonStyle.Secondary),
      );
      await interaction.reply({
        content: `${info}${preview.content ? `\nEtiket: ${preview.content}` : ''}`,
        embeds: preview.embeds, files: preview.files, components: [row],
        allowedMentions: { parse: [] }, flags: MessageFlags.Ephemeral,
      });
    },

    async onay(interaction, [nonce]) {
      const opts = pending.get(nonce);
      if (!opts?.content) return interaction.update({ content: '❌ Süre doldu, komutu tekrar kullan.', embeds: [], components: [], attachments: [] });
      pending.delete(nonce);

      if (opts.mode === 'zamanla') {
        const g = db.guild(interaction.guild.id);
        db.data.meta.scheduleCounter += 1;
        const { mode: _mode, ...schedule } = opts;
        schedule.id = db.data.meta.scheduleCounter;
        g.announce.schedules.push(schedule);
        db.save();
        return interaction.update({ content: '', embeds: [ok(`Duyuru **#${schedule.id}** zamanlandı: ${ts(schedule.at)} (${ts(schedule.at, 'R')})`)], components: [], attachments: [] });
      }

      await interaction.deferUpdate();
      try {
        const msg = await sendAnnouncement(interaction.guild, opts);
        await interaction.editReply({ content: '', embeds: [ok(`Duyuru gönderildi! [Mesaja git](${msg.url})`)], components: [], attachments: [] });
      } catch (err) {
        await interaction.editReply({ content: `❌ ${err.message}`, embeds: [], components: [], attachments: [] });
      }
    },

    async vazgec(interaction, [nonce]) {
      pending.delete(nonce);
      await interaction.update({ content: '🚫 Duyuru iptal edildi.', embeds: [], components: [], attachments: [] });
    },
  },
};
