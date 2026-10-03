// /tiktok: TikTok canlı yayın bildirimleri ve kanalda sürekli duran yayın durum kartı.
const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ChannelType, MessageFlags } = require('discord.js');
const db = require('../../lib/db');
const { base, replyOk, replyFail, reply } = require('../../lib/embeds');
const tiktok = require('../../lib/tiktok');

const MAX_ACCOUNTS = 5;
const cleanName = (raw) => raw.trim().replace(/^https?:\/\/(www\.)?tiktok\.com\//i, '').replace(/^@/, '').split(/[/?#]/)[0].toLowerCase();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tiktok')
    .setDescription('🎵 TikTok canlı yayın bildirimleri.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName('ekle').setDescription('Takip edilecek TikTok hesabı ekler')
      .addStringOption((o) => o.setName('kullanici').setDescription('TikTok kullanıcı adı veya profil linki').setRequired(true))
      .addChannelOption((o) => o.setName('kanal').setDescription('Durum kartı ve bildirim kanalı').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
      .addRoleOption((o) => o.setName('rol').setDescription('Yayın başlayınca etiketlenecek rol (boş = etiket yok)'))
      .addStringOption((o) => o.setName('mesaj').setDescription('Bildirim: {etiket} {isim} {link} {baslik} {kullanici}').setMaxLength(500)))
    .addSubcommand((s) => s.setName('sil').setDescription('Takibi kaldırır')
      .addStringOption((o) => o.setName('kullanici').setDescription('TikTok kullanıcı adı').setRequired(true).setAutocomplete(true)))
    .addSubcommand((s) => s.setName('liste').setDescription('Takip edilen hesapları listeler'))
    .addSubcommand((s) => s.setName('kontrol').setDescription('Hesabın şu anki durumunu kontrol eder ve kartı yeniler')
      .addStringOption((o) => o.setName('kullanici').setDescription('TikTok kullanıcı adı').setRequired(true).setAutocomplete(true)))
    .addSubcommand((s) => s.setName('test').setDescription('Örnek bir "yayın başladı" bildirimini etiket atmadan gösterir')
      .addStringOption((o) => o.setName('kullanici').setDescription('TikTok kullanıcı adı').setRequired(true).setAutocomplete(true))),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const list = db.guild(interaction.guild.id).tiktok.accounts.filter((a) => a.username.includes(focused));
    await interaction.respond(list.slice(0, 25).map((a) => ({ name: `@${a.username}`, value: a.username })));
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const cfg = db.guild(interaction.guild.id).tiktok;

    if (sub === 'liste') {
      return reply(interaction, base(0xfe2c55).setTitle('🎵 TikTok Takip Listesi').setDescription(cfg.accounts.length
        ? cfg.accounts.map((a) => `${a.live ? '🔴' : '⚫'} **@${a.username}** → <#${a.channelId}> • ${a.mention ? `<@&${a.mention}>` : 'etiket yok'}`).join('\n')
        : 'Henüz takip edilen hesap yok. `/tiktok ekle` ile ekleyebilirsin.'));
    }

    const username = cleanName(interaction.options.getString('kullanici'));
    if (!/^[a-z0-9._]{2,24}$/.test(username)) return replyFail(interaction, 'Geçerli bir TikTok kullanıcı adı gir.');
    const acc = cfg.accounts.find((a) => a.username === username);

    if (sub === 'sil') {
      if (!acc) return replyFail(interaction, 'Bu hesap takip edilmiyor.');
      cfg.accounts = cfg.accounts.filter((a) => a !== acc);
      db.save();
      const channel = interaction.guild.channels.cache.get(acc.channelId);
      if (acc.cardMessageId) await channel?.messages.delete(acc.cardMessageId).catch(() => {});
      return replyOk(interaction, `**@${username}** takipten çıkarıldı ve durum kartı silindi.`);
    }

    if (sub === 'ekle') {
      const channel = interaction.options.getChannel('kanal');
      if (!tiktok.canPost(interaction.guild, channel.id)) {
        return replyFail(interaction, `${channel} kanalında mesaj gönderme, embed, dosya ekleme ve mesajları yönetme iznim olmalı.`);
      }
      if (!acc && cfg.accounts.length >= MAX_ACCOUNTS) return replyFail(interaction, `En fazla ${MAX_ACCOUNTS} hesap takip edilebilir.`);
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      let status;
      try {
        status = await tiktok.fetchStatus(username);
      } catch (err) {
        return interaction.editReply(`❌ **@${username}** bulunamadı veya TikTok'a ulaşılamadı: ${err.message}`);
      }
      const role = interaction.options.getRole('rol');
      const entry = acc || { username, live: false, lastRoom: null, cardMessageId: null, pingMessageId: null };
      // Kanal değiştiyse eski kartı kaldır
      if (acc && acc.channelId !== channel.id && acc.cardMessageId) {
        await interaction.guild.channels.cache.get(acc.channelId)?.messages.delete(acc.cardMessageId).catch(() => {});
        entry.cardMessageId = null;
      }
      Object.assign(entry, { channelId: channel.id, mention: role?.id || null, message: interaction.options.getString('mesaj') || null });
      // Eklendiği anda yayındaysa bildirimi bir sonraki kontrolde atsın diye "yayında değil" ile başla
      entry.live = false;
      if (!acc) cfg.accounts.push(entry);
      db.save();
      await tiktok.upsertCard(interaction.guild, entry, { ...status, live: false });
      return interaction.editReply({ embeds: [base(0xfe2c55).setTitle('✅ TikTok takibi aktif').setDescription(
        `**${status.nickname}** (@${username}) takip ediliyor.\n\n`
        + `📌 ${channel} kanalına sürekli duran bir **durum kartı** koydum.\n`
        + `🔴 Yayın başlayınca kart **ÇEVRİMİÇİ** olacak${role ? ` ve ${role} etiketlenecek` : ''}.\n`
        + '⚫ Yayın bitince kart **ÇEVRİMDIŞI**na döner, etiket mesajı silinir.\n\n'
        + `Kontrol sıklığı: ~1,5 dakika.${status.live ? '\n\n🔴 Şu an yayında! Bildirim birkaç saniye içinde gelecek.' : ''}`,
      )] });
    }

    if (!acc) return replyFail(interaction, 'Bu hesap takip edilmiyor. Önce `/tiktok ekle` kullan.');

    if (sub === 'kontrol') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const status = await tiktok.checkAccount(interaction.guild, acc, { force: true });
        return interaction.editReply(`${status.live ? '🔴 **Yayında!**' : '⚫ **Yayında değil.**'} Durum kartı yenilendi.${status.live && status.viewers != null ? ` (👀 ${status.viewers} izleyici)` : ''}`);
      } catch (err) {
        return interaction.editReply(`❌ TikTok'a ulaşılamadı: ${err.message}`);
      }
    }

    // test: etiket atmadan, bu kanala gizli önizleme
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const status = await tiktok.fetchStatus(username);
      const preview = await tiktok.buildCard(acc, { ...status, live: true, title: status.title || 'Örnek yayın başlığı' });
      const { attachments: _attachments, ...payload } = preview;
      const text = (acc.message || tiktok.DEFAULT_MESSAGE)
        .replace('{etiket}', acc.mention ? `<@&${acc.mention}>` : '')
        .replace('{isim}', status.nickname).replace('{link}', tiktok.liveLink(username))
        .replace('{baslik}', status.title || '').replace('{kullanici}', `@${username}`);
      return interaction.editReply({ content: `🧪 **Önizleme** (kimse etiketlenmedi):\n${text}`, allowedMentions: { parse: [] }, ...payload });
    } catch (err) {
      return interaction.editReply(`❌ TikTok'a ulaşılamadı: ${err.message}`);
    }
  },
};
