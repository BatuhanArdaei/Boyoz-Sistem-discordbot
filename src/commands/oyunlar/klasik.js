// Butonlu oyunlar: taş-kağıt-makas ve XOX.
const { SlashCommandBuilder, InteractionContextType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { base, replyFail } = require('../../lib/embeds');
const { pick } = require('../../lib/util');

const RPS = { tas: { emoji: '🪨', label: 'Taş', beats: 'makas' }, kagit: { emoji: '📄', label: 'Kâğıt', beats: 'tas' }, makas: { emoji: '✂️', label: 'Makas', beats: 'kagit' } };

const xoxGames = new Map(); // messageId -> oyun durumu
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

function xoxWinner(board) {
  for (const [a, b, c] of LINES) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  return board.every(Boolean) ? 'berabere' : null;
}

function xoxRows(board, disabled = false) {
  const rows = [];
  for (let r = 0; r < 3; r++) {
    rows.push(new ActionRowBuilder().addComponents([0, 1, 2].map((c) => {
      const i = r * 3 + c;
      const btn = new ButtonBuilder().setCustomId(`xox:hamle:${i}`).setDisabled(disabled || Boolean(board[i]))
        .setStyle(board[i] === 'X' ? ButtonStyle.Danger : board[i] === 'O' ? ButtonStyle.Primary : ButtonStyle.Secondary);
      return board[i] ? btn.setEmoji(board[i] === 'X' ? '❌' : '⭕') : btn.setEmoji('⬛');
    })));
  }
  return rows;
}

// Basit ama yenilmesi zor bot hamlesi: kazan > engelle > orta > köşe > rastgele
function botMove(board) {
  const empty = board.map((v, i) => (v ? null : i)).filter((v) => v !== null);
  for (const mark of ['O', 'X']) {
    for (const i of empty) {
      const test = [...board];
      test[i] = mark;
      if (xoxWinner(test) === mark) return i;
    }
  }
  if (!board[4]) return 4;
  const corners = [0, 2, 6, 8].filter((i) => !board[i]);
  return corners.length ? pick(corners) : pick(empty);
}

module.exports = [
  {
    data: new SlashCommandBuilder().setName('tkm').setDescription('✊ Benimle taş-kâğıt-makas oyna.').setContexts(InteractionContextType.Guild),
    async execute(interaction) {
      const row = new ActionRowBuilder().addComponents(Object.entries(RPS).map(([k, v]) =>
        new ButtonBuilder().setCustomId(`tkm:sec:${k}:${interaction.user.id}`).setLabel(v.label).setEmoji(v.emoji).setStyle(ButtonStyle.Primary)));
      await interaction.reply({ embeds: [base().setTitle('✊ Taş • Kâğıt • Makas').setDescription('Seçimini yap!')], components: [row] });
    },
    components: {
      async sec(interaction, [choice, ownerId]) {
        if (interaction.user.id !== ownerId) return replyFail(interaction, 'Bu oyun senin değil, `/tkm` ile kendi oyununu başlat.');
        const bot = pick(Object.keys(RPS));
        const result = choice === bot ? '🤝 **Berabere!**' : RPS[choice].beats === bot ? '🎉 **Kazandın!**' : '😈 **Kaybettin!**';
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`tkm:tekrar:${ownerId}`).setLabel('Tekrar oyna').setEmoji('🔁').setStyle(ButtonStyle.Secondary));
        await interaction.update({ embeds: [base().setTitle('✊ Taş • Kâğıt • Makas').setDescription(`Sen: ${RPS[choice].emoji} ${RPS[choice].label}\nBen: ${RPS[bot].emoji} ${RPS[bot].label}\n\n${result}`)], components: [row] });
      },
      async tekrar(interaction, [ownerId]) {
        if (interaction.user.id !== ownerId) return replyFail(interaction, 'Bu oyun senin değil.');
        const row = new ActionRowBuilder().addComponents(Object.entries(RPS).map(([k, v]) =>
          new ButtonBuilder().setCustomId(`tkm:sec:${k}:${ownerId}`).setLabel(v.label).setEmoji(v.emoji).setStyle(ButtonStyle.Primary)));
        await interaction.update({ embeds: [base().setTitle('✊ Taş • Kâğıt • Makas').setDescription('Seçimini yap!')], components: [row] });
      },
    },
  },
  {
    data: new SlashCommandBuilder().setName('xox').setDescription('⭕ XOX (tic-tac-toe) oyna.').setContexts(InteractionContextType.Guild)
      .addUserOption((o) => o.setName('rakip').setDescription('Rakibin (boş = benimle oyna)')),
    async execute(interaction) {
      const opponent = interaction.options.getUser('rakip') || interaction.client.user;
      if (opponent.id === interaction.user.id) return replyFail(interaction, 'Kendinle oynayamazsın. 🙃');
      if (opponent.bot && opponent.id !== interaction.client.user.id) return replyFail(interaction, 'Başka botlarla oynayamazsın.');
      const game = { board: Array(9).fill(null), players: { X: interaction.user.id, O: opponent.id }, turn: 'X', vsBot: opponent.bot };
      const embed = base().setTitle('⭕ XOX').setDescription(`❌ ${interaction.user} vs ⭕ ${opponent}\n\nSıra: ❌ ${interaction.user}`);
      const msg = await interaction.reply({ embeds: [embed], components: xoxRows(game.board), withResponse: true, allowedMentions: { users: [opponent.id] } });
      const id = msg.resource.message.id;
      xoxGames.set(id, game);
      setTimeout(() => xoxGames.delete(id), 15 * 60000);
    },
    components: {
      async hamle(interaction, [cell]) {
        const game = xoxGames.get(interaction.message.id);
        if (!game) return replyFail(interaction, 'Bu oyunun süresi doldu, `/xox` ile yenisini başlat.');
        if (interaction.user.id !== game.players[game.turn]) {
          const isPlayer = Object.values(game.players).includes(interaction.user.id);
          return replyFail(interaction, isPlayer ? 'Sıra sende değil!' : 'Bu oyunda oyuncu değilsin.');
        }
        const i = Number(cell);
        if (game.board[i]) return replyFail(interaction, 'Bu kare dolu.');
        game.board[i] = game.turn;
        game.turn = game.turn === 'X' ? 'O' : 'X';
        if (game.vsBot && !xoxWinner(game.board)) {
          game.board[botMove(game.board)] = 'O';
          game.turn = 'X';
        }
        const winner = xoxWinner(game.board);
        const mention = (mark) => `<@${game.players[mark]}>`;
        let status;
        if (winner === 'berabere') status = '🤝 **Berabere!**';
        else if (winner) status = `🏆 **Kazanan:** ${winner === 'X' ? '❌' : '⭕'} ${mention(winner)}`;
        else status = `Sıra: ${game.turn === 'X' ? '❌' : '⭕'} ${mention(game.turn)}`;
        if (winner) xoxGames.delete(interaction.message.id);
        await interaction.update({
          embeds: [base().setTitle('⭕ XOX').setDescription(`❌ ${mention('X')} vs ⭕ ${mention('O')}\n\n${status}`)],
          components: xoxRows(game.board, Boolean(winner)),
          allowedMentions: { parse: [] },
        });
      },
    },
  },
];
