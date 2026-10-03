// Kelime oyunları: /kelimebul (Türkçe Wordle) ve /adam-asmaca (kanalca oynanır).
const {
  SlashCommandBuilder, InteractionContextType, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { base, replyFail } = require('../../lib/embeds');
const games = require('../../lib/games');
const economy = require('../../lib/economy');
const { lib: canvas, FONT } = require('../../lib/canvas');
const { pick } = require('../../lib/util');
const { colors } = require('../../config');
const { WORDLE_WORDS, WORDS } = require('../../data/icerik');

const upper = (s) => s.toLocaleUpperCase('tr');
const lower = (s) => s.toLocaleLowerCase('tr');
const TR_LETTER = /^[a-zçğıöşü]$/;

// =================================================================== KELİMEBUL (Wordle)
const wordle = new Map(); // userId -> oyun
const REWARDS = [120, 90, 70, 50, 35, 20];
const COLORS = { 2: '#538d4e', 1: '#c9a227', 0: '#3a3a3c', empty: '#1f1f22', key: '#818384' };
const KEYBOARD = ['ERTYUIOPĞÜ', 'ASDFGHJKLŞİ', 'ZCVBNMÖÇ'];

// 2 = doğru yer, 1 = kelimede var, 0 = yok
function score(guess, target) {
  const g = [...guess]; const t = [...target];
  const res = Array(5).fill(0);
  const left = {};
  g.forEach((ch, i) => { if (ch === t[i]) res[i] = 2; else left[t[i]] = (left[t[i]] || 0) + 1; });
  g.forEach((ch, i) => { if (res[i] !== 2 && left[ch] > 0) { res[i] = 1; left[ch] -= 1; } });
  return res;
}

async function renderWordle(game) {
  if (!canvas) return null;
  const T = 74; const GAP = 8; const PAD = 30;
  const W = PAD * 2 + T * 5 + GAP * 4;
  const KH = 50; const H = PAD * 2 + T * 6 + GAP * 5 + 24 + KH * 3 + 16;
  const c = canvas.createCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#121213'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  const keyState = {};
  for (let r = 0; r < 6; r++) {
    const guess = game.guesses[r];
    const res = guess ? score(guess, game.target) : null;
    for (let i = 0; i < 5; i++) {
      const x = PAD + i * (T + GAP); const y = PAD + r * (T + GAP);
      ctx.fillStyle = res ? COLORS[res[i]] : COLORS.empty;
      ctx.beginPath(); ctx.roundRect(x, y, T, T, 8); ctx.fill();
      if (!res) { ctx.strokeStyle = '#3a3a3c'; ctx.lineWidth = 2; ctx.stroke(); }
      if (guess) {
        const ch = upper([...guess][i]);
        ctx.fillStyle = '#fff'; ctx.font = `bold 40px ${FONT}`; ctx.fillText(ch, x + T / 2, y + T / 2 + 2);
        keyState[ch] = Math.max(keyState[ch] ?? -1, res[i]);
      }
    }
  }
  // Klavye
  const kyStart = PAD + T * 6 + GAP * 5 + 24;
  KEYBOARD.forEach((row, ri) => {
    const keys = [...row];
    const kw = 34; const kg = 4;
    const rowW = keys.length * kw + (keys.length - 1) * kg;
    keys.forEach((k, ki) => {
      const x = (W - rowW) / 2 + ki * (kw + kg); const y = kyStart + ri * KH;
      const st = keyState[k];
      ctx.fillStyle = st === undefined ? COLORS.key : COLORS[st];
      ctx.beginPath(); ctx.roundRect(x, y, kw, KH - 8, 5); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `bold 18px ${FONT}`; ctx.fillText(k, x + kw / 2, y + (KH - 8) / 2 + 1);
    });
  });
  return new AttachmentBuilder(await c.encode('png'), { name: 'kelimebul.png' });
}

function wordleRows(userId, done) {
  if (done) return [];
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`kelimebul:tahmin:${userId}`).setLabel('Tahmin Et').setEmoji('✍️').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`kelimebul:pes:${userId}`).setLabel('Pes Et').setEmoji('🏳️').setStyle(ButtonStyle.Danger),
  )];
}

