// Parti oyunları: doğruluk mu cesaret mi, hangisini tercih ederdin, mayın tarlası.
const { SlashCommandBuilder, InteractionContextType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { base, replyFail } = require('../../lib/embeds');
const games = require('../../lib/games');
const { pick, randInt } = require('../../lib/util');
const { TRUTHS, DARES, WOULD_YOU_RATHER } = require('../../data/icerik');

const build = (name, desc) => new SlashCommandBuilder().setName(name).setDescription(desc).setContexts(InteractionContextType.Guild);

// ---------------------------------------------------------------- doğruluk / cesaret
const dcRow = () => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('dogruluk-cesaret:sec:d').setLabel('Doğruluk').setEmoji('🗣️').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId('dogruluk-cesaret:sec:c').setLabel('Cesaret').setEmoji('🔥').setStyle(ButtonStyle.Danger),
  new ButtonBuilder().setCustomId('dogruluk-cesaret:sec:r').setLabel('Rastgele').setEmoji('🎲').setStyle(ButtonStyle.Secondary),
);
function dcEmbed(user, type) {
  const t = type === 'r' ? pick(['d', 'c']) : type;
  const truth = t === 'd';
  return base(truth ? 0x57f287 : 0xed4245)
    .setAuthor({ name: `${user.username} ${truth ? 'doğruluğu' : 'cesareti'} seçti`, iconURL: user.displayAvatarURL() })
    .setTitle(truth ? '🗣️ Doğruluk' : '🔥 Cesaret')
    .setDescription(`### ${pick(truth ? TRUTHS : DARES)}`);
}

// ---------------------------------------------------------------- hangisi
const wyrVotes = new Map(); // messageId -> { a: Set, b: Set, q }
function wyrView(q, votes) {
  const a = votes?.a.size || 0; const b = votes?.b.size || 0; const total = a + b;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  return {
    embeds: [base().setTitle('🤔 Hangisini tercih ederdin?')
      .setDescription(`🅰️ **${q[0]}**\n${'🟧'.repeat(Math.round(pct(a) / 10))}${'⬛'.repeat(10 - Math.round(pct(a) / 10))} %${pct(a)} (${a})\n\n🅱️ **${q[1]}**\n${'🟦'.repeat(Math.round(pct(b) / 10))}${'⬛'.repeat(10 - Math.round(pct(b) / 10))} %${pct(b)} (${b})`)
      .setFooter({ text: `${total} oy • Oyunu değiştirmek için diğerine bas` })],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('hangisi:oy:a').setLabel(q[0].slice(0, 80)).setEmoji('🅰️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('hangisi:oy:b').setLabel(q[1].slice(0, 80)).setEmoji('🅱️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('hangisi:yeni').setLabel('Yeni Soru').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
    )],
  };
}

// ---------------------------------------------------------------- mayın tarlası
const NUM_EMOJI = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];
function minesweeper(size, mines) {
  const grid = Array.from({ length: size }, () => Array(size).fill(0));
  let placed = 0;
  while (placed < mines) {
    const r = randInt(0, size - 1); const c = randInt(0, size - 1);
    if (grid[r][c] === -1) continue;
    grid[r][c] = -1; placed++;
  }
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (grid[r][c] === -1) continue;
    let n = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (grid[r + dr]?.[c + dc] === -1) n++;
    grid[r][c] = n;
  }
  // Başlangıç için bir boş (0) hücreyi açık bırak
  const zeros = [];
  grid.forEach((row, r) => row.forEach((v, c) => { if (v === 0) zeros.push([r, c]); }));
  const open = zeros.length ? pick(zeros) : null;
  return grid.map((row, r) => row.map((v, c) => {
    const e = v === -1 ? '💣' : NUM_EMOJI[v];
    return open && open[0] === r && open[1] === c ? e : `||${e}||`;
  }).join('')).join('\n');
}

module.exports = [
  {
    data: build('dogruluk-cesaret', '🎭 Doğruluk mu cesaret mi? Herkes butonlara basabilir.'),
    async execute(interaction) {
      await interaction.reply({ embeds: [base().setTitle('🎭 Doğruluk mu, Cesaret mi?').setDescription('Seçimini yap! Sıradaki kişi de butonlara basarak yeni soru alabilir.')], components: [dcRow()] });
    },
    components: {
      async sec(interaction, [type]) {
        await interaction.reply({ embeds: [dcEmbed(interaction.user, type)], components: [dcRow()] });
      },
    },
  },

  {
    data: build('hangisi', '🤔 "Hangisini tercih ederdin?" oylaması.'),
    async execute(interaction) {
      const q = pick(WOULD_YOU_RATHER);
      const msg = await games.replyMessage(interaction, wyrView(q));
      wyrVotes.set(msg.id, { a: new Set(), b: new Set(), q });
    },
    components: {
      async oy(interaction, [side]) {
        const votes = wyrVotes.get(interaction.message.id);
        if (!votes) return replyFail(interaction, 'Bu oylama süresi doldu, `/hangisi` ile yenisini başlat.');
        const other = side === 'a' ? 'b' : 'a';
        votes[other].delete(interaction.user.id);
        if (votes[side].has(interaction.user.id)) votes[side].delete(interaction.user.id); else votes[side].add(interaction.user.id);
        await interaction.update(wyrView(votes.q, votes));
      },
      async yeni(interaction) {
        const q = pick(WOULD_YOU_RATHER);
        const msg = await games.replyMessage(interaction, wyrView(q));
        wyrVotes.set(msg.id, { a: new Set(), b: new Set(), q });
      },
    },
  },

  {
    data: build('mayin-tarlasi', '💣 Spoiler\'lı mayın tarlası! Kutulara tıklayarak aç.')
      .addStringOption((o) => o.setName('zorluk').setDescription('Zorluk').addChoices(
        { name: '🟢 Kolay (6x6, 5 mayın)', value: '6:5' }, { name: '🟡 Orta (8x8, 10 mayın)', value: '8:10' }, { name: '🔴 Zor (9x9, 18 mayın)', value: '9:18' },
      )),
    async execute(interaction) {
      const [size, mines] = (interaction.options.getString('zorluk') || '8:10').split(':').map(Number);
      await interaction.reply({
        embeds: [base().setTitle(`💣 Mayın Tarlası • ${size}x${size} • ${mines} mayın`).setDescription('Kutulara tıklayarak aç. Sayılar etrafındaki mayın sayısını gösterir. Bir kutu senin için zaten açık! Bol şans 🍀')],
        content: minesweeper(size, mines),
      });
    },
  },
];
