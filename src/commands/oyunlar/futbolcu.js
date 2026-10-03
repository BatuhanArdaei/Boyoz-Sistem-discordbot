// /futbolcu: Futbolcuyu tahmin et! Bayrak, mevki ve ilk kulüple başlar; bilinemedikçe ipuçları artar.
const {
  SlashCommandBuilder, InteractionContextType, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits,
} = require('discord.js');
const { base, replyFail } = require('../../lib/embeds');
const games = require('../../lib/games');
const economy = require('../../lib/economy');
const { pick } = require('../../lib/util');
const { colors } = require('../../config');
const PLAYERS = require('../../data/futbolcular');

const REWARDS = [60, 50, 40, 30, 20, 10]; // açılan ekstra ipucu sayısına göre
const WRONG_PER_HINT = 3;
const HINT_EVERY = 25000;
const LAST_CHANCE = 30000;

// İsmi kısmen açık gösterir: her kelimenin ilk harfi + rastgele ~%35'i
function masked(name) {
  return name.split(' ').map((word) => [...word].map((ch, i) => (i === 0 || Math.random() < 0.35 ? ch.toLocaleUpperCase('tr') : '＿')).join(' ')).join('   ');
}

// level 0: başlangıç (uyruk + mevki + ilk kulüp). Sonrası sırayla açılır.
function hints(p) {
  const words = p.n.split(' ');
  return [
    { name: '🎂 Doğum yılı', value: String(p.y) },
    { name: '👕 Forma giydiği kulüplerden', value: p.k.length ? p.k.slice(0, 2).join(', ') : 'Tüm kariyerini tek kulüpte geçirdi!' },
    { name: '🏆 Bilgi', value: p.f },
    { name: '🔤 Baş harfler', value: `${words.map((w) => `${w[0].toLocaleUpperCase('tr')}.`).join(' ')} (${words.map((w) => [...w].length).join(' + ')} harf)` },
    { name: '🔡 İsim', value: `\`${masked(p.n)}\`` },
  ];
}

