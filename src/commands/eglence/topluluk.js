// Topluluk: öneri, doğum günü, itiraf, teşekkür (rep), evlilik, günlük görevler, Boyozboard, sabit mesaj.
const {
  SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const db = require('../../lib/db');
const economy = require('../../lib/economy');
const stats = require('../../lib/stats');
const { base, reply, replyOk, replyFail } = require('../../lib/embeds');
const { ts, truncate } = require('../../lib/util');
const { colors } = require('../../config');

const isAdmin = (i) => i.member.permissions.has(PermissionFlagsBits.ManageGuild);
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const SUGGEST_REWARD = 75;
const REP_COOLDOWN = 12 * 36e5;

// ---------------------------------------------------------------- öneri
function suggestionView(s) {
  const status = { bekliyor: ['🕒 Değerlendiriliyor', colors.info], kabul: ['✅ Kabul edildi', colors.success], red: ['❌ Reddedildi', colors.error] }[s.status];
  const embed = base(status[1]).setAuthor({ name: `Öneri #${s.no}` }).setDescription(s.text)
    .addFields({ name: 'Durum', value: status[0], inline: true }, { name: 'Oylar', value: `👍 ${s.up.length} • 👎 ${s.down.length}`, inline: true }, { name: 'Öneren', value: `<@${s.authorId}>`, inline: true });
  if (s.note) embed.addFields({ name: 'Yetkili notu', value: s.note });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('oneri:oy:up').setEmoji('👍').setLabel(String(s.up.length)).setStyle(ButtonStyle.Success).setDisabled(s.status !== 'bekliyor'),
    new ButtonBuilder().setCustomId('oneri:oy:down').setEmoji('👎').setLabel(String(s.down.length)).setStyle(ButtonStyle.Danger).setDisabled(s.status !== 'bekliyor'),
    new ButtonBuilder().setCustomId('oneri:karar:kabul').setLabel('Kabul').setStyle(ButtonStyle.Secondary).setDisabled(s.status !== 'bekliyor'),
    new ButtonBuilder().setCustomId('oneri:karar:red').setLabel('Red').setStyle(ButtonStyle.Secondary).setDisabled(s.status !== 'bekliyor'),
  );
  return { embeds: [embed], components: [row], allowedMentions: { parse: [] } };
}

// ---------------------------------------------------------------- günlük görevler
const QUESTS = [
  { key: 'mesaj', label: '💬 30 mesaj yaz', goal: 30, get: (u) => u.dayMsg },
  { key: 'ses', label: '🔊 30 dakika seste kal', goal: 30, get: (u) => Math.floor(u.dayVoice / 60000) },
  { key: 'oyun', label: '🎮 2 oyun kazan', goal: 2, get: (u) => u.wins },
];
const QUEST_REWARD = 200;

