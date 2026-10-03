// Boyoz kumarhanesi: blackjack, rulet ve şans çarkı. (Sanal boyoz ile oynanır, gerçek para yoktur.)
const {
  SlashCommandBuilder, InteractionContextType, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder,
} = require('discord.js');
const { base, replyFail } = require('../../lib/embeds');
const games = require('../../lib/games');
const economy = require('../../lib/economy');
const db = require('../../lib/db');
const { lib: canvas, FONT } = require('../../lib/canvas');
const { ts, randInt } = require('../../lib/util');
const { colors } = require('../../config');

const build = (name, desc) => new SlashCommandBuilder().setName(name).setDescription(desc).setContexts(InteractionContextType.Guild);

// =================================================================== BLACKJACK
const SUITS = ['♠️', '♥️', '♦️', '♣️'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const blackjack = new Map(); // messageId -> oyun

function newDeck() {
  return games.shuffle(SUITS.flatMap((s) => RANKS.map((r) => ({ r, s }))));
}
function handValue(hand) {
  let total = 0; let aces = 0;
  for (const { r } of hand) {
    if (r === 'A') { total += 11; aces += 1; } else if (['J', 'Q', 'K'].includes(r)) total += 10; else total += Number(r);
  }
  while (total > 21 && aces) { total -= 10; aces -= 1; }
  return total;
}
const show = (hand, hideSecond = false) => hand.map((c, i) => (hideSecond && i === 1 ? '`🂠`' : `\`${c.r}${c.s}\``)).join(' ');

function bjEmbed(g, result) {
  const done = Boolean(result);
  const embed = base(result?.color ?? colors.brand)
    .setAuthor({ name: `${g.user.username} • Blackjack`, iconURL: g.user.displayAvatarURL() })
    .addFields(
      { name: `🃏 Senin elin (${handValue(g.player)})`, value: show(g.player) },
      { name: `🎩 Krupiye (${done ? handValue(g.dealer) : '?'})`, value: show(g.dealer, !done) },
    )
    .setFooter({ text: `Bahis: ${g.bet} boyoz${g.doubled ? ' (ikiye katlandı)' : ''}` });
  if (result) embed.setDescription(result.text);
  return embed;
}
function bjRows(g, disabled = false) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bj:hit').setLabel('Kart Çek').setEmoji('🃏').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId('bj:stand').setLabel('Dur').setEmoji('✋').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder().setCustomId('bj:double').setLabel('İkiye Katla').setEmoji('💰').setStyle(ButtonStyle.Success)
      .setDisabled(disabled || g.player.length > 2 || economy.wallet(g.guildId, g.user.id).balance < g.bet),
  )];
}
function bjFinish(g) {
  while (handValue(g.dealer) < 17) g.dealer.push(g.deck.pop());
  const p = handValue(g.player); const d = handValue(g.dealer);
  const pBJ = p === 21 && g.player.length === 2; const dBJ = d === 21 && g.dealer.length === 2;
  let payout = 0; let text; let color;
  if (p > 21) { text = `💥 **Battın!** ${p} oldu.`; color = colors.error; }
  else if (pBJ && !dBJ) { payout = Math.floor(g.bet * 2.5); text = '🂡 **BLACKJACK!** 3:2 kazandın!'; color = colors.success; }
  else if (d > 21 || p > d) { payout = g.bet * 2; text = d > 21 ? `🎉 Krupiye battı (${d})! **Kazandın!**` : `🎉 **Kazandın!** ${p} > ${d}`; color = colors.success; }
  else if (p === d) { payout = g.bet; text = `🤝 **Berabere!** Bahsin iade edildi.`; color = colors.warning; }
  else { text = `😈 **Kaybettin!** ${d} > ${p}`; color = colors.error; }
  if (payout) (payout > g.bet ? economy.reward : economy.add)(g.guildId, g.user.id, payout);
  const bal = economy.wallet(g.guildId, g.user.id).balance;
  const net = payout - g.bet;
  return { text: `${text}\n${net >= 0 ? '+' : ''}${net} 🥐 • Cüzdan: ${economy.fmt(bal)}`, color };
}

// =================================================================== RULET
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const BETS = {
  kirmizi: { label: '🔴 Kırmızı', win: (n) => RED.has(n), x: 2 },
  siyah: { label: '⚫ Siyah', win: (n) => n !== 0 && !RED.has(n), x: 2 },
  cift: { label: '2️⃣ Çift', win: (n) => n !== 0 && n % 2 === 0, x: 2 },
  tek: { label: '1️⃣ Tek', win: (n) => n % 2 === 1, x: 2 },
  dusuk: { label: '⬇️ 1-18', win: (n) => n >= 1 && n <= 18, x: 2 },
  yuksek: { label: '⬆️ 19-36', win: (n) => n >= 19, x: 2 },
  yesil: { label: '🟢 Sıfır (0)', win: (n) => n === 0, x: 36 },
};

