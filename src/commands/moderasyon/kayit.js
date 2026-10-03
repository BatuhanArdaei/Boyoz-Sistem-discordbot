// Kayıt sistemi: /kayit, /kayitsiz, /isimler, /kayit-stat, /kayit-ayar
const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ChannelType } = require('discord.js');
const db = require('../../lib/db');
const economy = require('../../lib/economy');
const { base, reply, replyOk, replyFail } = require('../../lib/embeds');
const { checkHierarchy, ts } = require('../../lib/util');
const { colors } = require('../../config');

const build = (name, desc, perm = PermissionFlagsBits.ManageNicknames) => new SlashCommandBuilder()
  .setName(name).setDescription(desc).setDefaultMemberPermissions(perm).setContexts(InteractionContextType.Guild);

const titleCase = (s) => s.trim().split(/\s+/).map((w) => w.charAt(0).toLocaleUpperCase('tr') + w.slice(1).toLocaleLowerCase('tr')).join(' ');
const GENDERS = { erkek: '👨 Erkek', kiz: '👩 Kız', yok: '👤 Belirtilmedi' };

module.exports = [
  {
    data: build('kayit', '📝 Üyeyi kayıt eder: isim, yaş ve cinsiyet rolleri.')
      .addUserOption((o) => o.setName('kullanici').setDescription('Kayıt edilecek üye').setRequired(true))
      .addStringOption((o) => o.setName('isim').setDescription('İsim').setRequired(true).setMaxLength(20))
      .addIntegerOption((o) => o.setName('yas').setDescription('Yaş').setRequired(true).setMinValue(1).setMaxValue(99))
      .addStringOption((o) => o.setName('cinsiyet').setDescription('Cinsiyet rolü').setRequired(true).addChoices(
        { name: 'Erkek', value: 'erkek' }, { name: 'Kız', value: 'kiz' }, { name: 'Belirtmek istemiyor', value: 'yok' },
      )),
    async execute(interaction) {
      const k = db.guild(interaction.guild.id).kayit;
      if (!k.enabled) return replyFail(interaction, 'Kayıt sistemi kapalı. Yetkililer `/kayit-ayar` ile açabilir.');
      const member = interaction.options.getMember('kullanici');
      if (!member || member.user.bot) return replyFail(interaction, 'Geçerli bir üye seç.');
      const err = checkHierarchy(interaction, member);
      if (err) return replyFail(interaction, err);
      const age = interaction.options.getInteger('yas');
      if (k.minAge && age < k.minAge) return replyFail(interaction, `Kayıt için en az **${k.minAge}** yaşında olmak gerekiyor.`);
      const gender = interaction.options.getString('cinsiyet');
      const name = titleCase(interaction.options.getString('isim'));
      const nick = k.nameFormat.replace('{isim}', name).replace('{yas}', age).slice(0, 32);

      const add = [...k.memberRoles, ...(gender === 'erkek' ? k.maleRoles : gender === 'kiz' ? k.femaleRoles : [])]
        .filter((id) => interaction.guild.roles.cache.get(id)?.editable);
      const remove = [k.unregRoleId, k.suspiciousRoleId].filter((id) => id && member.roles.cache.has(id));
      if (!add.length) return replyFail(interaction, 'Verilecek kayıt rolü ayarlı değil. `/kayit-ayar roller` ile ayarla.');
      await member.roles.remove(remove, `Kayıt: ${interaction.user.tag}`).catch(() => {});
      await member.roles.add(add, `Kayıt: ${interaction.user.tag}`);
      if (member.manageable) await member.setNickname(nick, `Kayıt: ${interaction.user.tag}`).catch(() => {});

      (k.history[member.id] ??= []).push({ name: nick, by: interaction.user.id, gender, at: Date.now() });
      const st = (k.stats[interaction.user.id] ??= { erkek: 0, kiz: 0, yok: 0, toplam: 0 });
      st[gender] += 1; st.toplam += 1;
      if (k.reward) economy.add(interaction.guild.id, interaction.user.id, k.reward);
      db.save();
      return reply(interaction, base(colors.success).setTitle('✅ Kayıt tamamlandı')
        .setThumbnail(member.user.displayAvatarURL())
        .setDescription(`${member} kayıt edildi!\n🏷️ İsim: **${nick}** • ${GENDERS[gender]}\n🎭 Verilen roller: ${add.map((id) => `<@&${id}>`).join(' ')}`)
        .setFooter({ text: `Kayıt eden: ${interaction.user.username} • toplam ${st.toplam} kayıt${k.reward ? ` • +${k.reward} 🥐` : ''}` }), { ephemeral: false });
    },
  },
  {
    data: build('kayitsiz', '↩️ Üyeyi kayıtsıza atar (kayıt rollerini alır).')
      .addUserOption((o) => o.setName('kullanici').setDescription('Üye').setRequired(true)),
    async execute(interaction) {
      const k = db.guild(interaction.guild.id).kayit;
      const member = interaction.options.getMember('kullanici');
      if (!member) return replyFail(interaction, 'Üye bulunamadı.');
      const err = checkHierarchy(interaction, member);
      if (err) return replyFail(interaction, err);
      const take = [...k.memberRoles, ...k.maleRoles, ...k.femaleRoles].filter((id) => member.roles.cache.has(id));
      await member.roles.remove(take, `Kayıtsıza atıldı: ${interaction.user.tag}`).catch(() => {});
      if (k.unregRoleId) await member.roles.add(k.unregRoleId).catch(() => {});
      if (member.manageable) await member.setNickname('Kayıtsız').catch(() => {});
      return replyOk(interaction, `${member} kayıtsıza atıldı.`, { ephemeral: false });
    },
  },
  {
    data: build('isimler', '📜 Üyenin kayıt/isim geçmişini gösterir.')
      .addUserOption((o) => o.setName('kullanici').setDescription('Üye').setRequired(true)),
    async execute(interaction) {
      const user = interaction.options.getUser('kullanici');
      const list = db.guild(interaction.guild.id).kayit.history[user.id] || [];
      return reply(interaction, base().setTitle(`📜 ${user.username} • İsim Geçmişi`).setDescription(list.length
        ? list.slice(-15).reverse().map((h) => `• **${h.name}** ${GENDERS[h.gender] || ''} — <@${h.by}> ${ts(h.at, 'R')}`).join('\n')
        : 'Kayıt geçmişi yok.'));
    },
  },
  {
    data: build('kayit-stat', '📊 Yetkililerin kayıt istatistikleri.')
      .addUserOption((o) => o.setName('yetkili').setDescription('Yetkili (boş = sıralama)')),
    async execute(interaction) {
      const stats = db.guild(interaction.guild.id).kayit.stats;
      const user = interaction.options.getUser('yetkili');
      if (user) {
        const s = stats[user.id] || { erkek: 0, kiz: 0, yok: 0, toplam: 0 };
        return reply(interaction, base().setAuthor({ name: `${user.username} • Kayıt İstatistiği`, iconURL: user.displayAvatarURL() })
          .setDescription(`Toplam: **${s.toplam}**\n👨 Erkek: **${s.erkek}** • 👩 Kız: **${s.kiz}** • 👤 Diğer: **${s.yok}**`), { ephemeral: false });
      }
      const top = Object.entries(stats).sort((a, b) => b[1].toplam - a[1].toplam).slice(0, 15);
      return reply(interaction, base().setTitle('🏆 Kayıt Sıralaması').setDescription(top.length
        ? top.map(([id, s], i) => `**${i + 1}.** <@${id}> • ${s.toplam} kayıt (👨 ${s.erkek} • 👩 ${s.kiz})`).join('\n') : 'Henüz kayıt yapılmamış.'), { ephemeral: false });
    },
  },
  {
    data: build('kayit-ayar', '⚙️ Kayıt sistemini ayarlar.', PermissionFlagsBits.ManageGuild)
      .addSubcommand((s) => s.setName('durum').setDescription('Ayarları gösterir'))
      .addSubcommand((s) => s.setName('ac-kapat').setDescription('Kayıt sistemini açar/kapatır')
        .addBooleanOption((o) => o.setName('aktif').setDescription('Açık/kapalı').setRequired(true)))
      .addSubcommand((s) => s.setName('roller').setDescription('Kayıt rollerini ayarlar')
        .addRoleOption((o) => o.setName('kayitsiz').setDescription('Yeni gelenlere verilen kayıtsız rolü'))
        .addRoleOption((o) => o.setName('uye').setDescription('Kayıt olan herkese verilen rol'))
        .addRoleOption((o) => o.setName('erkek').setDescription('Erkek rolü'))
        .addRoleOption((o) => o.setName('kiz').setDescription('Kız rolü'))
        .addRoleOption((o) => o.setName('yetkili').setDescription('Kayıt yetkilisi rolü (yeni gelenlerde etiketlenir)')))
      .addSubcommand((s) => s.setName('kanal').setDescription('Yeni gelenlerin karşılanacağı kayıt kanalı')
        .addChannelOption((o) => o.setName('kanal').setDescription('Kanal').setRequired(true).addChannelTypes(ChannelType.GuildText)))
      .addSubcommand((s) => s.setName('format').setDescription('İsim formatı ve kurallar')
        .addStringOption((o) => o.setName('format').setDescription('Örn: {isim} | {yas}  •  ✦ {isim} ・ {yas}').setMaxLength(30))
        .addIntegerOption((o) => o.setName('min-yas').setDescription('Minimum kayıt yaşı (0 = yok)').setMinValue(0).setMaxValue(99))
        .addIntegerOption((o) => o.setName('odul').setDescription('Kayıt başına yetkiliye boyoz').setMinValue(0).setMaxValue(10000)))
      .addSubcommand((s) => s.setName('supheli').setDescription('Yeni hesaplar için şüpheli karantinası')
        .addRoleOption((o) => o.setName('rol').setDescription('Şüpheli rolü (boş = kapat)'))
        .addIntegerOption((o) => o.setName('gun').setDescription('Kaç günden yeni hesaplar şüpheli? (varsayılan 7)').setMinValue(1).setMaxValue(90))),
    async execute(interaction) {
      const k = db.guild(interaction.guild.id).kayit;
      const sub = interaction.options.getSubcommand();
      const role = (n) => interaction.options.getRole(n);
      if (sub === 'ac-kapat') { k.enabled = interaction.options.getBoolean('aktif'); }
      if (sub === 'roller') {
        if (role('kayitsiz')) k.unregRoleId = role('kayitsiz').id;
        if (role('uye')) k.memberRoles = [role('uye').id];
        if (role('erkek')) k.maleRoles = [role('erkek').id];
        if (role('kiz')) k.femaleRoles = [role('kiz').id];
        if (role('yetkili')) k.staffRoleId = role('yetkili').id;
      }
      if (sub === 'kanal') k.channelId = interaction.options.getChannel('kanal').id;
      if (sub === 'format') {
        const f = interaction.options.getString('format');
        if (f && !f.includes('{isim}')) return replyFail(interaction, 'Format `{isim}` içermeli.');
        if (f) k.nameFormat = f;
        if (interaction.options.getInteger('min-yas') !== null) k.minAge = interaction.options.getInteger('min-yas');
        if (interaction.options.getInteger('odul') !== null) k.reward = interaction.options.getInteger('odul');
      }
      if (sub === 'supheli') {
        k.suspiciousRoleId = role('rol')?.id || null;
        if (interaction.options.getInteger('gun')) k.suspiciousDays = interaction.options.getInteger('gun');
      }
      db.save();
      const r = (id) => (id ? `<@&${id}>` : '`yok`');
      return reply(interaction, base().setTitle('⚙️ Kayıt Sistemi').addFields(
        { name: 'Durum', value: k.enabled ? '🟢 Açık' : '🔴 Kapalı', inline: true },
        { name: 'Kanal', value: k.channelId ? `<#${k.channelId}>` : '`yok`', inline: true },
        { name: 'İsim formatı', value: `\`${k.nameFormat}\``, inline: true },
        { name: 'Kayıtsız', value: r(k.unregRoleId), inline: true },
        { name: 'Üye', value: k.memberRoles.map(r).join(' ') || '`yok`', inline: true },
        { name: 'Yetkili', value: r(k.staffRoleId), inline: true },
        { name: 'Erkek', value: k.maleRoles.map(r).join(' ') || '`yok`', inline: true },
        { name: 'Kız', value: k.femaleRoles.map(r).join(' ') || '`yok`', inline: true },
        { name: 'Şüpheli', value: k.suspiciousRoleId ? `${r(k.suspiciousRoleId)} (< ${k.suspiciousDays} gün)` : '`kapalı`', inline: true },
        { name: 'Min. yaş / ödül', value: `${k.minAge || 'yok'} / ${k.reward} 🥐`, inline: true },
      ).setFooter({ text: 'Sistem açıkken yeni gelenlere otorol yerine kayıtsız rolü verilir.' }));
    },
  },
];

const { regroup } = require('../../lib/group');

module.exports = regroup(module.exports, [
  {
    name: 'kayit', description: '📝 Kayıt sistemi: kayıt et, kayıtsıza at, isim geçmişi, istatistik.', perm: PermissionFlagsBits.ManageNicknames,
    parts: [{ sub: 'yap', from: 'kayit' }, { sub: 'kayitsiz', from: 'kayitsiz' }, { sub: 'isimler', from: 'isimler' }, { sub: 'stat', from: 'kayit-stat' }],
  },
]);
