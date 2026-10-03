// Oyunlar için ortak yardımcılar: kanal kilidi, cevap normalleştirme ve "ilk bilen kazanır" yarışmaları.
const { MessageFlags } = require('discord.js');
const { base, replyFail } = require('./embeds');
const economy = require('./economy');
const { colors } = require('../config');

const busy = new Map(); // kanalId -> oyun adı

function lockChannel(channelId, name) {
  if (busy.has(channelId)) return false;
  busy.set(channelId, name);
  return true;
}
const unlockChannel = (channelId) => busy.delete(channelId);
const channelGame = (channelId) => busy.get(channelId);

const TR_MAP = { ı: 'i', i: 'i', ş: 's', ğ: 'g', ü: 'u', ö: 'o', ç: 'c', â: 'a', î: 'i', û: 'u' };

// Büyük/küçük harf, Türkçe karakter ve noktalama farkını yok sayar: "Türkiye!" == "turkiye"
function norm(text) {
  return String(text || '')
    .toLocaleLowerCase('tr')
    .replace(/[ıişğüöçâîû]/g, (c) => TR_MAP[c] || c)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Yanıt verip mesaj nesnesini döndürür
async function replyMessage(interaction, payload) {
  const res = await interaction.reply({ ...payload, withResponse: true });
  return res.resource.message;
}

/**
 * Kanala bir soru atar; süre içinde mesajla ilk doğru cevabı yazan kazanır.
 * @param {object} o
 * @param {string} o.name        Oyun adı (kanal kilidi için)
 * @param {EmbedBuilder} o.embed Soru embed'i
 * @param {Function} o.check     (normalizedContent, message) => boolean
 * @param {string} o.answer      Gösterilecek doğru cevap
 * @param {number} o.reward      Kazanana verilecek boyoz
 * @param {number} [o.time]      Süre (ms)
 * @param {Function} [o.onGuess] Yanlış tahminlerde çağrılır: (message) => void
 */
async function race(interaction, { name, embed, files = [], check, answer, reward, time = 30000, onGuess }) {
  const { channel } = interaction;
  if (!lockChannel(channel.id, name)) {
    return replyFail(interaction, `Bu kanalda zaten bir oyun oynanıyor (**${channelGame(channel.id)}**). Bitmesini bekle!`);
  }
  embed.setFooter({ text: `⏱️ ${Math.round(time / 1000)} saniye • İlk doğru yazan ${reward} boyoz kazanır` });
  const started = Date.now();
  try {
    await interaction.reply({ embeds: [embed], files });
  } catch (err) {
    unlockChannel(channel.id);
    throw err;
  }

  return new Promise((resolve) => {
    const collector = channel.createMessageCollector({ filter: (m) => !m.author.bot, time });
    collector.on('collect', (m) => {
      if (check(norm(m.content), m)) collector.stop('won');
      else onGuess?.(m);
    });
    collector.on('end', async (collected, reason) => {
      unlockChannel(channel.id);
      if (reason === 'won') {
        const winner = collected.last();
        const balance = economy.reward(interaction.guild.id, winner.author.id, reward);
        const secs = ((winner.createdTimestamp - started) / 1000).toFixed(1);
        await winner.react('✅').catch(() => {});
        await winner.reply({
          embeds: [base(colors.success).setDescription(`🎉 **${winner.author.username}** bildi! Cevap: **${answer}**\n⚡ ${secs} saniye • +${economy.fmt(reward)} (Cüzdan: ${economy.fmt(balance)})`)],
          allowedMentions: { repliedUser: false },
        }).catch(() => {});
        resolve(winner);
      } else {
        await channel.send({ embeds: [base(colors.error).setDescription(`⏰ Süre doldu, kimse bilemedi! Doğru cevap: **${answer}**`)] }).catch(() => {});
        resolve(null);
      }
    });
  });
}

// Bahisli oyunlarda bakiye kontrolü
function checkBet(interaction, amount) {
  if (amount < 1) return 'Bahis en az 1 boyoz olmalı.';
  const w = economy.wallet(interaction.guild.id, interaction.user.id);
  if (w.balance < amount) return `Yeterli boyozun yok! Cüzdan: ${economy.fmt(w.balance)}\n\`/boyoz gunluk\`, \`/boyoz calis\` veya \`/cark\` ile boyoz kazanabilirsin.`;
  return null;
}

const ephemeral = { flags: MessageFlags.Ephemeral };

module.exports = { lockChannel, unlockChannel, channelGame, norm, shuffle, replyMessage, race, checkBet, ephemeral };
