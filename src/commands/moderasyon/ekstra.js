// Jail (cezalı), snipe, uyarı eşiği cezaları, toplu rol, süreli rol.
const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js');
const db = require('../../lib/db');
const { base, reply, replyOk, replyFail } = require('../../lib/embeds');
const { createCase, notifyUser } = require('../../lib/modcase');
const { checkHierarchy, parseDuration, formatDuration, ts, truncate } = require('../../lib/util');
const snipe = require('../../lib/snipe');
const { colors } = require('../../config');

const build = (name, desc, perm) => new SlashCommandBuilder().setName(name).setDescription(desc)
  .setDefaultMemberPermissions(perm).setContexts(InteractionContextType.Guild);

// Jail'i kaldırır ve eski rolleri geri verir (zamanlayıcı da kullanır)
async function release(guild, userId, by, reason) {
  const g = db.guild(guild.id).jail;
  const entry = g.users[userId];
  if (!entry) return false;
  delete g.users[userId];
  db.save();
  const member = await guild.members.fetch(userId).catch(() => null);
  if (member) {
    if (g.roleId) await member.roles.remove(g.roleId, 'Jail bitti').catch(() => {});
    const back = entry.roles.filter((id) => guild.roles.cache.get(id)?.editable);
    if (back.length) await member.roles.add(back, 'Jail bitti, roller iade').catch(() => {});
  }
  await createCase(guild, { type: 'unjail', targetId: userId, modId: by, reason });
  return true;
}

