// /market ve /market-yonet: boyozla rol (kalıcı/süreli) ve hazır ürünler satın alma.
const {
  SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ActionRowBuilder, StringSelectMenuBuilder,
} = require('discord.js');
const db = require('../../lib/db');
const economy = require('../../lib/economy');
const levels = require('../../lib/levels');
const { base, replyOk, replyFail, reply } = require('../../lib/embeds');
const { parseDuration, formatDuration, ts } = require('../../lib/util');
const { colors } = require('../../config');

// Her sunucuda hazır gelen ürünler
const BUILTIN = [
  { id: 'cark', name: '🎡 Ekstra Çark Hakkı', price: 120, description: 'Şans çarkı bekleme süreni sıfırlar.' },
  { id: 'xp', name: '📈 XP İksiri', price: 250, description: 'Anında +300 XP (seviye sistemi açıksa).' },
];

function allItems(guildId) {
  return [...BUILTIN.map((b) => ({ ...b, builtin: true })), ...db.guild(guildId).market.items];
}

function marketView(guildId, userId) {
  const items = allItems(guildId);
  const bal = economy.wallet(guildId, userId).balance;
  const lines = items.map((it) => {
    const stock = it.stock != null ? ` • 📦 ${Math.max(0, it.stock - (it.sold || 0))} kaldı` : '';
    const what = it.roleId ? `<@&${it.roleId}>${it.duration ? ` (${formatDuration(it.duration)})` : ' (kalıcı)'}` : it.description;
    return `**${it.name}** — ${economy.fmt(it.price)}${stock}\n└ ${what}`;
  });
  const menu = new StringSelectMenuBuilder().setCustomId('market:al').setPlaceholder('🛒 Satın almak için ürün seç...')
    .addOptions(items.slice(0, 25).map((it) => ({ label: `${it.name}`.slice(0, 100), value: String(it.id), description: `${it.price} boyoz`.slice(0, 100) })));
  return {
    embeds: [base().setTitle('🛒 Boyoz Market').setDescription(`${lines.join('\n\n')}\n\n👛 Cüzdanın: ${economy.fmt(bal)}`)
      .setFooter({ text: 'Boyoz kazanmak için: /boyoz gunluk, /cark, oyunlar, davet, seste vakit geçirmek…' })],
    components: [new ActionRowBuilder().addComponents(menu)],
  };
}

