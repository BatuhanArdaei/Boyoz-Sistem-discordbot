// Kanal yarışmaları: ilk doğru yazan kazanır. Bilgi yarışması butonlu ve çok turludur.
const {
  SlashCommandBuilder, InteractionContextType, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder,
} = require('discord.js');
const { base, replyFail } = require('../../lib/embeds');
const games = require('../../lib/games');
const economy = require('../../lib/economy');
const { lib: canvas, FONT } = require('../../lib/canvas');
const { pick, randInt } = require('../../lib/util');
const { colors } = require('../../config');
const QUESTIONS = require('../../data/sorular');
const { FLAGS, EMOJI_PUZZLES, TYPE_PHRASES, WORDS } = require('../../data/icerik');

const build = (name, desc) => new SlashCommandBuilder().setName(name).setDescription(desc).setContexts(InteractionContextType.Guild);
const LETTERS = ['A', 'B', 'C', 'D'];

// Yazıyı kopyalanamasın diye görsel olarak çizer
async function phraseImage(text) {
  if (!canvas) return null;
  const W = 900; const H = 200;
  const c = canvas.createCanvas(W, H);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#2b1a0e'); g.addColorStop(1, '#4a2c14');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // Hafif gürültü çizgileri (OCR'ı zorlaştırır)
  for (let i = 0; i < 14; i++) {
    ctx.strokeStyle = `rgba(223,142,78,${Math.random() * 0.25 + 0.05})`;
    ctx.lineWidth = Math.random() * 2 + 1;
    ctx.beginPath(); ctx.moveTo(Math.random() * W, Math.random() * H); ctx.lineTo(Math.random() * W, Math.random() * H); ctx.stroke();
  }
  let size = 64;
  do { ctx.font = `bold ${size}px ${FONT}`; size -= 2; } while (ctx.measureText(text).width > W - 80 && size > 24);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd7ae';
  ctx.fillText(text, W / 2, H / 2);
  return new AttachmentBuilder(await c.encode('png'), { name: 'hizli-yaz.png' });
}

function scramble(word) {
  const letters = [...word];
  let out = word;
  for (let i = 0; i < 10 && out === word; i++) out = games.shuffle(letters).join('');
  return out;
}

