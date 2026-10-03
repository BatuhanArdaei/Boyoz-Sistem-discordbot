// /automod: Mesaj filtrelerini yönetir.
const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ChannelType } = require('discord.js');
const db = require('../../lib/db');
const { base, replyOk, replyFail, reply } = require('../../lib/embeds');

const FILTERS = {
  invites: '📨 Davet linki engeli',
  links: '🔗 Link engeli',
  badwords: '🤬 Küfür filtresi',
  caps: '🔠 Büyük harf filtresi',
  spam: '🌊 Spam filtresi',
};
const ACTIONS = { sil: '🗑️ Sadece sil', uyar: '⚠️ Sil + uyarı ver', sustur: '🔇 Sil + sustur' };
const onOff = (v) => (v ? '✅' : '❌');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('🤖 Otomatik moderasyon filtrelerini yönetir.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName('durum').setDescription('AutoMod ayarlarını gösterir'))
    .addSubcommand((s) => s.setName('ac').setDescription('AutoMod\'u açar (önerilen filtrelerle)'))
    .addSubcommand((s) => s.setName('kapat').setDescription('AutoMod\'u tamamen kapatır'))
    .addSubcommand((s) => s.setName('filtre').setDescription('Bir filtreyi açar/kapatır')
      .addStringOption((o) => o.setName('tur').setDescription('Filtre').setRequired(true).addChoices(...Object.entries(FILTERS).map(([value, name]) => ({ name, value }))))
      .addBooleanOption((o) => o.setName('aktif').setDescription('Açık/kapalı').setRequired(true)))
    .addSubcommand((s) => s.setName('etiket-limit').setDescription('Bir mesajdaki en fazla etiket sayısı (0 = kapalı)')
      .addIntegerOption((o) => o.setName('sayi').setDescription('Limit').setRequired(true).setMinValue(0).setMaxValue(50)))
    .addSubcommand((s) => s.setName('ceza').setDescription('İhlalde uygulanacak işlem')
      .addStringOption((o) => o.setName('islem').setDescription('İşlem').setRequired(true).addChoices(...Object.entries(ACTIONS).map(([value, name]) => ({ name, value }))))
      .addIntegerOption((o) => o.setName('dakika').setDescription('Susturma süresi (dakika)').setMinValue(1).setMaxValue(10080)))
    .addSubcommand((s) => s.setName('kelime').setDescription('Küfür listesine kelime ekler/çıkarır')
      .addStringOption((o) => o.setName('islem').setDescription('İşlem').setRequired(true).addChoices(
        { name: 'Ekle', value: 'ekle' }, { name: 'Çıkar', value: 'cikar' }, { name: 'Listele', value: 'liste' }, { name: 'Varsayılana sıfırla', value: 'sifirla' },
      ))
      .addStringOption((o) => o.setName('kelimeler').setDescription('Virgülle ayır. Sonuna * koyarsan o kelimeyle başlayanlar da yakalanır (ör: kötü*)')))
    .addSubcommand((s) => s.setName('izinli-link').setDescription('Link engelinden muaf alan adları')
      .addStringOption((o) => o.setName('islem').setDescription('İşlem').setRequired(true).addChoices({ name: 'Ekle', value: 'ekle' }, { name: 'Çıkar', value: 'cikar' }))
      .addStringOption((o) => o.setName('alan-adi').setDescription('ör: youtube.com').setRequired(true)))
    .addSubcommand((s) => s.setName('muaf').setDescription('Bir rolü veya kanalı AutoMod\'dan muaf tutar / muafiyeti kaldırır')
      .addRoleOption((o) => o.setName('rol').setDescription('Muaf rol'))
      .addChannelOption((o) => o.setName('kanal').setDescription('Muaf kanal veya kategori').addChannelTypes(ChannelType.GuildText, ChannelType.GuildCategory, ChannelType.GuildAnnouncement, ChannelType.GuildVoice))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const cfg = db.guild(interaction.guild.id).automod;

    switch (sub) {
      case 'durum': {
        const embed = base().setTitle('🤖 AutoMod Ayarları')
          .setDescription(`**Durum:** ${cfg.enabled ? '🟢 Açık' : '🔴 Kapalı'}\n*Yetkililer (Mesajları Yönet izni) filtrelerden muaftır.*`)
          .addFields(
            { name: 'Filtreler', value: Object.entries(FILTERS).map(([k, label]) => `${onOff(cfg[k])} ${label}`).join('\n'), inline: true },
            { name: 'Ceza', value: `${ACTIONS[cfg.action]}${cfg.action === 'sustur' ? ` (${cfg.muteMinutes} dk)` : ''}\n📢 Etiket limiti: ${cfg.mentionLimit || 'kapalı'}`, inline: true },
            { name: 'İzinli linkler', value: cfg.allowedLinks.join(', ') || '—' },
            { name: 'Muaf roller', value: cfg.exemptRoles.map((id) => `<@&${id}>`).join(' ') || '—', inline: true },
            { name: 'Muaf kanallar', value: cfg.exemptChannels.map((id) => `<#${id}>`).join(' ') || '—', inline: true },
            { name: 'Küfür listesi', value: `${cfg.words.length} kelime (\`/automod kelime islem:Listele\`)` },
          );
        return reply(interaction, embed);
      }
      case 'ac':
        cfg.enabled = true;
        if (!Object.keys(FILTERS).some((k) => cfg[k])) Object.assign(cfg, { invites: true, badwords: true, spam: true, mentionLimit: cfg.mentionLimit || 6 });
        db.save();
        return replyOk(interaction, 'AutoMod açıldı. Ayarları `/automod durum` ile görebilirsin.');
      case 'kapat':
        cfg.enabled = false;
        db.save();
        return replyOk(interaction, 'AutoMod kapatıldı.');
      case 'filtre': {
        const type = interaction.options.getString('tur');
        cfg[type] = interaction.options.getBoolean('aktif');
        if (cfg[type]) cfg.enabled = true;
        db.save();
        return replyOk(interaction, `${FILTERS[type]} ${cfg[type] ? 'açıldı' : 'kapatıldı'}.`);
      }
      case 'etiket-limit':
        cfg.mentionLimit = interaction.options.getInteger('sayi');
        if (cfg.mentionLimit) cfg.enabled = true;
        db.save();
        return replyOk(interaction, cfg.mentionLimit ? `Bir mesajda ${cfg.mentionLimit} ve üzeri etiket engellenecek.` : 'Etiket limiti kapatıldı.');
      case 'ceza':
        cfg.action = interaction.options.getString('islem');
        cfg.muteMinutes = interaction.options.getInteger('dakika') || cfg.muteMinutes;
        db.save();
        return replyOk(interaction, `İhlal cezası: ${ACTIONS[cfg.action]}${cfg.action === 'sustur' ? ` (${cfg.muteMinutes} dk)` : ''}`);
      case 'kelime': {
        const op = interaction.options.getString('islem');
        const words = (interaction.options.getString('kelimeler') || '').split(',').map((w) => w.trim().toLocaleLowerCase('tr')).filter(Boolean);
        if (op === 'liste') return reply(interaction, base().setTitle(`🤬 Küfür Listesi (${cfg.words.length})`).setDescription(`||${cfg.words.join(', ') || 'boş'}||`.slice(0, 4000)));
        if (op === 'sifirla') { cfg.words = [...db.DEFAULT_BADWORDS]; db.save(); return replyOk(interaction, 'Küfür listesi varsayılana sıfırlandı.'); }
        if (!words.length) return replyFail(interaction, '`kelimeler` alanını doldur.');
        if (op === 'ekle') cfg.words = [...new Set([...cfg.words, ...words])];
        else cfg.words = cfg.words.filter((w) => !words.includes(w));
        db.save();
        return replyOk(interaction, `${words.length} kelime ${op === 'ekle' ? 'eklendi' : 'çıkarıldı'}. Toplam: ${cfg.words.length}`);
      }
      case 'izinli-link': {
        const domain = interaction.options.getString('alan-adi').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        if (interaction.options.getString('islem') === 'ekle') {
          if (!cfg.allowedLinks.includes(domain)) cfg.allowedLinks.push(domain);
        } else cfg.allowedLinks = cfg.allowedLinks.filter((d) => d !== domain);
        db.save();
        return replyOk(interaction, `İzinli linkler: ${cfg.allowedLinks.join(', ') || '—'}`);
      }
      case 'muaf': {
        const role = interaction.options.getRole('rol');
        const channel = interaction.options.getChannel('kanal');
        if (!role && !channel) return replyFail(interaction, 'Bir rol veya kanal seç.');
        const msgs = [];
        const toggle = (list, id, label) => {
          const i = list.indexOf(id);
          if (i === -1) { list.push(id); msgs.push(`${label} muaf tutuldu`); } else { list.splice(i, 1); msgs.push(`${label} muafiyeti kaldırıldı`); }
        };
        if (role) toggle(cfg.exemptRoles, role.id, `${role}`);
        if (channel) toggle(cfg.exemptChannels, channel.id, `${channel}`);
        db.save();
        return replyOk(interaction, `${msgs.join(', ')}.`);
      }
      default:
        return replyFail(interaction, 'Bilinmeyen işlem.');
    }
  },
};