module.exports = [
  {
    data: new SlashCommandBuilder().setName('market').setDescription('🛒 Boyozlarınla rol ve ürün satın al!').setContexts(InteractionContextType.Guild),
    async execute(interaction) {
      await interaction.reply({ ...marketView(interaction.guild.id, interaction.user.id), allowedMentions: { parse: [] }, flags: 64 });
    },
    components: {
      async al(interaction) {
        const gid = interaction.guild.id;
        const it = allItems(gid).find((x) => String(x.id) === interaction.values[0]);
        if (!it) return replyFail(interaction, 'Bu ürün artık yok.');
        if (it.stock != null && (it.sold || 0) >= it.stock) return replyFail(interaction, 'Bu ürünün stoğu tükendi.');
        if (it.roleId) {
          const role = interaction.guild.roles.cache.get(it.roleId);
          if (!role?.editable) return replyFail(interaction, 'Bu rol şu an verilemiyor, yetkililere bildir.');
          if (interaction.member.roles.cache.has(role.id) && !it.duration) return replyFail(interaction, 'Bu role zaten sahipsin.');
        }
        if (!economy.take(gid, interaction.user.id, it.price)) {
          return replyFail(interaction, `Yeterli boyozun yok! Gereken: ${economy.fmt(it.price)} • Cüzdan: ${economy.fmt(economy.wallet(gid, interaction.user.id).balance)}`);
        }
        let result;
        if (it.id === 'cark') { economy.wallet(gid, interaction.user.id).lastSpin = 0; result = 'Çark hakkın yenilendi, `/cark` ile hemen çevir! 🎡'; }
        else if (it.id === 'xp') { await levels.grantXp(interaction.guild, interaction.member, 300, interaction.channel); result = '+300 XP kazandın! 📈'; }
        else {
          await interaction.member.roles.add(it.roleId, `Marketten satın alındı (${it.price} boyoz)`);
          if (it.duration) {
            const g = db.guild(gid);
            const existing = g.tempRoles.find((t) => t.userId === interaction.user.id && t.roleId === it.roleId);
            if (existing) existing.until += it.duration; // süre uzatma
            else g.tempRoles.push({ userId: interaction.user.id, roleId: it.roleId, until: Date.now() + it.duration });
            const until = (existing || g.tempRoles.at(-1)).until;
            result = `<@&${it.roleId}> rolün ${ts(until, 'R')} sona erecek.`;
          } else result = `<@&${it.roleId}> artık senin! 🎉`;
          it.sold = (it.sold || 0) + 1;
        }
        db.save();
        await interaction.update(marketView(gid, interaction.user.id));
        await interaction.followUp({ embeds: [base(colors.success).setDescription(`🛍️ **${it.name}** satın alındı! (-${economy.fmt(it.price)})\n${result}`)], flags: 64 });
      },
    },
  },
  {
    data: new SlashCommandBuilder().setName('market-yonet').setDescription('🛒 Markete ürün ekler/siler.').setContexts(InteractionContextType.Guild)
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((s) => s.setName('ekle').setDescription('Rol ürünü ekler')
        .addStringOption((o) => o.setName('isim').setDescription('Ürün adı (ör: 🌈 VIP)').setRequired(true).setMaxLength(60))
        .addIntegerOption((o) => o.setName('fiyat').setDescription('Fiyat (boyoz)').setRequired(true).setMinValue(1).setMaxValue(10000000))
        .addRoleOption((o) => o.setName('rol').setDescription('Satın alanın alacağı rol').setRequired(true))
        .addStringOption((o) => o.setName('sure').setDescription('Süreli ise: 7d, 30d... (boş = kalıcı)'))
        .addIntegerOption((o) => o.setName('stok').setDescription('Stok (boş = sınırsız)').setMinValue(1)))
      .addSubcommand((s) => s.setName('sil').setDescription('Ürünü siler')
        .addStringOption((o) => o.setName('urun').setDescription('Ürün').setRequired(true).setAutocomplete(true))),
    async autocomplete(interaction) {
      const q = interaction.options.getFocused().toLowerCase();
      await interaction.respond(db.guild(interaction.guild.id).market.items.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 25)
        .map((i) => ({ name: `${i.name} (${i.price} 🥐)`.slice(0, 100), value: String(i.id) })));
    },
    async execute(interaction) {
      const m = db.guild(interaction.guild.id).market;
      if (interaction.options.getSubcommand() === 'sil') {
        const before = m.items.length;
        m.items = m.items.filter((i) => String(i.id) !== interaction.options.getString('urun'));
        db.save();
        return before === m.items.length ? replyFail(interaction, 'Ürün bulunamadı.') : replyOk(interaction, 'Ürün silindi.');
      }
      const role = interaction.options.getRole('rol');
      if (!role.editable || role.managed) return replyFail(interaction, 'Bu rolü veremem, rolümü yukarı taşı.');
      if (role.permissions.has(PermissionFlagsBits.Administrator) || role.permissions.has(PermissionFlagsBits.ManageGuild)) return replyFail(interaction, 'Yönetici yetkili roller satılamaz.');
      const durRaw = interaction.options.getString('sure');
      const duration = durRaw ? parseDuration(durRaw) : null;
      if (durRaw && !duration) return replyFail(interaction, 'Süre anlaşılamadı. Örnek: `7d`');
      if (m.items.length >= 23) return replyFail(interaction, 'En fazla 23 ürün eklenebilir.');
      m.counter += 1;
      m.items.push({ id: m.counter, name: interaction.options.getString('isim'), price: interaction.options.getInteger('fiyat'), roleId: role.id, duration, stock: interaction.options.getInteger('stok'), sold: 0 });
      db.save();
      return reply(interaction, base(colors.success).setDescription(`✅ Markete eklendi: **${interaction.options.getString('isim')}** → ${role}${duration ? ` (${formatDuration(duration)})` : ''} • ${economy.fmt(interaction.options.getInteger('fiyat'))}`));
    },
  },
];

const { regroup } = require('../../lib/group');

module.exports = regroup(module.exports, [
  {
    name: 'market', description: '🛒 Boyoz Market: rol ve ürün satın al.',
    parts: [{ sub: 'ac', from: 'market' }, { sub: 'yonet', from: 'market-yonet', perm: PermissionFlagsBits.ManageGuild }],
  },
]);
