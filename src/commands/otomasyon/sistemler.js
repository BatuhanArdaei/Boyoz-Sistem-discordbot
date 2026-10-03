// /otocevap, /seviye-ayar, /rolmenu
const {
  SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ChannelType,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
} = require('discord.js');
const db = require('../../lib/db');
const { base, replyOk, replyFail, reply, files, urls } = require('../../lib/embeds');
const { truncate, parseColor } = require('../../lib/util');

const MATCH = { icerir: 'İçeriyorsa', tam: 'Tam eşleşme', baslar: 'İle başlıyorsa' };

module.exports = [
  // ---------------------------------------------------------------- /otocevap
  {
    data: new SlashCommandBuilder()
      .setName('otocevap')
      .setDescription('💬 Belirli kelimelere otomatik cevap verir.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setContexts(InteractionContextType.Guild)
      .addSubcommand((s) => s.setName('ekle').setDescription('Otomatik cevap ekler')
        .addStringOption((o) => o.setName('tetik').setDescription('Tetikleyici kelime/cümle').setRequired(true).setMaxLength(100))
        .addStringOption((o) => o.setName('cevap').setDescription('Cevap ({kullanici}, {sunucu} kullanılabilir; boş bırakıp sadece tepki de verebilirsin)').setMaxLength(1500))
        .addStringOption((o) => o.setName('eslesme').setDescription('Eşleşme türü').addChoices(...Object.entries(MATCH).map(([value, name]) => ({ name, value }))))
        .addStringOption((o) => o.setName('tepki').setDescription('Mesaja bırakılacak emoji (ör: 🥐)')))
      .addSubcommand((s) => s.setName('sil').setDescription('Otomatik cevabı siler')
        .addStringOption((o) => o.setName('tetik').setDescription('Tetikleyici').setRequired(true).setAutocomplete(true)))
      .addSubcommand((s) => s.setName('liste').setDescription('Otomatik cevapları listeler')),

    async autocomplete(interaction) {
      const focused = interaction.options.getFocused().toLowerCase();
      const list = db.guild(interaction.guild.id).autoresponses.filter((a) => a.trigger.toLowerCase().includes(focused));
      await interaction.respond(list.slice(0, 25).map((a) => ({ name: a.trigger.slice(0, 100), value: a.trigger.slice(0, 100) })));
    },

    async execute(interaction) {
      const sub = interaction.options.getSubcommand();
      const g = db.guild(interaction.guild.id);
      if (sub === 'liste') {
        return reply(interaction, base().setTitle(`💬 Otomatik Cevaplar (${g.autoresponses.length})`).setDescription(g.autoresponses.length
          ? g.autoresponses.map((a, i) => `**${i + 1}.** \`${a.trigger}\` *(${MATCH[a.match]})* ${a.react || ''}\n└ ${truncate(a.response, 100) || '*sadece tepki*'}`).join('\n').slice(0, 4000)
          : 'Henüz otomatik cevap yok.'));
      }
      const trigger = interaction.options.getString('tetik').trim();
      if (sub === 'sil') {
        const before = g.autoresponses.length;
        g.autoresponses = g.autoresponses.filter((a) => a.trigger.toLowerCase() !== trigger.toLowerCase());
        db.save();
        return before === g.autoresponses.length ? replyFail(interaction, 'Bu tetikleyici bulunamadı.') : replyOk(interaction, `\`${trigger}\` silindi.`);
      }
      const response = interaction.options.getString('cevap') || '';
      const react = interaction.options.getString('tepki');
      if (!response && !react) return replyFail(interaction, 'Cevap veya tepki girmelisin.');
      if (g.autoresponses.length >= 100) return replyFail(interaction, 'En fazla 100 otomatik cevap eklenebilir.');
      g.autoresponses = g.autoresponses.filter((a) => a.trigger.toLowerCase() !== trigger.toLowerCase());
      g.autoresponses.push({ trigger, response, match: interaction.options.getString('eslesme') || 'icerir', react });
      db.save();
      return replyOk(interaction, `\`${trigger}\` yazılınca cevap verilecek.`);
    },
  },

  // ---------------------------------------------------------------- /seviye-ayar
  {
    data: new SlashCommandBuilder()
      .setName('seviye-ayar')
      .setDescription('📈 Seviye (XP) sistemini yönetir.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setContexts(InteractionContextType.Guild)
      .addSubcommand((s) => s.setName('ac').setDescription('Seviye sistemini açar')
        .addChannelOption((o) => o.setName('kanal').setDescription('Seviye atlama mesajlarının kanalı (boş = mesajın yazıldığı kanal)').addChannelTypes(ChannelType.GuildText))
        .addStringOption((o) => o.setName('mesaj').setDescription('Mesaj: {kullanici} {seviye} {sunucu}').setMaxLength(500)))
      .addSubcommand((s) => s.setName('kapat').setDescription('Seviye sistemini kapatır'))
      .addSubcommand((s) => s.setName('odul-ekle').setDescription('Seviyeye ulaşınca verilecek rol')
        .addIntegerOption((o) => o.setName('seviye').setDescription('Seviye').setRequired(true).setMinValue(1).setMaxValue(500))
        .addRoleOption((o) => o.setName('rol').setDescription('Rol').setRequired(true)))
      .addSubcommand((s) => s.setName('odul-sil').setDescription('Seviye ödülünü kaldırır')
        .addIntegerOption((o) => o.setName('seviye').setDescription('Seviye').setRequired(true)))
      .addSubcommand((s) => s.setName('sifirla').setDescription('Bir kullanıcının veya herkesin XP\'sini sıfırlar')
        .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı (boş = herkes)')))
      .addSubcommand((s) => s.setName('durum').setDescription('Ayarları gösterir')),

    async execute(interaction) {
      const sub = interaction.options.getSubcommand();
      const cfg = db.guild(interaction.guild.id).levels;
      switch (sub) {
        case 'ac': {
          cfg.enabled = true;
          const ch = interaction.options.getChannel('kanal');
          const msg = interaction.options.getString('mesaj');
          cfg.channel = ch?.id || null;
          if (msg) cfg.message = msg;
          db.save();
          return replyOk(interaction, `Seviye sistemi açıldı. Üyeler mesaj yazdıkça (dakikada bir) XP kazanacak.${ch ? ` Bildirimler ${ch} kanalına.` : ''}`);
        }
        case 'kapat':
          cfg.enabled = false; db.save();
          return replyOk(interaction, 'Seviye sistemi kapatıldı (XP verileri korunuyor).');
        case 'odul-ekle': {
          const level = interaction.options.getInteger('seviye');
          const role = interaction.options.getRole('rol');
          if (!role.editable || role.managed) return replyFail(interaction, 'Bu rolü veremem (rolüm aşağıda veya yönetilen rol).');
          cfg.rewards = cfg.rewards.filter((r) => r.level !== level);
          cfg.rewards.push({ level, roleId: role.id });
          cfg.rewards.sort((a, b) => a.level - b.level);
          db.save();
          return replyOk(interaction, `**${level}.** seviyeye ulaşanlara ${role} verilecek.`);
        }
        case 'odul-sil': {
          const level = interaction.options.getInteger('seviye');
          cfg.rewards = cfg.rewards.filter((r) => r.level !== level);
          db.save();
          return replyOk(interaction, `${level}. seviye ödülü kaldırıldı.`);
        }
        case 'sifirla': {
          const user = interaction.options.getUser('kullanici');
          if (user) delete cfg.users[user.id]; else cfg.users = {};
          db.save();
          return replyOk(interaction, user ? `${user} XP'si sıfırlandı.` : 'Tüm XP verileri sıfırlandı.');
        }
        default:
          return reply(interaction, base().setTitle('📈 Seviye Sistemi').addFields(
            { name: 'Durum', value: cfg.enabled ? '🟢 Açık' : '🔴 Kapalı', inline: true },
            { name: 'Kanal', value: cfg.channel ? `<#${cfg.channel}>` : 'Mesajın yazıldığı kanal', inline: true },
            { name: 'Kayıtlı üye', value: String(Object.keys(cfg.users).length), inline: true },
            { name: 'Mesaj', value: cfg.message },
            { name: 'Ödüller', value: cfg.rewards.map((r) => `Seviye **${r.level}** → <@&${r.roleId}>`).join('\n') || '—' },
          ));
      }
    },
  },

  // ---------------------------------------------------------------- /rolmenu
  {
    data: new SlashCommandBuilder()
      .setName('rolmenu')
      .setDescription('🎛️ Üyelerin kendi rollerini seçebileceği buton/menü paneli oluşturur.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .setContexts(InteractionContextType.Guild)
      .addStringOption((o) => o.setName('baslik').setDescription('Panel başlığı').setRequired(true).setMaxLength(200))
      .addRoleOption((o) => o.setName('rol1').setDescription('Rol 1').setRequired(true))
      .addRoleOption((o) => o.setName('rol2').setDescription('Rol 2'))
      .addRoleOption((o) => o.setName('rol3').setDescription('Rol 3'))
      .addRoleOption((o) => o.setName('rol4').setDescription('Rol 4'))
      .addRoleOption((o) => o.setName('rol5').setDescription('Rol 5'))
      .addRoleOption((o) => o.setName('rol6').setDescription('Rol 6'))
      .addRoleOption((o) => o.setName('rol7').setDescription('Rol 7'))
      .addRoleOption((o) => o.setName('rol8').setDescription('Rol 8'))
      .addStringOption((o) => o.setName('aciklama').setDescription('Panel açıklaması').setMaxLength(1500))
      .addStringOption((o) => o.setName('tip').setDescription('Panel tipi').addChoices(
        { name: 'Butonlar (çoklu seçim)', value: 'buton' }, { name: 'Açılır menü (çoklu seçim)', value: 'menu' }, { name: 'Açılır menü (tek seçim)', value: 'tek' },
      ))
      .addStringOption((o) => o.setName('renk').setDescription('Embed rengi'))
      .addChannelOption((o) => o.setName('kanal').setDescription('Gönderilecek kanal').addChannelTypes(ChannelType.GuildText)),

    async execute(interaction) {
      const roles = [];
      for (let i = 1; i <= 8; i++) {
        const r = interaction.options.getRole(`rol${i}`);
        if (r && !roles.some((x) => x.id === r.id)) roles.push(r);
      }
      const bad = roles.filter((r) => !r.editable || r.managed || r.id === interaction.guild.id);
      if (bad.length) return replyFail(interaction, `Şu rolleri veremem (rolümün altında olmalı): ${bad.join(' ')}`);
      if (roles.some((r) => r.permissions.has(PermissionFlagsBits.Administrator) || r.permissions.has(PermissionFlagsBits.ManageGuild))) {
        return replyFail(interaction, 'Güvenlik için yönetici yetkili roller rol menüsüne eklenemez.');
      }
      const type = interaction.options.getString('tip') || 'buton';
      const channel = interaction.options.getChannel('kanal') || interaction.channel;
      const embed = base(parseColor(interaction.options.getString('renk')))
        .setTitle(`🎛️ ${interaction.options.getString('baslik')}`)
        .setDescription(`${interaction.options.getString('aciklama')?.replace(/\\n/g, '\n') || 'Aşağıdan istediğin rolleri seçebilirsin.'}\n\n${roles.map((r) => `• ${r}`).join('\n')}`)
        .setThumbnail(urls.logo);

      let rows;
      if (type === 'buton') {
        rows = [];
        for (let i = 0; i < roles.length; i += 4) {
          rows.push(new ActionRowBuilder().addComponents(roles.slice(i, i + 4).map((r) => new ButtonBuilder()
            .setCustomId(`rolmenu:buton:${r.id}`).setLabel(r.name.slice(0, 80)).setStyle(ButtonStyle.Secondary))));
        }
      } else {
        rows = [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
          .setCustomId(`rolmenu:menu:${type}`)
          .setPlaceholder(type === 'tek' ? 'Bir rol seç...' : 'Rollerini seç...')
          .setMinValues(0)
          .setMaxValues(type === 'tek' ? 1 : roles.length)
          .addOptions(roles.map((r) => ({ label: r.name.slice(0, 100), value: r.id }))))];
      }
      const msg = await channel.send({ embeds: [embed], components: rows, files: [files.logo()] });
      db.guild(interaction.guild.id).rolemenus[msg.id] = roles.map((r) => r.id);
      db.save();
      return replyOk(interaction, `Rol menüsü ${channel} kanalına gönderildi.`);
    },

    components: {
      async buton(interaction, [roleId]) {
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role?.editable) return replyFail(interaction, 'Bu rol artık verilemiyor, yetkililere bildir.');
        const has = interaction.member.roles.cache.has(roleId);
        if (has) await interaction.member.roles.remove(role, 'Rol menüsü');
        else await interaction.member.roles.add(role, 'Rol menüsü');
        return replyOk(interaction, has ? `${role} rolü alındı.` : `${role} rolü verildi.`);
      },
      async menu(interaction) {
        const allowed = db.guild(interaction.guild.id).rolemenus[interaction.message.id]
          || interaction.component.options.map((o) => o.value);
        const selected = interaction.values.filter((id) => allowed.includes(id));
        const member = interaction.member;
        const add = selected.filter((id) => !member.roles.cache.has(id) && interaction.guild.roles.cache.get(id)?.editable);
        const remove = allowed.filter((id) => !selected.includes(id) && member.roles.cache.has(id) && interaction.guild.roles.cache.get(id)?.editable);
        if (add.length) await member.roles.add(add, 'Rol menüsü');
        if (remove.length) await member.roles.remove(remove, 'Rol menüsü');
        const parts = [];
        if (add.length) parts.push(`➕ ${add.map((id) => `<@&${id}>`).join(' ')}`);
        if (remove.length) parts.push(`➖ ${remove.map((id) => `<@&${id}>`).join(' ')}`);
        return reply(interaction, base().setDescription(parts.join('\n') || 'Değişiklik yok.'), { ephemeral: true });
      },
    },
  },
];