module.exports = [
  // ---------------------------------------------------------------- /bayrak
  {
    data: build('bayrak', '🏳️ Bayrağı gör, ülkeyi ilk yazan kazanır!'),
    async execute(interaction) {
      const [code, names] = pick(Object.entries(FLAGS));
      const answers = names.map(games.norm);
      await games.race(interaction, {
        name: 'Bayrak',
        embed: base().setTitle('🏳️ Bu hangi ülkenin bayrağı?').setDescription('Cevabı sohbete yaz!').setImage(`https://flagcdn.com/w320/${code}.png`),
        check: (c) => answers.includes(c),
        answer: names[0], reward: 20, time: 25000,
      });
    },
  },

  // ---------------------------------------------------------------- /emoji-bilmece
  {
    data: build('emoji-bilmece', '🤔 Emojilerden filmi/oyunu/diziyi bul!'),
    async execute(interaction) {
      const p = pick(EMOJI_PUZZLES);
      const answers = p.a.map(games.norm);
      await games.race(interaction, {
        name: 'Emoji Bilmece',
        embed: base().setTitle(`🤔 Emoji Bilmece • ${p.k}`).setDescription(`# ${p.e}\nBu ne? Cevabı sohbete yaz!`),
        check: (c) => answers.some((a) => c === a || (a.length >= 5 && c.includes(a))),
        answer: p.a[0], reward: 30, time: 45000,
      });
    },
  },

  // ---------------------------------------------------------------- /matematik
  {
    data: build('matematik', '🧮 İşlemi ilk çözen kazanır!')
      .addStringOption((o) => o.setName('zorluk').setDescription('Zorluk').addChoices(
        { name: '🟢 Kolay', value: 'kolay' }, { name: '🟡 Orta', value: 'orta' }, { name: '🔴 Zor', value: 'zor' },
      )),
    async execute(interaction) {
      const level = interaction.options.getString('zorluk') || 'orta';
      let expr; let result;
      if (level === 'kolay') {
        const a = randInt(2, 50); const b = randInt(2, 50);
        [expr, result] = Math.random() < 0.5 ? [`${a} + ${b}`, a + b] : [`${Math.max(a, b)} - ${Math.min(a, b)}`, Math.abs(a - b)];
      } else if (level === 'orta') {
        const a = randInt(3, 15); const b = randInt(3, 15); const c = randInt(5, 60);
        [expr, result] = Math.random() < 0.5 ? [`${a} × ${b} + ${c}`, a * b + c] : [`${a} × ${b} - ${c}`, a * b - c];
      } else {
        const a = randInt(12, 30); const b = randInt(6, 20); const c = randInt(2, 9); const d = randInt(10, 99);
        [expr, result] = [`${a} × ${b} - ${c} × ${d}`, a * b - c * d];
      }
      const reward = { kolay: 10, orta: 20, zor: 35 }[level];
      await games.race(interaction, {
        name: 'Matematik',
        embed: base().setTitle('🧮 Hızlı Matematik').setDescription(`# ${expr} = ?\nSonucu sohbete yaz!`),
        check: (c) => c.replace(/\s/g, '') === String(result),
        answer: String(result), reward, time: 30000,
      });
    },
  },

  // ---------------------------------------------------------------- /hizli-yaz
  {
    data: build('hizli-yaz', '⌨️ Görseldeki yazıyı ilk yazan kazanır!'),
    async execute(interaction) {
      const phrase = pick(TYPE_PHRASES);
      const img = await phraseImage(phrase);
      const embed = base().setTitle('⌨️ Hızlı Yaz!').setDescription(img ? 'Görseldeki yazıyı **aynen** yaz! (Kopyalamak yok 😏)' : `Şunu yaz: **${phrase}**`);
      if (img) embed.setImage('attachment://hizli-yaz.png');
      const target = games.norm(phrase);
      await games.race(interaction, {
        name: 'Hızlı Yaz', embed, files: img ? [img] : [],
        check: (c) => c === target,
        answer: phrase, reward: 25, time: 30000,
      });
    },
  },

  // ---------------------------------------------------------------- /kelime-coz
  {
    data: build('kelime-coz', '🔤 Karışık harflerden kelimeyi bul!'),
    async execute(interaction) {
      const { w, k } = pick(WORDS.filter((x) => [...x.w].length >= 5));
      const mixed = scramble(w).toLocaleUpperCase('tr');
      await games.race(interaction, {
        name: 'Kelime Çöz',
        embed: base().setTitle('🔤 Kelime Çöz').setDescription(`# ${[...mixed].join(' ')}\n💡 İpucu: **${k}** • ${[...w].length} harf`),
        check: (c) => c === games.norm(w),
        answer: w.toLocaleUpperCase('tr'), reward: 25, time: 45000,
      });
    },
  },

  // ---------------------------------------------------------------- /sayi-tahmin
  {
    data: build('sayi-tahmin', '🔢 Tuttuğum sayıyı bul! Her tahmine ⬆️/⬇️ ipucu veririm.')
      .addIntegerOption((o) => o.setName('ust-sinir').setDescription('1 ile kaç arası? (varsayılan 100)').setMinValue(10).setMaxValue(1000)),
    async execute(interaction) {
      const max = interaction.options.getInteger('ust-sinir') || 100;
      const target = randInt(1, max);
      await games.race(interaction, {
        name: 'Sayı Tahmin',
        embed: base().setTitle('🔢 Sayı Tahmin').setDescription(`**1** ile **${max}** arasında bir sayı tuttum. Bul bakalım!\nHer tahmine ⬆️ (daha büyük) veya ⬇️ (daha küçük) tepkisi vereceğim.`),
        check: (c) => c === String(target),
        onGuess: (m) => {
          const n = Number(m.content.trim());
          if (Number.isInteger(n)) m.react(n < target ? '⬆️' : '⬇️').catch(() => {});
        },
        answer: String(target), reward: max >= 500 ? 40 : 20, time: 90000,
      });
    },
  },

  // ---------------------------------------------------------------- /bilgi-yarismasi
  {
    data: build('bilgi-yarismasi', '🧠 Butonlu bilgi yarışması! Herkes katılabilir.')
      .addIntegerOption((o) => o.setName('soru-sayisi').setDescription('Kaç soru? (varsayılan 5)').setMinValue(1).setMaxValue(15))
      .addStringOption((o) => o.setName('kategori').setDescription('Kategori (boş = karışık)').addChoices(
        ...[...new Set(QUESTIONS.map((q) => q.k))].map((k) => ({ name: k, value: k })),
      )),
    async execute(interaction) {
      const { channel } = interaction;
      if (!games.lockChannel(channel.id, 'Bilgi Yarışması')) {
        return replyFail(interaction, `Bu kanalda zaten bir oyun oynanıyor (**${games.channelGame(channel.id)}**).`);
      }
      try {
        const cat = interaction.options.getString('kategori');
        const pool = games.shuffle(QUESTIONS.filter((q) => !cat || q.k === cat));
        const rounds = Math.min(interaction.options.getInteger('soru-sayisi') || 5, pool.length);
        const scores = new Map();
        await interaction.reply({ embeds: [base().setTitle('🧠 Bilgi Yarışması başlıyor!')
          .setDescription(`**${rounds}** soru • her soru için **15 saniye**\nDoğru cevap **+10**, ilk doğru cevaplayan **+5 bonus** puan.\nPuanlar sonunda boyoz olarak cüzdanınıza eklenir! 🥐`)] });

        for (let i = 0; i < rounds; i++) {
          await new Promise((r) => setTimeout(r, 3000));
          const q = pool[i];
          const options = games.shuffle([q.a, ...q.w]);
          const correctIdx = options.indexOf(q.a);
          const buttons = (reveal) => new ActionRowBuilder().addComponents(options.map((opt, j) => new ButtonBuilder()
            .setCustomId(`trivia:${j}`).setLabel(`${LETTERS[j]}) ${opt}`.slice(0, 80)).setDisabled(reveal)
            .setStyle(reveal ? (j === correctIdx ? ButtonStyle.Success : ButtonStyle.Secondary) : ButtonStyle.Primary)));
          const embed = base().setTitle(`❓ Soru ${i + 1}/${rounds} • ${q.k}`).setDescription(`### ${q.q}`).setFooter({ text: '⏱️ 15 saniye • Herkesin tek cevap hakkı var' });
          const msg = await channel.send({ embeds: [embed], components: [buttons(false)] });

          const answers = new Map(); // userId -> {idx, at}
          await new Promise((resolve) => {
            const col = msg.createMessageComponentCollector({ time: 15000 });
            col.on('collect', async (btn) => {
              if (answers.has(btn.user.id)) return btn.reply({ content: 'Bu soruya zaten cevap verdin!', ...games.ephemeral }).catch(() => {});
              answers.set(btn.user.id, { idx: Number(btn.customId.split(':')[1]), at: Date.now() });
              await btn.reply({ content: `🗳️ Cevabın alındı: **${LETTERS[Number(btn.customId.split(':')[1])]}**`, ...games.ephemeral }).catch(() => {});
            });
            col.on('end', resolve);
          });

          const correct = [...answers.entries()].filter(([, v]) => v.idx === correctIdx).sort((a, b) => a[1].at - b[1].at);
          correct.forEach(([id], n) => scores.set(id, (scores.get(id) || 0) + 10 + (n === 0 ? 5 : 0)));
          embed.setFooter(null).addFields({
            name: `✅ Doğru cevap: ${LETTERS[correctIdx]}) ${q.a}`,
            value: correct.length ? correct.map(([id], n) => `${n === 0 ? '⚡' : '✔️'} <@${id}>`).join(' ') : 'Kimse bilemedi 😅',
          });
          await msg.edit({ embeds: [embed], components: [buttons(true)], allowedMentions: { parse: [] } }).catch(() => {});
        }

        const ranking = [...scores.entries()].sort((a, b) => b[1] - a[1]);
        for (const [id, pts] of ranking) economy.add(interaction.guild.id, id, pts);
        if (ranking[0]) economy.reward(interaction.guild.id, ranking[0][0], 0);
        const medals = ['🥇', '🥈', '🥉'];
        await channel.send({ embeds: [base(colors.success).setTitle('🏆 Yarışma Bitti!').setDescription(ranking.length
          ? ranking.slice(0, 10).map(([id, pts], n) => `${medals[n] || `**${n + 1}.**`} <@${id}> • **${pts}** puan → +${economy.fmt(pts)}`).join('\n')
          : 'Kimse puan alamadı. Bir dahaki sefere! 🥲')], allowedMentions: { parse: [] } });
      } finally {
        games.unlockChannel(channel.id);
      }
    },
  },
];
