// Bot yetkililerine özel yönetim komutları.
const {
  SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ChannelType, MessageFlags,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder,
} = require('discord.js');
const config = require('../../config');
const db = require('../../lib/db');
const { base, ok, replyOk, replyFail, reply, setBotAvatar } = require('../../lib/embeds');
const { ts } = require('../../lib/util');

const admin = (b) => b.setDefaultMemberPermissions(PermissionFlagsBits.Administrator).setContexts(InteractionContextType.Guild);
const messageIdFrom = (raw) => raw.split('/').pop().trim();

module.exports = [
  // ---------------------------------------------------------------- /dm
  {
    data: admin(new SlashCommandBuilder().setName('dm').setDescription('👑 Bir kullanıcıya bot üzerinden özel mesaj gönderir.'))
      .addUserOption((o) => o.setName('kullanici').setDescription('Alıcı').setRequired(true))
      .addStringOption((o) => o.setName('metin').setDescription('Mesaj (alt satır için \\n)').setRequired(true).setMaxLength(2000))
      .addBooleanOption((o) => o.setName('embed').setDescription('Kutulu (embed) olarak gönder')),
    async execute(interaction) {
      const user = interaction.options.getUser('kullanici');
      const text = interaction.options.getString('metin').replace(/\\n/g, '\n');
      const payload = interaction.options.getBoolean('embed')
        ? { embeds: [base().setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined }).setDescription(text)] }
        : { content: text };
      const sent = await user.send(payload).then(() => true).catch(() => false);
      return sent ? replyOk(interaction, `${user} kullanıcısına mesaj gönderildi.`) : replyFail(interaction, 'Mesaj gönderilemedi (kullanıcının DM\'leri kapalı olabilir).');
    },
  },

  // ---------------------------------------------------------------- /durum
  {
    data: admin(new SlashCommandBuilder().setName('durum').setDescription('👑 Botun durumunu / aktivitesini değiştirir.'))
      .addStringOption((o) => o.setName('tur').setDescription('Aktivite türü').setRequired(true).addChoices(
        { name: 'Özel durum', value: 'ozel' }, { name: 'Oynuyor', value: 'oynuyor' }, { name: 'İzliyor', value: 'izliyor' },
        { name: 'Dinliyor', value: 'dinliyor' }, { name: 'Yarışıyor', value: 'yarisiyor' }, { name: 'Sıfırla (varsayılan)', value: 'sifirla' },
      ))
      .addStringOption((o) => o.setName('metin').setDescription('Aktivite metni').setMaxLength(128))
      .addStringOption((o) => o.setName('statu').setDescription('Çevrimiçi durumu').addChoices(
        { name: '🟢 Çevrimiçi', value: 'online' }, { name: '🌙 Boşta', value: 'idle' },
        { name: '⛔ Rahatsız etmeyin', value: 'dnd' }, { name: '⚫ Görünmez', value: 'invisible' },
      )),
    async execute(interaction, client) {
      const { applyPresence } = require('../../events/ready');
      const type = interaction.options.getString('tur');
      if (type === 'sifirla') db.data.meta.presence = null;
      else {
        const text = interaction.options.getString('metin');
        if (!text) return replyFail(interaction, 'Bir metin girmelisin.');
        db.data.meta.presence = { type, text, status: interaction.options.getString('statu') || 'online' };
      }
      db.save();
      applyPresence(client);
      return replyOk(interaction, 'Bot durumu güncellendi.');
    },
  },

  // ---------------------------------------------------------------- /yetkili
  {
    data: admin(new SlashCommandBuilder().setName('yetkili').setDescription('👑 Bot yetkililerini (özel komut kullanabilenler) yönetir.'))
      .addSubcommand((s) => s.setName('ekle').setDescription('Yetkili ekler').addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true)))
      .addSubcommand((s) => s.setName('cikar').setDescription('Yetkili çıkarır').addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true)))
      .addSubcommand((s) => s.setName('liste').setDescription('Yetkilileri listeler')),
    async execute(interaction) {
      const sub = interaction.options.getSubcommand();
      const owners = db.data.meta.owners;
      if (sub === 'liste') {
        const lines = [
          ...config.ownerIds.map((id) => `👑 <@${id}> \`${id}\` *(.env — kalıcı)*`),
          ...owners.map((id) => `⭐ <@${id}> \`${id}\``),
        ];
        return reply(interaction, base().setTitle('👑 Boyoz Sistem Yetkilileri').setDescription(lines.join('\n') || 'Yetkili yok.'));
      }
      // Sadece .env'deki ana yetkililer başka yetkili ekleyip çıkarabilir
      if (!config.ownerIds.includes(interaction.user.id)) {
        return replyFail(interaction, 'Yetkili ekleme/çıkarma sadece `.env.local` içindeki ana yetkililere açık.');
      }
      const user = interaction.options.getUser('kullanici');
      if (sub === 'ekle') {
        if (user.bot) return replyFail(interaction, 'Botlar yetkili olamaz.');
        if (config.ownerIds.includes(user.id) || owners.includes(user.id)) return replyFail(interaction, 'Bu kullanıcı zaten yetkili.');
        owners.push(user.id);
        db.save();
        return replyOk(interaction, `${user} artık bot yetkilisi.`);
      }
      if (config.ownerIds.includes(user.id)) return replyFail(interaction, 'Ana yetkililer sadece `.env.local` dosyasından çıkarılabilir.');
      const idx = owners.indexOf(user.id);
      if (idx === -1) return replyFail(interaction, 'Bu kullanıcı yetkili değil.');
      owners.splice(idx, 1);
      db.save();
      return replyOk(interaction, `${user} yetkililerden çıkarıldı.`);
    },
  },

  // ---------------------------------------------------------------- /bot-profil
  {
    data: admin(new SlashCommandBuilder().setName('bot-profil').setDescription('👑 Botun profil fotoğrafını ve bannerını ayarlar.'))
      .addStringOption((o) => o.setName('hedef').setDescription('Neyi güncelleyelim?').setRequired(true).addChoices(
        { name: 'Profil fotoğrafı + banner (Boyoz görselleri)', value: 'ikisi' },
        { name: 'Sadece profil fotoğrafı', value: 'avatar' },
        { name: 'Sadece banner', value: 'banner' },
      ))
      .addAttachmentOption((o) => o.setName('ozel-gorsel').setDescription('Boyoz görseli yerine bu görseli kullan (tek hedef seçiliyse)')),
    async execute(interaction, client) {
      const target = interaction.options.getString('hedef');
      const custom = interaction.options.getAttachment('ozel-gorsel');
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const done = [];
      try {
        if (target !== 'banner') {
          await client.user.setAvatar(custom && target === 'avatar' ? custom.url : config.assets.avatar);
          done.push('profil fotoğrafı');
        }
        if (target !== 'avatar') {
          await client.user.setBanner(custom && target === 'banner' ? custom.url : config.assets.profileBanner);
          done.push('banner');
        }
        setBotAvatar(client.user.displayAvatarURL());
        await interaction.editReply({ embeds: [ok(`Botun ${done.join(' ve ')} güncellendi. 🥐`).setThumbnail(client.user.displayAvatarURL())] });
      } catch (err) {
        await interaction.editReply(`❌ Güncellenemedi: ${err.message}\n(Discord profil değişikliklerini sınırlar, birkaç dakika sonra tekrar dene.)`);
      }
    },
  },

  // ---------------------------------------------------------------- /sunucular
  {
    data: admin(new SlashCommandBuilder().setName('sunucular').setDescription('👑 Botun bulunduğu sunucuları listeler veya bir sunucudan ayrılır.'))
      .addStringOption((o) => o.setName('ayril').setDescription('Ayrılınacak sunucunun ID\'si')),
    async execute(interaction, client) {
      const leaveId = interaction.options.getString('ayril');
      if (leaveId) {
        const guild = client.guilds.cache.get(leaveId);
        if (!guild) return replyFail(interaction, 'Bu ID ile bir sunucuda değilim.');
        await guild.leave();
        return replyOk(interaction, `**${guild.name}** sunucusundan ayrıldım.`);
      }
      const lines = client.guilds.cache
        .sort((a, b) => b.memberCount - a.memberCount)
        .map((g) => `**${g.name}** • \`${g.id}\` • ${g.memberCount} üye • katılım ${ts(g.joinedTimestamp, 'R')}`);
      return reply(interaction, base().setTitle(`🌍 Sunucular (${lines.length})`).setDescription(lines.slice(0, 40).join('\n').slice(0, 4000)));
    },
  },

  // ---------------------------------------------------------------- /mesaj-duzenle
  {
    data: admin(new SlashCommandBuilder().setName('mesaj-duzenle').setDescription('👑 Botun gönderdiği bir mesajı düzenler.'))
      .addStringOption((o) => o.setName('mesaj').setDescription('Mesaj ID\'si veya linki').setRequired(true))
      .addChannelOption((o) => o.setName('kanal').setDescription('Mesajın kanalı (varsayılan: bu kanal)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),
    async execute(interaction) {
      const channel = interaction.options.getChannel('kanal') || interaction.channel;
      const msg = await channel.messages.fetch(messageIdFrom(interaction.options.getString('mesaj'))).catch(() => null);
      if (!msg) return replyFail(interaction, 'Mesaj bulunamadı.');
      if (msg.author.id !== interaction.client.user.id) return replyFail(interaction, 'Sadece benim gönderdiğim mesajları düzenleyebilirim.');

      const isEmbed = msg.embeds.length > 0 && !msg.content;
      const current = isEmbed ? msg.embeds[0].description || '' : msg.content;
      const modal = new ModalBuilder().setCustomId(`mesaj-duzenle:kaydet:${channel.id}:${msg.id}`).setTitle('Mesajı Düzenle').addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('icerik').setLabel(isEmbed ? 'Embed içeriği' : 'Mesaj içeriği')
          .setStyle(TextInputStyle.Paragraph).setMaxLength(isEmbed ? 4000 : 2000).setValue(current.slice(0, isEmbed ? 4000 : 2000)).setRequired(true)),
      );
      if (isEmbed) {
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('baslik').setLabel('Embed başlığı')
          .setStyle(TextInputStyle.Short).setMaxLength(256).setValue(msg.embeds[0].title || '').setRequired(false)));
      }
      await interaction.showModal(modal);
    },
    components: {
      async kaydet(interaction, [channelId, messageId]) {
        const channel = interaction.guild.channels.cache.get(channelId);
        const msg = await channel?.messages.fetch(messageId).catch(() => null);
        if (!msg) return replyFail(interaction, 'Mesaj artık yok.');
        const content = interaction.fields.getTextInputValue('icerik');
        if (msg.embeds.length && !msg.content) {
          const embed = EmbedBuilder.from(msg.embeds[0]).setDescription(content);
          embed.setTitle(interaction.fields.getTextInputValue('baslik') || null);
          await msg.edit({ embeds: [embed, ...msg.embeds.slice(1)] });
        } else {
          await msg.edit({ content });
        }
        return replyOk(interaction, `Mesaj düzenlendi. [Git](${msg.url})`);
      },
    },
  },

  // ---------------------------------------------------------------- /tepki
  {
    data: admin(new SlashCommandBuilder().setName('tepki').setDescription('👑 Bot adına bir mesaja emoji tepkisi bırakır.'))
      .addStringOption((o) => o.setName('mesaj').setDescription('Mesaj ID\'si veya linki').setRequired(true))
      .addStringOption((o) => o.setName('emojiler').setDescription('Bir veya birden fazla emoji (boşlukla ayır)').setRequired(true))
      .addChannelOption((o) => o.setName('kanal').setDescription('Mesajın kanalı (varsayılan: bu kanal)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),
    async execute(interaction) {
      const channel = interaction.options.getChannel('kanal') || interaction.channel;
      const msg = await channel.messages.fetch(messageIdFrom(interaction.options.getString('mesaj'))).catch(() => null);
      if (!msg) return replyFail(interaction, 'Mesaj bulunamadı.');
      const emojis = interaction.options.getString('emojiler').split(/\s+/).filter(Boolean).slice(0, 20);
      const failed = [];
      for (const e of emojis) await msg.react(e).catch(() => failed.push(e));
      return failed.length
        ? replyFail(interaction, `Bazı emojiler eklenemedi: ${failed.join(' ')}`)
        : replyOk(interaction, 'Tepkiler eklendi.');
    },
  },
];

// /ozel dm|durum|profil|sunucular|yetkili ...
const { regroup } = require('../../lib/group');

module.exports = regroup(module.exports, [
  {
    name: 'ozel', description: '👑 Yetkili araçları: DM, bot durumu, profil, sunucular, yetkili listesi.', perm: PermissionFlagsBits.Administrator,
    parts: [
      { sub: 'dm', from: 'dm' }, { sub: 'durum', from: 'durum' }, { sub: 'profil', from: 'bot-profil' },
      { sub: 'sunucular', from: 'sunucular' }, { sub: 'yetkili', from: 'yetkili' },
    ],
  },
]);
