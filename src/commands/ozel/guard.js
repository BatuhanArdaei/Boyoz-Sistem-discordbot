// /guard: Sunucu koruma ayarları (sadece bot yetkilileri).
const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ChannelType } = require('discord.js');
const db = require('../../lib/db');
const { base, reply, replyFail } = require('../../lib/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guard')
    .setDescription('👑 Sunucu koruması: sağ tık, rol/kanal silme, bot/webhook ekleme, URL koruma.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName('durum').setDescription('Guard ayarlarını gösterir'))
    .addSubcommand((s) => s.setName('ac-kapat').setDescription('Korumayı açar/kapatır')
      .addBooleanOption((o) => o.setName('aktif').setDescription('Açık/kapalı').setRequired(true)))
    .addSubcommand((s) => s.setName('beyaz-liste').setDescription('Korumadan muaf kişiler')
      .addStringOption((o) => o.setName('islem').setDescription('İşlem').setRequired(true).addChoices({ name: 'Ekle', value: 'ekle' }, { name: 'Çıkar', value: 'cikar' }))
      .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true)))
    .addSubcommand((s) => s.setName('ayar').setDescription('Hassasiyet ve ceza')
      .addIntegerOption((o) => o.setName('limit').setDescription('Kaç hareketten sonra ceza? (varsayılan 3)').setMinValue(1).setMaxValue(20))
      .addIntegerOption((o) => o.setName('saniye').setDescription('Kaç saniye içinde? (varsayılan 60)').setMinValue(5).setMaxValue(3600))
      .addStringOption((o) => o.setName('ceza').setDescription('Ceza').addChoices({ name: 'Tüm rollerini al', value: 'roller' }, { name: 'Yasakla', value: 'ban' }))
      .addChannelOption((o) => o.setName('log').setDescription('Guard log kanalı').addChannelTypes(ChannelType.GuildText))),

  async execute(interaction) {
    const g = db.guild(interaction.guild.id).guard;
    const sub = interaction.options.getSubcommand();
    if (sub === 'ac-kapat') {
      const me = interaction.guild.members.me;
      if (interaction.options.getBoolean('aktif') && !me.permissions.has([PermissionFlagsBits.ViewAuditLog, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.BanMembers])) {
        return replyFail(interaction, 'Guard için "Denetim Kaydını Görüntüle, Rolleri/Kanalları Yönet, Üyeleri Yasakla" izinlerim olmalı (en kolayı Yönetici).');
      }
      g.enabled = interaction.options.getBoolean('aktif');
    }
    if (sub === 'beyaz-liste') {
      const u = interaction.options.getUser('kullanici');
      if (interaction.options.getString('islem') === 'ekle') { if (!g.whitelist.includes(u.id)) g.whitelist.push(u.id); } else g.whitelist = g.whitelist.filter((id) => id !== u.id);
    }
    if (sub === 'ayar') {
      if (interaction.options.getInteger('limit')) g.limit = interaction.options.getInteger('limit');
      if (interaction.options.getInteger('saniye')) g.windowSec = interaction.options.getInteger('saniye');
      if (interaction.options.getString('ceza')) g.punish = interaction.options.getString('ceza');
      if (interaction.options.getChannel('log')) g.logChannelId = interaction.options.getChannel('log').id;
    }
    db.save();
    return reply(interaction, base(g.enabled ? 0x57f287 : 0xed4245).setTitle('🛡️ Guard').setDescription([
      `**Durum:** ${g.enabled ? '🟢 Açık' : '🔴 Kapalı'}`,
      `**Hassasiyet:** ${g.windowSec} saniyede ${g.limit} kanal/rol silme, ban veya kick → ceza`,
      `**Ceza:** ${g.punish === 'ban' ? '🔨 Yasaklama' : '🎭 Tüm rolleri alma'}`,
      `**Anında ceza:** izinsiz bot ekleme, webhook açma, role tehlikeli yetki verme, sunucu adı/ikon/URL değiştirme`,
      '**Geri alma:** silinen kanal ve roller yeniden oluşturulur, izinsiz banlar kaldırılır, verilen tehlikeli yetkiler geri alınır',
      `**Log:** ${g.logChannelId ? `<#${g.logChannelId}>` : 'moderasyon log kanalı'} + sahiplere DM`,
      `**Beyaz liste:** ${g.whitelist.map((id) => `<@${id}>`).join(' ') || '—'} *(sunucu sahibi ve bot yetkilileri her zaman muaf)*`,
    ].join('\n')).setFooter({ text: 'Not: Botun rolü en üstte olmalı; yoksa üstündeki rolleri yönetemez.' }));
  },
};