// =================================================================== ÇARK
const SPIN_COOLDOWN = 3 * 3600 * 1000;
const WHEEL = [
  { label: '10', value: 10, weight: 20, color: '#f4a259' }, { label: '25', value: 25, weight: 18, color: '#e76f51' },
  { label: '50', value: 50, weight: 15, color: '#2a9d8f' }, { label: 'BOŞ', value: 0, weight: 10, color: '#3d405b' },
  { label: '75', value: 75, weight: 12, color: '#8ab17d' }, { label: '100', value: 100, weight: 10, color: '#e9c46a' },
  { label: '150', value: 150, weight: 7, color: '#9b5de5' }, { label: '250', value: 250, weight: 5, color: '#f15bb5' },
  { label: '20', value: 20, weight: 20, color: '#00bbf9' }, { label: '500', value: 500, weight: 2, color: '#ffd166' },
];

function weightedIndex() {
  const total = WHEEL.reduce((a, s) => a + s.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < WHEEL.length; i++) { r -= WHEEL[i].weight; if (r <= 0) return i; }
  return 0;
}

async function renderWheel(winIdx) {
  if (!canvas) return null;
  const S = 520; const c = canvas.createCanvas(S, S); const ctx = c.getContext('2d');
  const cx = S / 2; const cy = S / 2 + 10; const R = 220;
  ctx.fillStyle = '#1a1208'; ctx.fillRect(0, 0, S, S);
  const n = WHEEL.length; const slice = (Math.PI * 2) / n;
  // Kazanan dilim tepeye (pointer altına) gelsin
  const rot = -Math.PI / 2 - (winIdx + 0.5) * slice;
  WHEEL.forEach((seg, i) => {
    const a0 = rot + i * slice; const a1 = a0 + slice;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath();
    ctx.fillStyle = seg.color; ctx.fill();
    ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 3; ctx.stroke();
    // Sol yarıdaki yazılar ters durmasın diye 180° çevrilir
    const mid = a0 + slice / 2;
    const flip = Math.cos(mid) < 0;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(flip ? mid + Math.PI : mid);
    ctx.fillStyle = '#fff'; ctx.font = `bold ${seg.label.length > 3 ? 26 : 30}px ${FONT}`; ctx.textAlign = flip ? 'left' : 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(seg.label, flip ? -(R - 18) : R - 18, 0); ctx.restore();
  });
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.lineWidth = 10; ctx.strokeStyle = '#df8e4e'; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 46, 0, Math.PI * 2); ctx.fillStyle = '#df8e4e'; ctx.fill();
  ctx.fillStyle = '#1a1208'; ctx.font = `800 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('BOYOZ', cx, cy + 1);
  // İşaretçi
  ctx.beginPath(); ctx.moveTo(cx - 22, cy - R - 26); ctx.lineTo(cx + 22, cy - R - 26); ctx.lineTo(cx, cy - R + 14); ctx.closePath();
  ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 3; ctx.stroke();
  return new AttachmentBuilder(await c.encode('png'), { name: 'cark.png' });
}

module.exports = [
  // ---------------------------------------------------------------- /blackjack
  {
    data: build('blackjack', '🃏 Krupiyeye karşı 21! Boyoz bahsiyle oyna.')
      .addIntegerOption((o) => o.setName('bahis').setDescription('Bahis (boyoz)').setRequired(true).setMinValue(1).setMaxValue(100000)),
    async execute(interaction) {
      const bet = interaction.options.getInteger('bahis');
      const err = games.checkBet(interaction, bet);
      if (err) return replyFail(interaction, err);
      economy.take(interaction.guild.id, interaction.user.id, bet);
      const deck = newDeck();
      const g = { guildId: interaction.guild.id, user: interaction.user, bet, deck, player: [deck.pop(), deck.pop()], dealer: [deck.pop(), deck.pop()], doubled: false };

      if (handValue(g.player) === 21) {
        const result = bjFinish(g);
        return interaction.reply({ embeds: [bjEmbed(g, result)] });
      }
      const msg = await games.replyMessage(interaction, { embeds: [bjEmbed(g)], components: bjRows(g) });
      blackjack.set(msg.id, g);
      const col = msg.createMessageComponentCollector({ idle: 60000 });
      col.on('collect', async (btn) => {
        if (btn.user.id !== g.user.id) return btn.reply({ content: 'Bu masa senin değil! `/blackjack` ile kendi oyununu aç.', ...games.ephemeral });
        const action = btn.customId.split(':')[1];
        if (action === 'double') {
          if (!economy.take(g.guildId, g.user.id, g.bet)) return btn.reply({ content: 'İkiye katlamak için yeterli boyozun yok.', ...games.ephemeral });
          g.bet *= 2; g.doubled = true; g.player.push(g.deck.pop());
          col.stop('done'); return btn.update({ embeds: [bjEmbed(g, bjFinish(g))], components: [] });
        }
        if (action === 'hit') {
          g.player.push(g.deck.pop());
          if (handValue(g.player) >= 21) { col.stop('done'); return btn.update({ embeds: [bjEmbed(g, bjFinish(g))], components: [] }); }
          return btn.update({ embeds: [bjEmbed(g)], components: bjRows(g) });
        }
        col.stop('done');
        return btn.update({ embeds: [bjEmbed(g, bjFinish(g))], components: [] });
      });
      col.on('end', async (_, reason) => {
        blackjack.delete(msg.id);
        if (reason !== 'done') await msg.edit({ embeds: [bjEmbed(g, bjFinish(g)).setTitle('⏰ Süre doldu, otomatik "Dur" denildi')], components: [] }).catch(() => {});
      });
    },
  },

  // ---------------------------------------------------------------- /rulet
  {
    data: build('rulet', '🎡 Avrupa ruleti! Renge, tek/çifte ya da sayıya oyna.')
      .addIntegerOption((o) => o.setName('bahis').setDescription('Bahis (boyoz)').setRequired(true).setMinValue(1).setMaxValue(100000))
      .addStringOption((o) => o.setName('secim').setDescription('Neye oynuyorsun?').addChoices(...Object.entries(BETS).map(([value, b]) => ({ name: `${b.label} (x${b.x})`, value }))))
      .addIntegerOption((o) => o.setName('sayi').setDescription('Tek bir sayıya oyna (0-36, x36)').setMinValue(0).setMaxValue(36)),
    async execute(interaction) {
      const bet = interaction.options.getInteger('bahis');
      const choice = interaction.options.getString('secim');
      const number = interaction.options.getInteger('sayi');
      if (!choice && number === null) return replyFail(interaction, '`secim` veya `sayi` seçeneklerinden birini doldur.');
      if (choice && number !== null) return replyFail(interaction, 'Ya bir seçime ya da tek bir sayıya oyna, ikisine birden değil.');
      const err = games.checkBet(interaction, bet);
      if (err) return replyFail(interaction, err);
      economy.take(interaction.guild.id, interaction.user.id, bet);

      const n = randInt(0, 36);
      const won = number !== null ? n === number : BETS[choice].win(n);
      const mult = number !== null ? 36 : BETS[choice].x;
      if (won) economy.reward(interaction.guild.id, interaction.user.id, bet * mult);
      const bal = economy.wallet(interaction.guild.id, interaction.user.id).balance;
      const color = n === 0 ? '🟢' : RED.has(n) ? '🔴' : '⚫';
      const pick = number !== null ? `🎯 ${number}` : BETS[choice].label;

      await interaction.reply({ embeds: [base().setTitle('🎡 Rulet dönüyor...').setDescription('🎰 Top dönüyor...')] });
      await new Promise((r) => setTimeout(r, 2000));
      await interaction.editReply({ embeds: [base(won ? colors.success : colors.error).setTitle(`🎡 Top **${color} ${n}** üzerinde durdu!`)
        .setDescription(`Senin seçimin: **${pick}**\n\n${won ? `🎉 **Kazandın!** +${economy.fmt(bet * mult - bet)}` : `💸 **Kaybettin!** -${economy.fmt(bet)}`}\nCüzdan: ${economy.fmt(bal)}`)] });
    },
  },

  // ---------------------------------------------------------------- /cark
  {
    data: build('cark', '🎡 Şans çarkını çevir! 3 saatte bir ücretsiz boyoz.'),
    async execute(interaction) {
      const w = economy.wallet(interaction.guild.id, interaction.user.id);
      const left = (w.lastSpin || 0) + SPIN_COOLDOWN - Date.now();
      if (left > 0) return replyFail(interaction, `Çark dinleniyor! Tekrar çevirebilirsin: ${ts(Date.now() + left, 'R')}`);
      w.lastSpin = Date.now();
      db.save();
      const idx = weightedIndex();
      const seg = WHEEL[idx];
      if (seg.value) economy.reward(interaction.guild.id, interaction.user.id, seg.value);
      const img = await renderWheel(idx);
      const embed = base(seg.value >= 250 ? 0xffd166 : seg.value ? colors.success : colors.dark)
        .setAuthor({ name: `${interaction.user.username} çarkı çevirdi!`, iconURL: interaction.user.displayAvatarURL() })
        .setDescription(seg.value
          ? `${seg.value >= 250 ? '🌟 **BÜYÜK İKRAMİYE!** ' : '🎉 '}Çark **${seg.label}** üzerinde durdu: +${economy.fmt(seg.value)}`
          : '😅 Çark **BOŞ** geldi! 3 saat sonra tekrar dene.')
        .addFields({ name: 'Cüzdan', value: economy.fmt(economy.wallet(interaction.guild.id, interaction.user.id).balance), inline: true },
          { name: 'Sonraki çevirme', value: ts(Date.now() + SPIN_COOLDOWN, 'R'), inline: true });
      if (img) embed.setImage('attachment://cark.png');
      await interaction.reply({ embeds: [embed], files: img ? [img] : [] });
    },
  },
];
