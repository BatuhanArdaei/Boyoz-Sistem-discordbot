// Oyuncuya karşı oyuncu: Dört Bağla ve Düello.
const { SlashCommandBuilder, InteractionContextType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { base, replyFail } = require('../../lib/embeds');
const games = require('../../lib/games');
const economy = require('../../lib/economy');
const { pick, randInt } = require('../../lib/util');
const { colors } = require('../../config');

const build = (name, desc) => new SlashCommandBuilder().setName(name).setDescription(desc).setContexts(InteractionContextType.Guild);

// Rakibin daveti kabul etmesini bekler. Kabul ederse true döner.
async function askAccept(msg, opponentId, embed) {
  try {
    const btn = await msg.awaitMessageComponent({ filter: (b) => b.customId.startsWith('davet:'), time: 60000, dispose: true });
    if (btn.user.id !== opponentId) {
      await btn.reply({ content: 'Bu davet sana değil!', ...games.ephemeral });
      return askAccept(msg, opponentId, embed);
    }
    const ok = btn.customId === 'davet:kabul';
    await btn.update({ embeds: [embed.setFooter({ text: ok ? '✅ Davet kabul edildi!' : '❌ Davet reddedildi.' })], components: [] });
    return ok;
  } catch {
    await msg.edit({ embeds: [embed.setFooter({ text: '⏰ Davet zaman aşımına uğradı.' })], components: [] }).catch(() => {});
    return false;
  }
}
const inviteRow = () => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('davet:kabul').setLabel('Kabul Et').setEmoji('⚔️').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId('davet:red').setLabel('Reddet').setStyle(ButtonStyle.Danger),
);

// =================================================================== DÖRT BAĞLA
const ROWS = 6; const COLS = 7;
const PIECES = { 0: '⚫', 1: '🔴', 2: '🟡' };
const NUMS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣'];

function dropRow(board, col) {
  for (let r = ROWS - 1; r >= 0; r--) if (!board[r][col]) return r;
  return -1;
}
function winner(board) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const p = board[r][c];
    if (!p) continue;
    for (const [dr, dc] of dirs) {
      let k = 1;
      while (k < 4 && board[r + dr * k]?.[c + dc * k] === p) k++;
      if (k === 4) return p;
    }
  }
  return board[0].every(Boolean) ? 'berabere' : null;
}
// Bot hamlesi: kazan > engelle > ortaya yakın rastgele
function botColumn(board) {
  const free = [...Array(COLS).keys()].filter((c) => dropRow(board, c) !== -1);
  for (const p of [2, 1]) {
    for (const c of free) {
      const r = dropRow(board, c); board[r][c] = p;
      const w = winner(board) === p; board[r][c] = 0;
      if (w) return c;
    }
  }
  const weighted = free.flatMap((c) => Array(4 - Math.abs(3 - c)).fill(c));
  return pick(weighted);
}
const c4Text = (board) => `${board.map((row) => row.map((v) => PIECES[v]).join('')).join('\n')}\n${NUMS.join('')}`;
const c4Rows = (board, disabled) => [
  new ActionRowBuilder().addComponents([0, 1, 2, 3].map((c) => new ButtonBuilder().setCustomId(`c4:${c}`).setEmoji(NUMS[c]).setStyle(ButtonStyle.Secondary).setDisabled(disabled || dropRow(board, c) === -1))),
  new ActionRowBuilder().addComponents([4, 5, 6].map((c) => new ButtonBuilder().setCustomId(`c4:${c}`).setEmoji(NUMS[c]).setStyle(ButtonStyle.Secondary).setDisabled(disabled || dropRow(board, c) === -1))),
];

// =================================================================== DÜELLO
const MOVES = {
  saldir: { label: 'Saldır', emoji: '🗡️', style: ButtonStyle.Danger },
  guclu: { label: 'Güçlü Vuruş', emoji: '💥', style: ButtonStyle.Danger },
  savun: { label: 'Savun', emoji: '🛡️', style: ButtonStyle.Primary },
  iyiles: { label: 'Boyoz Ye (İyileş)', emoji: '🥐', style: ButtonStyle.Success },
};
const hpBar = (hp) => `${'🟩'.repeat(Math.ceil(hp / 10))}${'⬛'.repeat(10 - Math.ceil(hp / 10))} **${hp}**/100`;