async function wordlePayload(game, user, note) {
  const img = await renderWordle(game);
  const embed = base().setAuthor({ name: `${user.username} • Kelimebul`, iconURL: user.displayAvatarURL() })
    .setDescription(note || `5 harfli Türkçe kelimeyi **6 denemede** bul!\n🟩 doğru yer • 🟨 kelimede var ama yeri yanlış • ⬛ yok\nKalan hak: **${6 - game.guesses.length}**`);
  if (img) embed.setImage('attachment://kelimebul.png');
  else embed.addFields({ name: 'Tahminler', value: game.guesses.map((g) => `${score(g, game.target).map((s) => ['⬛', '🟨', '🟩'][s]).join('')} ${upper(g)}`).join('\n') || '—' });
  return { embeds: [embed], files: img ? [img] : [], attachments: [], components: wordleRows(game.userId, game.done) };
}

// =================================================================== ADAM ASMACA
const GALLOWS = [
  '  ┌───┐\n  │   │\n      │\n      │\n      │\n ═════╧═',
  '  ┌───┐\n  │   │\n  O   │\n      │\n      │\n ═════╧═',
  '  ┌───┐\n  │   │\n  O   │\n  │   │\n      │\n ═════╧═',
  '  ┌───┐\n  │   │\n  O   │\n /│   │\n      │\n ═════╧═',
  '  ┌───┐\n  │   │\n  O   │\n /│\\  │\n      │\n ═════╧═',
  '  ┌───┐\n  │   │\n  O   │\n /│\\  │\n /    │\n ═════╧═',
  '  ┌───┐\n  │   │\n  O   │\n /│\\  │\n / \\  │\n ═════╧═',
];
const MAX_WRONG = GALLOWS.length - 1;

function hangmanEmbed(state, end) {
  const shown = [...state.word].map((ch) => (state.found.has(ch) || end ? upper(ch) : '＿')).join(' ');
  const embed = base(end === 'kazandi' ? colors.success : end === 'kaybetti' ? colors.error : colors.brand)
    .setTitle('🪢 Adam Asmaca')
    .setDescription(`\`\`\`\n${GALLOWS[state.wrong]}\n\`\`\`\n# ${shown}\n💡 İpucu: **${state.hint}** • ${[...state.word].length} harf`)
    .addFields(
      { name: '❌ Yanlış harfler', value: state.misses.length ? state.misses.map(upper).join(' ') : '—', inline: true },
      { name: '❤️ Kalan hak', value: String(MAX_WRONG - state.wrong), inline: true },
    );
  if (!end) embed.setFooter({ text: 'Sohbete tek bir harf ya da kelimenin tamamını yaz! • 3 dakika' });
  return embed;
}