function view(state, end) {
  const { p, level } = state;
  const reward = REWARDS[level];
  const embed = base(end === 'win' ? colors.success : end ? colors.error : 0x2ecc71)
    .setTitle(end ? `⚽ ${p.n}` : '⚽ Bu futbolcu kim?')
    .setThumbnail(`https://flagcdn.com/w160/${p.c}.png`)
    .addFields(
      { name: '🏳️ Uyruk', value: p.u, inline: true },
      { name: '🎯 Mevki', value: p.p, inline: true },
      { name: '🏟️ Kariyerine başladığı kulüp', value: p.s, inline: true },
      ...hints(p).slice(0, end ? 4 : level),
    );
  if (end) {
    embed.setDescription(end === 'win' ? `🎉 **${state.winner.username}** bildi!` : end === 'pes' ? `🏳️ Pes edildi. Cevap: **${p.n}**` : `⏰ Kimse bilemedi! Cevap: **${p.n}**`);
  } else {
    embed.setDescription(`Sohbete futbolcunun adını yaz!\nYanlış tahminler ve zaman geçtikçe yeni ipuçları açılır.`)
      .setFooter({ text: `İpucu ${level}/${REWARDS.length - 1} • Şu anki ödül: ${reward} boyoz • ${WRONG_PER_HINT} yanlış tahminde yeni ipucu` });
  }
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('fut:ipucu').setLabel('İpucu').setEmoji('💡').setStyle(ButtonStyle.Primary).setDisabled(Boolean(end) || level >= REWARDS.length - 1),
    new ButtonBuilder().setCustomId('fut:pes').setLabel('Pes Et').setEmoji('🏳️').setStyle(ButtonStyle.Danger).setDisabled(Boolean(end)),
  );
  return { embeds: [embed], components: end ? [] : [row], allowedMentions: { parse: [] } };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('futbolcu')
    .setDescription('⚽ Futbolcuyu tahmin et! Bilemedikçe ipuçları artar.')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o.setName('kategori').setDescription('Hangi futbolcular?').addChoices(
      { name: '🌍 Karışık', value: 'hepsi' }, { name: '🇹🇷 Türk futbolcular', value: 'tr' }, { name: '⭐ Yabancı yıldızlar', value: 'yabanci' },
    )),

  async execute(interaction) {
    const { channel } = interaction;
    if (!games.lockChannel(channel.id, 'Futbolcu Tahmin')) return replyFail(interaction, `Bu kanalda zaten bir oyun var (**${games.channelGame(channel.id)}**).`);
    const cat = interaction.options.getString('kategori') || 'hepsi';
    const pool = PLAYERS.filter((p) => cat === 'hepsi' || (cat === 'tr' ? p.c === 'tr' : p.c !== 'tr'));
    const p = pick(pool);
    const answers = p.a.map(games.norm);
    const state = { p, level: 0, wrong: 0, starter: interaction.user.id };
    let msg;
    try {
      msg = await games.replyMessage(interaction, view(state));
    } catch (err) {
      games.unlockChannel(channel.id);
      throw err;
    }

    let finished = false;
    let lastChanceTimer = null;
    const msgCol = channel.createMessageCollector({ filter: (m) => !m.author.bot, time: 5 * 60000 });
    const btnCol = msg.createMessageComponentCollector({ time: 5 * 60000 });

    const finish = async (end, winnerMsg) => {
      if (finished) return;
      finished = true;
      clearInterval(timer); clearTimeout(lastChanceTimer);
      msgCol.stop(); btnCol.stop();
      games.unlockChannel(channel.id);
      if (end === 'win') {
        state.winner = winnerMsg.author;
        const reward = REWARDS[state.level];
        const bal = economy.reward(interaction.guild.id, winnerMsg.author.id, reward);
        await winnerMsg.react('⚽').catch(() => {});
        await winnerMsg.reply({ embeds: [base(colors.success).setDescription(`🎉 **${winnerMsg.author.username}** bildi: **${p.n}**! (${state.level} ipucuyla)\n+${economy.fmt(reward)} • Cüzdan: ${economy.fmt(bal)}`)], allowedMentions: { repliedUser: false } }).catch(() => {});
      }
      await msg.edit(view(state, end)).catch(() => {});
    };

    const reveal = async () => {
      if (finished) return;
      if (state.level < REWARDS.length - 1) {
        state.level += 1;
        state.wrong = 0;
        await msg.edit(view(state)).catch(() => {});
        if (state.level === REWARDS.length - 1) lastChanceTimer = setTimeout(() => finish('time'), LAST_CHANCE);
      }
    };
    const timer = setInterval(reveal, HINT_EVERY);

    msgCol.on('collect', async (m) => {
      if (finished) return;
      const c = games.norm(m.content);
      if (!c) return;
      if (answers.some((a) => c === a || (a.length >= 5 && c.includes(a)))) return finish('win', m);
      // İsim gibi görünen yanlış tahminleri say
      if (c.length >= 3 && c.length <= 40 && c.split(' ').length <= 4) {
        await m.react('❌').catch(() => {});
        state.wrong += 1;
        if (state.wrong >= WRONG_PER_HINT) await reveal();
      }
    });
    msgCol.on('end', (_, reason) => { if (reason === 'time') finish('time'); });

    btnCol.on('collect', async (btn) => {
      if (btn.customId === 'fut:pes') {
        const staff = btn.memberPermissions?.has(PermissionFlagsBits.ManageMessages);
        if (btn.user.id !== state.starter && !staff) return btn.reply({ content: 'Sadece oyunu başlatan kişi veya yetkililer pes edebilir.', ...games.ephemeral });
        await btn.deferUpdate();
        return finish('pes');
      }
      if (state.level >= REWARDS.length - 1) return btn.reply({ content: 'Tüm ipuçları açıldı!', ...games.ephemeral });
      await btn.deferUpdate();
      return reveal();
    });
  },
};