module.exports = [
  {
    data: build('dort-bagla', '🔴 Dört Bağla! Arkadaşına ya da bana karşı oyna.')
      .addUserOption((o) => o.setName('rakip').setDescription('Rakibin (boş = bota karşı)')),
    async execute(interaction) {
      const p1 = interaction.user;
      const p2 = interaction.options.getUser('rakip') || interaction.client.user;
      if (p2.id === p1.id) return replyFail(interaction, 'Kendinle oynayamazsın. 🙃');
      if (p2.bot && p2.id !== interaction.client.user.id) return replyFail(interaction, 'Başka botlarla oynayamazsın.');
      const vsBot = p2.id === interaction.client.user.id;
      const board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
      const players = { 1: p1, 2: p2 };
      let turn = 1;

      let msg;
      if (!vsBot) {
        const invite = base().setTitle('🔴 Dört Bağla Daveti').setDescription(`${p2}, ${p1} seni Dört Bağla'ya davet ediyor!`);
        msg = await games.replyMessage(interaction, { content: `${p2}`, embeds: [invite], components: [inviteRow()], allowedMentions: { users: [p2.id] } });
        if (!(await askAccept(msg, p2.id, invite))) return;
      }
      const view = (status, done) => ({
        content: '', embeds: [base().setTitle('🔴 Dört Bağla 🟡').setDescription(`${PIECES[1]} ${p1} vs ${PIECES[2]} ${p2}\n\n${c4Text(board)}\n\n${status}`)],
        components: done ? [] : c4Rows(board, false), allowedMentions: { parse: [] },
      });
      const status = () => `Sıra: ${PIECES[turn]} ${players[turn]}`;
      if (msg) await msg.edit(view(status()));
      else msg = await games.replyMessage(interaction, view(status()));

      const col = msg.createMessageComponentCollector({ filter: (b) => b.customId.startsWith('c4:'), idle: 120000 });
      col.on('collect', async (btn) => {
        if (btn.user.id !== players[turn].id) return btn.reply({ content: Object.values(players).some((p) => p.id === btn.user.id) ? 'Sıra sende değil!' : 'Bu oyunda oyuncu değilsin.', ...games.ephemeral });
        const c = Number(btn.customId.split(':')[1]);
        const r = dropRow(board, c);
        if (r === -1) return btn.reply({ content: 'Bu sütun dolu!', ...games.ephemeral });
        board[r][c] = turn;
        let w = winner(board);
        if (!w) {
          turn = turn === 1 ? 2 : 1;
          if (vsBot) { const bc = botColumn(board); board[dropRow(board, bc)][bc] = 2; turn = 1; w = winner(board); }
        }
        if (w) {
          col.stop('done');
          let text = '🤝 **Berabere!**';
          if (w !== 'berabere') {
            text = `🏆 **Kazanan:** ${PIECES[w]} ${players[w]}`;
            if (!players[w].bot) { economy.reward(interaction.guild.id, players[w].id, 40); text += ` (+${economy.fmt(40)})`; }
          }
          return btn.update(view(text, true));
        }
        return btn.update(view(status()));
      });
      col.on('end', (_, reason) => { if (reason !== 'done') msg.edit(view('⏰ Oyun zaman aşımına uğradı.', true)).catch(() => {}); });
    },
  },

  {
    data: build('duello', '⚔️ Birini düelloya davet et! İsteğe bağlı boyoz bahsi.')
      .addUserOption((o) => o.setName('rakip').setDescription('Rakibin').setRequired(true))
      .addIntegerOption((o) => o.setName('bahis').setDescription('İki taraf da bu kadar boyoz koyar, kazanan hepsini alır').setMinValue(1).setMaxValue(100000)),
    async execute(interaction) {
      const p1 = interaction.user;
      const p2 = interaction.options.getUser('rakip');
      const bet = interaction.options.getInteger('bahis') || 0;
      const gid = interaction.guild.id;
      if (p2.id === p1.id || p2.bot) return replyFail(interaction, 'Geçerli bir rakip seç (kendin ya da bot olamaz).');
      if (bet) {
        if (economy.wallet(gid, p1.id).balance < bet) return replyFail(interaction, `Bahis için yeterli boyozun yok! Cüzdan: ${economy.fmt(economy.wallet(gid, p1.id).balance)}`);
        if (economy.wallet(gid, p2.id).balance < bet) return replyFail(interaction, `${p2.username} bu bahsi karşılayacak kadar boyoza sahip değil.`);
      }
      const invite = base().setTitle('⚔️ Düello Daveti').setDescription(`${p2}, ${p1} seni düelloya davet ediyor!${bet ? `\n💰 Bahis: ${economy.fmt(bet)} (kazanan ${economy.fmt(bet * 2)} alır)` : ''}`);
      const msg = await games.replyMessage(interaction, { content: `${p2}`, embeds: [invite], components: [inviteRow()], allowedMentions: { users: [p2.id] } });
      if (!(await askAccept(msg, p2.id, invite))) return;
      if (bet && (!economy.take(gid, p1.id, bet) || !economy.take(gid, p2.id, bet))) {
        return msg.edit({ embeds: [invite.setFooter({ text: '❌ Bahis alınamadı, bakiye değişmiş.' })], components: [] });
      }

      const fighters = [
        { user: p1, hp: 100, defend: false, heals: 2 },
        { user: p2, hp: 100, defend: false, heals: 2 },
      ];
      let turn = Math.random() < 0.5 ? 0 : 1;
      const log = ['⚔️ Düello başladı!'];
      const view = (done) => ({
        content: done ? '' : `${fighters[turn].user}`,
        embeds: [base(done ? colors.success : 0xe74c3c).setTitle(`⚔️ ${p1.username} vs ${p2.username}`)
          .addFields(fighters.map((f) => ({ name: `${f.defend ? '🛡️ ' : ''}${f.user.username}`, value: `${hpBar(f.hp)}\n🥐 İyileşme hakkı: ${f.heals}` })))
          .addFields({ name: '📜 Son hamleler', value: log.slice(-4).join('\n') })
          .setFooter({ text: done ? 'Düello bitti' : `Sıra: ${fighters[turn].user.username} • 45 saniye` })],
        components: done ? [] : [new ActionRowBuilder().addComponents(Object.entries(MOVES).map(([k, m]) => new ButtonBuilder()
          .setCustomId(`duel:${k}`).setLabel(m.label).setEmoji(m.emoji).setStyle(m.style).setDisabled(k === 'iyiles' && fighters[turn].heals === 0)))],
        allowedMentions: { users: done ? [] : [fighters[turn].user.id] },
      });
      await msg.edit(view(false));

      const finish = async (winnerIdx, reason) => {
        const w = fighters[winnerIdx];
        let text = `🏆 **${w.user.username}** düelloyu kazandı!${reason ? ` (${reason})` : ''}`;
        economy.reward(gid, w.user.id, bet * 2 + 15);
        text += ` +${economy.fmt(bet * 2 + 15)}`;
        log.push(text);
        await msg.edit(view(true)).catch(() => {});
      };

      const col = msg.createMessageComponentCollector({ filter: (b) => b.customId.startsWith('duel:'), idle: 45000 });
      col.on('collect', async (btn) => {
        const me = fighters[turn]; const foe = fighters[1 - turn];
        if (btn.user.id !== me.user.id) return btn.reply({ content: fighters.some((f) => f.user.id === btn.user.id) ? 'Sıra sende değil!' : 'Bu düelloda değilsin.', ...games.ephemeral });
        const move = btn.customId.split(':')[1];
        me.defend = false;
        if (move === 'saldir' || move === 'guclu') {
          const strong = move === 'guclu';
          if (Math.random() < (strong ? 0.4 : 0.1)) log.push(`${MOVES[move].emoji} ${me.user.username} ıskaladı!`);
          else {
            let dmg = strong ? randInt(22, 35) : randInt(10, 20);
            const crit = !strong && Math.random() < 0.15;
            if (crit) dmg *= 2;
            if (foe.defend) dmg = Math.floor(dmg / 2);
            foe.hp = Math.max(0, foe.hp - dmg);
            log.push(`${MOVES[move].emoji} ${me.user.username} → **${dmg}** hasar${crit ? ' (KRİTİK!)' : ''}${foe.defend ? ' (savundu, yarıya indi)' : ''}`);
          }
          foe.defend = false;
        } else if (move === 'savun') {
          me.defend = true;
          log.push(`🛡️ ${me.user.username} savunmaya geçti.`);
        } else if (move === 'iyiles' && me.heals > 0) {
          const heal = randInt(15, 25);
          me.hp = Math.min(100, me.hp + heal); me.heals -= 1;
          log.push(`🥐 ${me.user.username} bir boyoz yedi, **+${heal}** can!`);
        }
        if (foe.hp <= 0) { col.stop('done'); await btn.deferUpdate(); return finish(turn); }
        turn = 1 - turn;
        return btn.update(view(false));
      });
      col.on('end', (_, reason) => { if (reason !== 'done') finish(1 - turn, `${fighters[turn].user.username} süresinde hamle yapmadı`); });
    },
  },
];