module.exports = [
  {
    data: new SlashCommandBuilder().setName('kelimebul').setDescription('🟩 Türkçe Wordle! 5 harfli kelimeyi 6 denemede bul.').setContexts(InteractionContextType.Guild),
    async execute(interaction) {
      const old = wordle.get(interaction.user.id);
      if (old && !old.done && Date.now() - old.started < 30 * 60000) {
        return replyFail(interaction, 'Zaten devam eden bir Kelimebul oyunun var! Önce onu bitir ya da pes et.');
      }
      const game = { userId: interaction.user.id, target: lower(pick(WORDLE_WORDS)), guesses: [], done: false, started: Date.now() };
      wordle.set(interaction.user.id, game);
      await interaction.reply(await wordlePayload(game, interaction.user));
    },
    components: {
      async tahmin(interaction, [userId]) {
        if (interaction.user.id !== userId) return replyFail(interaction, 'Bu oyun senin değil! `/kelimebul` ile kendi oyununu başlat.');
        const game = wordle.get(userId);
        if (!game || game.done) return replyFail(interaction, 'Bu oyun bitmiş.');
        await interaction.showModal(new ModalBuilder().setCustomId(`kelimebul:gonder:${userId}`).setTitle(`Tahmin ${game.guesses.length + 1}/6`).addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('kelime').setLabel('5 harfli kelime').setStyle(TextInputStyle.Short).setMinLength(5).setMaxLength(5).setRequired(true)),
        ));
      },
      async gonder(interaction, [userId]) {
        const game = wordle.get(userId);
        if (!game || game.done) return replyFail(interaction, 'Bu oyun bitmiş.');
        const guess = lower(interaction.fields.getTextInputValue('kelime').trim());
        if ([...guess].length !== 5 || ![...guess].every((ch) => TR_LETTER.test(ch))) {
          return replyFail(interaction, 'Sadece 5 harfli Türkçe bir kelime yazabilirsin.');
        }
        game.guesses.push(guess);
        let note = null;
        if (guess === game.target) {
          game.done = true;
          const reward = REWARDS[game.guesses.length - 1];
          const bal = economy.reward(interaction.guild.id, userId, reward);
          note = `🎉 **Tebrikler!** Kelime **${upper(game.target)}** idi. **${game.guesses.length}/6** denemede buldun!\n+${economy.fmt(reward)} (Cüzdan: ${economy.fmt(bal)})`;
        } else if (game.guesses.length >= 6) {
          game.done = true;
          note = `😢 Hakların bitti! Kelime **${upper(game.target)}** idi. Bir dahaki sefere!`;
        }
        await interaction.update(await wordlePayload(game, interaction.user, note));
      },
      async pes(interaction, [userId]) {
        if (interaction.user.id !== userId) return replyFail(interaction, 'Bu oyun senin değil!');
        const game = wordle.get(userId);
        if (!game || game.done) return replyFail(interaction, 'Bu oyun zaten bitmiş.');
        game.done = true;
        await interaction.update(await wordlePayload(game, interaction.user, `🏳️ Pes ettin. Kelime **${upper(game.target)}** idi.`));
      },
    },
  },

  {
    data: new SlashCommandBuilder().setName('adam-asmaca').setDescription('🪢 Kanalca adam asmaca! Harfleri sohbete yazın.').setContexts(InteractionContextType.Guild),
    async execute(interaction) {
      const { channel } = interaction;
      if (!games.lockChannel(channel.id, 'Adam Asmaca')) return replyFail(interaction, `Bu kanalda zaten bir oyun var (**${games.channelGame(channel.id)}**).`);
      const { w, k } = pick(WORDS);
      const state = { word: lower(w), hint: k, found: new Set(), misses: [], wrong: 0 };
      let msg;
      try {
        msg = await games.replyMessage(interaction, { embeds: [hangmanEmbed(state)] });
      } catch (err) {
        games.unlockChannel(channel.id);
        throw err;
      }
      const letters = new Set(state.word);
      const collector = channel.createMessageCollector({ filter: (m) => !m.author.bot, time: 180000 });

      collector.on('collect', async (m) => {
        const text = lower(m.content.trim());
        if ([...text].length === 1 && TR_LETTER.test(text)) {
          if (state.found.has(text) || state.misses.includes(text)) return m.react('🔁').catch(() => {});
          if (letters.has(text)) { state.found.add(text); m.react('✅').catch(() => {}); } else { state.misses.push(text); state.wrong += 1; m.react('❌').catch(() => {}); }
        } else if (text === state.word) {
          for (const ch of letters) state.found.add(ch);
        } else if ([...text].length === [...state.word].length && [...text].every((ch) => TR_LETTER.test(ch))) {
          state.wrong += 1; m.react('❌').catch(() => {});
        } else return;

        const won = [...letters].every((ch) => state.found.has(ch));
        if (won) { state.winner = m; collector.stop('kazandi'); return; }
        if (state.wrong >= MAX_WRONG) { collector.stop('kaybetti'); return; }
        await msg.edit({ embeds: [hangmanEmbed(state)] }).catch(() => {});
      });

      collector.on('end', async (_, reason) => {
        games.unlockChannel(channel.id);
        const end = reason === 'kazandi' ? 'kazandi' : 'kaybetti';
        await msg.edit({ embeds: [hangmanEmbed(state, end)] }).catch(() => {});
        if (end === 'kazandi') {
          const reward = 20 + (MAX_WRONG - state.wrong) * 5;
          const bal = economy.reward(interaction.guild.id, state.winner.author.id, reward);
          await state.winner.reply({ embeds: [base(colors.success).setDescription(`🎉 **${state.winner.author.username}** kelimeyi tamamladı: **${upper(state.word)}**\n+${economy.fmt(reward)} (Cüzdan: ${economy.fmt(bal)})`)], allowedMentions: { repliedUser: false } }).catch(() => {});
        } else {
          await channel.send({ embeds: [base(colors.error).setDescription(`💀 ${reason === 'time' ? 'Süre doldu!' : 'Adam asıldı!'} Kelime **${upper(state.word)}** idi.`)] }).catch(() => {});
        }
      });
    },
  },
];