module.exports = [
  {
    data: build('jail', '⛓️ Üyeyi cezalıya atar: tüm rolleri alınır, sadece cezalı kanalını görür.', PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName('kullanici').setDescription('Üye').setRequired(true))
      .addStringOption((o) => o.setName('sebep').setDescription('Sebep').setMaxLength(300))
      .addStringOption((o) => o.setName('sure').setDescription('Süre: 1h, 1d, 7d... (boş = süresiz)')),
    async execute(interaction) {
      const g = db.guild(interaction.guild.id).jail;
      if (!g.roleId) return replyFail(interaction, 'Önce `/jail-ayar` ile cezalı rolünü ayarla.');
      const member = interaction.options.getMember('kullanici');
      if (!member) return replyFail(interaction, 'Üye bulunamadı.');
      const err = checkHierarchy(interaction, member);
      if (err) return replyFail(interaction, err);
      if (g.users[member.id]) return replyFail(interaction, 'Bu üye zaten cezalıda.');
      const durRaw = interaction.options.getString('sure');
      const duration = durRaw ? parseDuration(durRaw) : null;
      if (durRaw && !duration) return replyFail(interaction, 'Süre anlaşılamadı. Örnek: `2h`, `3d`');
      const reason = interaction.options.getString('sebep');
      const saved = member.roles.cache.filter((r) => r.id !== interaction.guild.id && !r.managed && r.editable).map((r) => r.id);
      g.users[member.id] = { roles: saved, until: duration ? Date.now() + duration : null, reason, by: interaction.user.id };
      db.save();
      await member.roles.remove(saved, `Jail: ${interaction.user.tag}`).catch(() => {});
      await member.roles.add(g.roleId, `Jail: ${interaction.user.tag}`);
      if (member.voice.channelId) await member.voice.disconnect('Jail').catch(() => {});
      await notifyUser(member.user, interaction.guild, 'jail', reason, duration);
      const c = await createCase(interaction.guild, { type: 'jail', targetId: member.id, modId: interaction.user.id, reason, duration });
      return reply(interaction, base(colors.error).setTitle('⛓️ Cezalıya atıldı').setThumbnail(member.user.displayAvatarURL())
        .setDescription(`${member} cezalıya atıldı.\n**Sebep:** ${reason || 'Belirtilmedi'}\n**Süre:** ${duration ? `${formatDuration(duration)} (${ts(Date.now() + duration, 'R')})` : 'Süresiz'}\n**Saklanan rol:** ${saved.length}\n**Vaka:** #${c.id}`), { ephemeral: false });
    },
  },
  {
    data: build('unjail', '🔓 Üyeyi cezalıdan çıkarır ve rollerini geri verir.', PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName('kullanici').setDescription('Üye').setRequired(true))
      .addStringOption((o) => o.setName('sebep').setDescription('Sebep').setMaxLength(300)),
    async execute(interaction) {
      const user = interaction.options.getUser('kullanici');
      const ok = await release(interaction.guild, user.id, interaction.user.id, interaction.options.getString('sebep'));
      return ok ? replyOk(interaction, `${user} cezalıdan çıkarıldı, rolleri iade edildi.`, { ephemeral: false }) : replyFail(interaction, 'Bu üye cezalıda değil.');
    },
  },
  {
    data: build('jail-ayar', '⚙️ Cezalı rolünü ayarlar (rol tüm kanalları görmemeli).', PermissionFlagsBits.ManageGuild)
      .addRoleOption((o) => o.setName('rol').setDescription('Cezalı rolü').setRequired(true)),
    async execute(interaction) {
      const role = interaction.options.getRole('rol');
      if (!role.editable) return replyFail(interaction, 'Bu rolü veremem, rolümü yukarı taşı.');
      db.guild(interaction.guild.id).jail.roleId = role.id;
      db.save();
      return replyOk(interaction, `Cezalı rolü ${role} olarak ayarlandı. Kanal izinlerinden bu rolün sadece cezalı kanalını görmesini sağla.`);
    },
  },
  {
    data: build('snipe', '👀 Kanalda son silinen mesajı gösterir.', PermissionFlagsBits.ManageMessages)
      .addIntegerOption((o) => o.setName('sira').setDescription('Kaçıncı son silinen? (1-10)').setMinValue(1).setMaxValue(10)),
    async execute(interaction) {
      const list = snipe.get(interaction.channelId);
      const n = (interaction.options.getInteger('sira') || 1) - 1;
      const m = list[n];
      if (!m) return replyFail(interaction, 'Bu kanalda yakın zamanda silinen mesaj yok.');
      const embed = base(colors.dark).setAuthor({ name: m.tag, iconURL: m.avatar }).setDescription(truncate(m.content, 4000) || '*içerik yok*')
        .setFooter({ text: `${n + 1}/${list.length} • silindi` }).setTimestamp(m.at);
      if (m.image) embed.setImage(m.image);
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
  },
  {
    data: build('uyari-ceza', '⚖️ Belirli uyarı sayısına ulaşınca otomatik ceza (ör: 3 uyarı = 1 saat susturma).', PermissionFlagsBits.ManageGuild)
      .addSubcommand((s) => s.setName('ekle').setDescription('Kural ekler')
        .addIntegerOption((o) => o.setName('uyari').setDescription('Kaçıncı uyarıda?').setRequired(true).setMinValue(1).setMaxValue(50))
        .addStringOption((o) => o.setName('ceza').setDescription('Ceza').setRequired(true).addChoices(
          { name: '🔇 Sustur', value: 'sustur' }, { name: '⛓️ Jail', value: 'jail' }, { name: '👢 At', value: 'at' }, { name: '🔨 Yasakla', value: 'ban' },
        ))
        .addStringOption((o) => o.setName('sure').setDescription('Susturma/jail süresi (ör: 1h, 1d)')))
      .addSubcommand((s) => s.setName('sil').setDescription('Kuralı siler')
        .addIntegerOption((o) => o.setName('uyari').setDescription('Uyarı sayısı').setRequired(true)))
      .addSubcommand((s) => s.setName('liste').setDescription('Kuralları listeler')),
    async execute(interaction) {
      const g = db.guild(interaction.guild.id);
      const sub = interaction.options.getSubcommand();
      if (sub === 'ekle') {
        const count = interaction.options.getInteger('uyari');
        const action = interaction.options.getString('ceza');
        const ms = interaction.options.getString('sure') ? parseDuration(interaction.options.getString('sure')) : null;
        if (action === 'sustur' && (!ms || ms > 28 * 864e5)) return replyFail(interaction, 'Susturma için 28 günü geçmeyen bir süre gir.');
        g.warnPunish = g.warnPunish.filter((r) => r.count !== count);
        g.warnPunish.push({ count, action, ms });
        g.warnPunish.sort((a, b) => a.count - b.count);
      } else if (sub === 'sil') {
        g.warnPunish = g.warnPunish.filter((r) => r.count !== interaction.options.getInteger('uyari'));
      }
      db.save();
      const names = { sustur: '🔇 Sustur', jail: '⛓️ Jail', at: '👢 At', ban: '🔨 Yasakla' };
      return reply(interaction, base().setTitle('⚖️ Uyarı Cezaları').setDescription(g.warnPunish.map((r) => `**${r.count}. uyarı** → ${names[r.action]}${r.ms ? ` (${formatDuration(r.ms)})` : ''}`).join('\n') || 'Kural yok.'));
    },
  },
  {
    data: build('toplu-rol', '🎭 Bir rolü herkese veya bir roldekilere toplu verir/alır.', PermissionFlagsBits.ManageRoles)
      .addStringOption((o) => o.setName('islem').setDescription('İşlem').setRequired(true).addChoices({ name: 'Ver', value: 'ver' }, { name: 'Al', value: 'al' }))
      .addRoleOption((o) => o.setName('rol').setDescription('Verilecek/alınacak rol').setRequired(true))
      .addRoleOption((o) => o.setName('hedef').setDescription('Sadece bu roldekiler (boş = herkes)')),
    async execute(interaction) {
      const role = interaction.options.getRole('rol');
      if (!role.editable || role.managed) return replyFail(interaction, 'Bu rolü yönetemem.');
      if (interaction.user.id !== interaction.guild.ownerId && role.position >= interaction.member.roles.highest.position) return replyFail(interaction, 'Bu rol senin rolünden yüksek.');
      const give = interaction.options.getString('islem') === 'ver';
      const target = interaction.options.getRole('hedef');
      await interaction.deferReply();
      await interaction.guild.members.fetch();
      const members = interaction.guild.members.cache.filter((m) => !m.user.bot && (!target || m.roles.cache.has(target.id)) && (give ? !m.roles.cache.has(role.id) : m.roles.cache.has(role.id)));
      let done = 0;
      for (const m of members.values()) {
        const ok = await (give ? m.roles.add(role, `Toplu rol: ${interaction.user.tag}`) : m.roles.remove(role, `Toplu rol: ${interaction.user.tag}`)).then(() => true).catch(() => false);
        if (ok) done++;
      }
      return interaction.editReply({ embeds: [base(colors.success).setDescription(`🎭 ${role} rolü **${done}** kişiye ${give ? 'verildi' : 'alındı'}.`)] });
    },
  },
  {
    data: build('sureli-rol', '⏳ Süreli rol verir; süre bitince rol otomatik alınır.', PermissionFlagsBits.ManageRoles)
      .addUserOption((o) => o.setName('kullanici').setDescription('Üye').setRequired(true))
      .addRoleOption((o) => o.setName('rol').setDescription('Rol').setRequired(true))
      .addStringOption((o) => o.setName('sure').setDescription('Süre: 1d, 7d, 30d...').setRequired(true)),
    async execute(interaction) {
      const member = interaction.options.getMember('kullanici');
      const role = interaction.options.getRole('rol');
      const ms = parseDuration(interaction.options.getString('sure'));
      if (!member || !ms) return replyFail(interaction, 'Geçerli bir üye ve süre gir.');
      if (!role.editable || role.managed) return replyFail(interaction, 'Bu rolü veremem.');
      await member.roles.add(role, `Süreli rol: ${interaction.user.tag}`);
      const g = db.guild(interaction.guild.id);
      g.tempRoles = g.tempRoles.filter((t) => !(t.userId === member.id && t.roleId === role.id));
      g.tempRoles.push({ userId: member.id, roleId: role.id, until: Date.now() + ms });
      db.save();
      return replyOk(interaction, `${member} kullanıcısına ${role} verildi. ${ts(Date.now() + ms, 'R')} otomatik alınacak.`, { ephemeral: false });
    },
  },
];

// /jail ver|kaldir|ayar olarak birleştir; uyarı cezaları /uyari altına taşınır
const { regroup } = require('../../lib/group');
const ceza = module.exports.find((c) => c.data.name === 'uyari-ceza');
module.exports = regroup(module.exports.filter((c) => c !== ceza), [
  {
    name: 'jail', description: '⛓️ Cezalı (jail) sistemi: rolleri saklanır, sadece cezalı kanalını görür.', perm: PermissionFlagsBits.ModerateMembers,
    parts: [{ sub: 'ver', from: 'jail' }, { sub: 'kaldir', from: 'unjail' }, { sub: 'ayar', from: 'jail-ayar', perm: PermissionFlagsBits.ManageGuild }],
  },
]);
module.exports.release = release;
module.exports.ceza = ceza;