module.exports = [
  {
    data: new SlashCommandBuilder().setName('oneri').setDescription('💡 Sunucu için öneri yap; kabul edilirse boyoz kazan!').setContexts(InteractionContextType.Guild)
      .addSubcommand((s) => s.setName('yaz').setDescription('Yeni öneri gönderir')
        .addStringOption((o) => o.setName('oneri').setDescription('Önerin').setRequired(true).setMaxLength(1500)))
      .addSubcommand((s) => s.setName('kanal').setDescription('(Yetkili) Önerilerin gideceği kanal')
        .addChannelOption((o) => o.setName('kanal').setDescription('Kanal').setRequired(true).addChannelTypes(ChannelType.GuildText))),
    async execute(interaction) {
      const sg = db.guild(interaction.guild.id).suggestions;
      if (interaction.options.getSubcommand() === 'kanal') {
        if (!isAdmin(interaction)) return replyFail(interaction, 'Bu ayar için "Sunucuyu Yönet" izni gerekli.');
        sg.channelId = interaction.options.getChannel('kanal').id; db.save();
        return replyOk(interaction, `Öneriler artık <#${sg.channelId}> kanalına gidecek.`);
      }
      const channel = sg.channelId && interaction.guild.channels.cache.get(sg.channelId);
      if (!channel) return replyFail(interaction, 'Öneri kanalı ayarlanmamış. Yetkililer `/oneri kanal` ile ayarlayabilir.');
      sg.count += 1;
      const s = { no: sg.count, text: interaction.options.getString('oneri'), authorId: interaction.user.id, up: [], down: [], status: 'bekliyor' };
      const msg = await channel.send(suggestionView(s));
      sg.items[msg.id] = s; db.save();
      await msg.startThread({ name: `Öneri #${s.no} tartışması` }).catch(() => {});
      return replyOk(interaction, `Önerin gönderildi! [Görüntüle](${msg.url}) Kabul edilirse **+${SUGGEST_REWARD} 🥐** kazanırsın.`);
    },
    components: {
      async oy(interaction, [dir]) {
        const s = db.guild(interaction.guild.id).suggestions.items[interaction.message.id];
        if (!s || s.status !== 'bekliyor') return replyFail(interaction, 'Bu öneri oylamaya kapalı.');
        const [mine, other] = dir === 'up' ? [s.up, s.down] : [s.down, s.up];
        const oi = other.indexOf(interaction.user.id); if (oi >= 0) other.splice(oi, 1);
        const mi = mine.indexOf(interaction.user.id); if (mi >= 0) mine.splice(mi, 1); else mine.push(interaction.user.id);
        db.save();
        return interaction.update(suggestionView(s));
      },
      async karar(interaction, [decision]) {
        if (!isAdmin(interaction)) return replyFail(interaction, 'Önerileri sadece yetkililer değerlendirebilir.');
        return interaction.showModal(new ModalBuilder().setCustomId(`oneri:kaydet:${decision}`).setTitle(decision === 'kabul' ? 'Öneriyi kabul et' : 'Öneriyi reddet').addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('not').setLabel('Not (isteğe bağlı)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)),
        ));
      },
      async kaydet(interaction, [decision]) {
        const s = db.guild(interaction.guild.id).suggestions.items[interaction.message.id];
        if (!s || s.status !== 'bekliyor') return replyFail(interaction, 'Bu öneri zaten değerlendirilmiş.');
        s.status = decision; s.note = interaction.fields.getTextInputValue('not') || null;
        if (decision === 'kabul') economy.reward(interaction.guild.id, s.authorId, SUGGEST_REWARD);
        db.save();
        await interaction.update(suggestionView(s));
        const user = await interaction.client.users.fetch(s.authorId).catch(() => null);
        await user?.send({ embeds: [base(decision === 'kabul' ? colors.success : colors.error).setDescription(`💡 **${interaction.guild.name}** sunucusundaki öneri #${s.no} ${decision === 'kabul' ? `**kabul edildi!** +${SUGGEST_REWARD} 🥐` : 'reddedildi.'}${s.note ? `\n> ${s.note}` : ''}`)] }).catch(() => {});
      },
    },
  },

  {
    data: new SlashCommandBuilder().setName('dogumgunu').setDescription('🎂 Doğum günü sistemi: kutlama, özel rol ve hediye boyoz!').setContexts(InteractionContextType.Guild)
      .addSubcommand((s) => s.setName('ayarla').setDescription('Doğum gününü kaydeder')
        .addIntegerOption((o) => o.setName('gun').setDescription('Gün').setRequired(true).setMinValue(1).setMaxValue(31))
        .addIntegerOption((o) => o.setName('ay').setDescription('Ay').setRequired(true).addChoices(...MONTHS.map((name, i) => ({ name, value: i + 1 })))))
      .addSubcommand((s) => s.setName('sil').setDescription('Doğum gününü siler'))
      .addSubcommand((s) => s.setName('liste').setDescription('Yaklaşan doğum günleri'))
      .addSubcommand((s) => s.setName('sistem').setDescription('(Yetkili) Kutlama kanalı, rol ve hediye')
        .addChannelOption((o) => o.setName('kanal').setDescription('Kutlama kanalı').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addRoleOption((o) => o.setName('rol').setDescription('Doğum günü boyunca verilecek rol'))
        .addIntegerOption((o) => o.setName('hediye').setDescription('Hediye boyoz (varsayılan 100)').setMinValue(0).setMaxValue(100000))),
    async execute(interaction) {
      const b = db.guild(interaction.guild.id).birthdays;
      const sub = interaction.options.getSubcommand();
      if (sub === 'sistem') {
        if (!isAdmin(interaction)) return replyFail(interaction, 'Bu ayar için "Sunucuyu Yönet" izni gerekli.');
        b.channelId = interaction.options.getChannel('kanal').id;
        b.roleId = interaction.options.getRole('rol')?.id || null;
        if (interaction.options.getInteger('hediye') !== null) b.gift = interaction.options.getInteger('hediye');
        db.save();
        return replyOk(interaction, `Doğum günleri her sabah 09:00'da <#${b.channelId}> kanalında kutlanacak${b.roleId ? `, <@&${b.roleId}> rolü 24 saat verilecek` : ''}, hediye **${b.gift} 🥐**.`);
      }
      if (sub === 'sil') { delete b.users[interaction.user.id]; db.save(); return replyOk(interaction, 'Doğum günün silindi.'); }
      if (sub === 'ayarla') {
        const d = interaction.options.getInteger('gun'); const m = interaction.options.getInteger('ay');
        if (d > new Date(2024, m, 0).getDate()) return replyFail(interaction, 'Bu ayda o gün yok.');
        b.users[interaction.user.id] = { d, m }; db.save();
        return replyOk(interaction, `🎂 Doğum günün **${d} ${MONTHS[m - 1]}** olarak kaydedildi! O gün kutlanacaksın.${b.channelId ? '' : '\n*(Yetkililerin `/dogumgunu sistem` ile kutlama kanalını ayarlaması gerek.)*'}`);
      }
      const now = new Date(Date.now() + 3 * 36e5);
      const upcoming = Object.entries(b.users).map(([id, { d, m }]) => {
        let next = Date.UTC(now.getUTCFullYear(), m - 1, d);
        if (next < Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) next = Date.UTC(now.getUTCFullYear() + 1, m - 1, d);
        return { id, d, m, next };
      }).sort((a, z) => a.next - z.next).slice(0, 15);
      return reply(interaction, base().setTitle('🎂 Yaklaşan Doğum Günleri').setDescription(upcoming.map((u) => `**${u.d} ${MONTHS[u.m - 1]}** — <@${u.id}>`).join('\n') || 'Kayıtlı doğum günü yok.'), { ephemeral: false });
    },
  },

  {
    data: new SlashCommandBuilder().setName('itiraf').setDescription('🤫 Anonim itiraf gönder (kim olduğun görünmez).').setContexts(InteractionContextType.Guild)
      .addSubcommand((s) => s.setName('yaz').setDescription('Anonim itiraf gönderir'))
      .addSubcommand((s) => s.setName('kanal').setDescription('(Yetkili) İtiraf kanalını ayarlar')
        .addChannelOption((o) => o.setName('kanal').setDescription('Kanal').setRequired(true).addChannelTypes(ChannelType.GuildText))),
    async execute(interaction) {
      const c = db.guild(interaction.guild.id).confessions;
      if (interaction.options.getSubcommand() === 'kanal') {
        if (!isAdmin(interaction)) return replyFail(interaction, 'Bu ayar için "Sunucuyu Yönet" izni gerekli.');
        c.channelId = interaction.options.getChannel('kanal').id; db.save();
        return replyOk(interaction, `İtiraflar <#${c.channelId}> kanalına gidecek.`);
      }
      if (!c.channelId) return replyFail(interaction, 'İtiraf kanalı ayarlanmamış.');
      return interaction.showModal(new ModalBuilder().setCustomId('itiraf:gonder').setTitle('🤫 Anonim İtiraf').addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('metin').setLabel('İtirafın (kimse kim olduğunu bilmeyecek)').setStyle(TextInputStyle.Paragraph).setMaxLength(1500).setRequired(true)),
      ));
    },
    components: {
      async gonder(interaction) {
        const c = db.guild(interaction.guild.id).confessions;
        const channel = interaction.guild.channels.cache.get(c.channelId);
        if (!channel) return replyFail(interaction, 'İtiraf kanalı bulunamadı.');
        c.count += 1; db.save();
        const text = interaction.fields.getTextInputValue('metin').replace(/@(everyone|here)/g, '@​$1');
        // Kötüye kullanım için sadece moderasyon loguna kim yazdığı düşer
        await require('../../lib/logger').sendLog(interaction.guild, 'moderasyon', base(colors.dark).setTitle(`🤫 İtiraf #${c.count} (gizli kayıt)`).setDescription(truncate(text, 1000)).addFields({ name: 'Gönderen', value: `${interaction.user} \`${interaction.user.id}\`` }));
        await channel.send({ embeds: [base(0x2f3136).setTitle(`🤫 İtiraf #${c.count}`).setDescription(text).setFooter({ text: 'Anonim itiraf • /itiraf yaz' })], allowedMentions: { parse: [] } });
        return replyOk(interaction, 'İtirafın anonim olarak gönderildi. 🤫');
      },
    },
  },

  {
    data: new SlashCommandBuilder().setName('tesekkur').setDescription('🙏 Birine teşekkür et: +1 rep ve 10 boyoz kazanır (12 saatte bir).').setContexts(InteractionContextType.Guild)
      .addUserOption((o) => o.setName('kullanici').setDescription('Kime?').setRequired(true))
      .addStringOption((o) => o.setName('sebep').setDescription('Neden?').setMaxLength(200)),
    async execute(interaction) {
      const target = interaction.options.getUser('kullanici');
      if (target.bot || target.id === interaction.user.id) return replyFail(interaction, 'Kendine veya botlara teşekkür edemezsin. 😄');
      const rep = db.guild(interaction.guild.id).rep;
      const me = (rep[interaction.user.id] ??= { points: 0, last: 0 });
      if (Date.now() - me.last < REP_COOLDOWN) return replyFail(interaction, `Tekrar teşekkür edebilirsin: ${ts(me.last + REP_COOLDOWN, 'R')}`);
      me.last = Date.now();
      const t = (rep[target.id] ??= { points: 0, last: 0 });
      t.points += 1;
      economy.add(interaction.guild.id, target.id, 10);
      db.save();
      const reason = interaction.options.getString('sebep');
      return interaction.reply({ content: `🙏 ${interaction.user} → ${target} teşekkür etti!${reason ? ` *"${reason}"*` : ''}\n⭐ ${target.username} artık **${t.points}** rep puanına sahip (+10 🥐)`, allowedMentions: { users: [target.id] } });
    },
  },

  {
    data: new SlashCommandBuilder().setName('evlen').setDescription('💍 Birine evlilik teklif et (ya da durumu gör / boşan).').setContexts(InteractionContextType.Guild)
      .addSubcommand((s) => s.setName('teklif').setDescription('Evlilik teklif eder (500 boyozluk yüzük gerekir)')
        .addUserOption((o) => o.setName('kullanici').setDescription('Kime?').setRequired(true)))
      .addSubcommand((s) => s.setName('durum').setDescription('Evlilik durumunu gösterir')
        .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı')))
      .addSubcommand((s) => s.setName('bosan').setDescription('Boşanır 💔')),
    async execute(interaction) {
      const gid = interaction.guild.id;
      const mar = db.guild(gid).marriages;
      const sub = interaction.options.getSubcommand();
      if (sub === 'durum') {
        const u = interaction.options.getUser('kullanici') || interaction.user;
        const m = mar[u.id];
        return reply(interaction, base(0xeb459e).setDescription(m ? `💍 ${u} ile <@${m.partner}> **${ts(m.since, 'R')}** evlendi! 💕` : `${u} bekar. 💔`), { ephemeral: false });
      }
      if (sub === 'bosan') {
        const m = mar[interaction.user.id];
        if (!m) return replyFail(interaction, 'Zaten evli değilsin.');
        delete mar[m.partner]; delete mar[interaction.user.id]; db.save();
        return interaction.reply({ content: `💔 ${interaction.user} ve <@${m.partner}> yollarını ayırdı...`, allowedMentions: { parse: [] } });
      }
      const target = interaction.options.getUser('kullanici');
      if (target.bot || target.id === interaction.user.id) return replyFail(interaction, 'Geçerli birini seç.');
      if (mar[interaction.user.id] || mar[target.id]) return replyFail(interaction, 'İkinizden biri zaten evli!');
      if (economy.wallet(gid, interaction.user.id).balance < 500) return replyFail(interaction, `Yüzük için **500 🥐** lazım! Cüzdan: ${economy.fmt(economy.wallet(gid, interaction.user.id).balance)}`);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('evet').setLabel('Evet! 💍').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('hayir').setLabel('Hayır').setStyle(ButtonStyle.Danger),
      );
      const res = await interaction.reply({ content: `${target}`, embeds: [base(0xeb459e).setDescription(`💍 ${interaction.user}, ${target} kişisine evlilik teklif ediyor! Kabul ediyor musun?`)], components: [row], withResponse: true, allowedMentions: { users: [target.id] } });
      try {
        const btn = await res.resource.message.awaitMessageComponent({ filter: (b) => b.user.id === target.id, time: 60000 });
        if (btn.customId !== 'evet') return btn.update({ embeds: [base(colors.dark).setDescription(`💔 ${target} teklifi reddetti...`)], components: [], content: '' });
        if (!economy.take(gid, interaction.user.id, 500)) return btn.update({ embeds: [base(colors.error).setDescription('Yüzük parası kalmamış! 😅')], components: [], content: '' });
        const since = Date.now();
        mar[interaction.user.id] = { partner: target.id, since }; mar[target.id] = { partner: interaction.user.id, since }; db.save();
        return btn.update({ embeds: [base(0xeb459e).setDescription(`🎉💍 **${interaction.user.username}** ve **${target.username}** evlendi! Mutluluklar! 💕`)], components: [], content: '' });
      } catch {
        return interaction.editReply({ embeds: [base(colors.dark).setDescription('⏰ Teklif cevapsız kaldı.')], components: [], content: '' });
      }
    },
  },

  {
    data: new SlashCommandBuilder().setName('gorev').setDescription('📋 Günlük görevlerin: hepsini tamamla, 200 boyoz kazan!').setContexts(InteractionContextType.Guild),
    async execute(interaction) {
      const gid = interaction.guild.id;
      const today = stats.dayKey();
      const q = db.guild(gid).quests;
      const w = economy.wallet(gid, interaction.user.id);
      let mine = q[interaction.user.id];
      if (!mine || mine.day !== today) mine = q[interaction.user.id] = { day: today, winsStart: w.wins || 0, claimed: false };
      const u = stats.snapshot(interaction.guild, interaction.user.id);
      const d = u.days[today] || { m: 0, v: 0 };
      const progress = { dayMsg: d.m, dayVoice: d.v, wins: (w.wins || 0) - mine.winsStart };
      const rows = QUESTS.map((x) => { const v = Math.min(x.get(progress), x.goal); return { ...x, v, done: v >= x.goal }; });
      const allDone = rows.every((r) => r.done);
      let note = '';
      if (allDone && !mine.claimed) { mine.claimed = true; economy.reward(gid, interaction.user.id, QUEST_REWARD); note = `\n\n🎉 **Tüm görevler tamam! +${QUEST_REWARD} 🥐**`; }
      db.save();
      const bar = (v, g) => `${'🟩'.repeat(Math.round((v / g) * 8))}${'⬛'.repeat(8 - Math.round((v / g) * 8))}`;
      return reply(interaction, base().setTitle('📋 Günlük Görevler').setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
        .setDescription(`${rows.map((r) => `${r.done ? '✅' : '⬜'} **${r.label}**\n${bar(r.v, r.goal)} ${r.v}/${r.goal}`).join('\n\n')}${note}${mine.claimed && !note ? '\n\n✅ Bugünün ödülünü aldın, yarın yeni görevler!' : ''}`)
        .setFooter({ text: `Ödül: ${QUEST_REWARD} boyoz • Görevler her gün 00:00'da yenilenir` }), { ephemeral: false });
    },
  },

  {
    data: new SlashCommandBuilder().setName('boyozboard').setDescription('🥐 En sevilen mesajlar onur kanalına! (starboard)').setContexts(InteractionContextType.Guild)
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addChannelOption((o) => o.setName('kanal').setDescription('Onur kanalı (boş = kapat)').addChannelTypes(ChannelType.GuildText))
      .addIntegerOption((o) => o.setName('esik').setDescription('Kaç tepki gerekli? (varsayılan 3)').setMinValue(1).setMaxValue(50))
      .addStringOption((o) => o.setName('emoji').setDescription('Hangi emoji? (varsayılan 🥐)')),
    async execute(interaction) {
      const sb = db.guild(interaction.guild.id).starboard;
      const ch = interaction.options.getChannel('kanal');
      sb.channelId = ch?.id || null;
      if (interaction.options.getInteger('esik')) sb.threshold = interaction.options.getInteger('esik');
      if (interaction.options.getString('emoji')) sb.emoji = interaction.options.getString('emoji').trim();
      db.save();
      return replyOk(interaction, ch ? `${sb.emoji} tepkisi **${sb.threshold}**'e ulaşan mesajlar ${ch} kanalına taşınacak; mesaj sahibi **+25 🥐** kazanır.` : 'Boyozboard kapatıldı.');
    },
  },

  {
    data: new SlashCommandBuilder().setName('sabit-mesaj').setDescription('📌 Kanalın en altında hep duran mesaj (sticky).').setContexts(InteractionContextType.Guild)
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addSubcommand((s) => s.setName('ayarla').setDescription('Bu kanala sabit mesaj koyar')
        .addStringOption((o) => o.setName('metin').setDescription('Mesaj (\\n = alt satır)').setRequired(true).setMaxLength(1500)))
      .addSubcommand((s) => s.setName('kaldir').setDescription('Bu kanaldaki sabit mesajı kaldırır')),
    async execute(interaction) {
      const sticky = db.guild(interaction.guild.id).sticky;
      const old = sticky[interaction.channelId];
      if (old?.messageId) await interaction.channel.messages.delete(old.messageId).catch(() => {});
      if (interaction.options.getSubcommand() === 'kaldir') { delete sticky[interaction.channelId]; db.save(); return replyOk(interaction, 'Sabit mesaj kaldırıldı.'); }
      const text = interaction.options.getString('metin').replace(/\\n/g, '\n');
      const msg = await interaction.channel.send({ embeds: [base().setDescription(`📌 ${text}`)] });
      sticky[interaction.channelId] = { text, messageId: msg.id };
      db.save();
      return replyOk(interaction, 'Sabit mesaj ayarlandı; her yeni mesajdan sonra en alta taşınacak.');
    },
  },
];

module.exports.isAdmin = isAdmin;
