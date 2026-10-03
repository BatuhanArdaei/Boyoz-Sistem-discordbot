// Butonlu anket sistemi (anket komutu ve zamanlayıcı ortak kullanır).
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('./db');
const { base } = require('./embeds');
const { ts } = require('./util');

const NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

function tally(poll) {
  const counts = poll.options.map(() => 0);
  for (const idx of Object.values(poll.votes)) counts[idx] += 1;
  return counts;
}

function bar(ratio) {
  const filled = Math.round(ratio * 12);
  return '🟧'.repeat(filled) + '⬛'.repeat(12 - filled);
}

function renderPoll(poll) {
  const counts = tally(poll);
  const total = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(...counts);
  const lines = poll.options.map((opt, i) => {
    const pct = total ? Math.round((counts[i] / total) * 100) : 0;
    const crown = poll.ended && total && counts[i] === max ? ' 👑' : '';
    return `${NUMBERS[i]} **${opt}**${crown}\n${bar(total ? counts[i] / total : 0)} ${counts[i]} oy (%${pct})`;
  });
  const embed = base()
    .setTitle(`📊 ${poll.question}`)
    .setDescription(lines.join('\n\n'))
    .addFields(
      { name: 'Toplam Oy', value: String(total), inline: true },
      { name: poll.ended ? 'Durum' : 'Bitiş', value: poll.ended ? '🔒 Sona erdi' : (poll.endsAt ? ts(poll.endsAt, 'R') : 'Elle bitirilecek'), inline: true },
      { name: 'Oluşturan', value: `<@${poll.creatorId}>`, inline: true },
    );

  const rows = [];
  if (!poll.ended) {
    for (let i = 0; i < poll.options.length; i += 5) {
      rows.push(new ActionRowBuilder().addComponents(
        poll.options.slice(i, i + 5).map((opt, j) => new ButtonBuilder()
          .setCustomId(`anket:oy:${i + j}`)
          .setEmoji(NUMBERS[i + j])
          .setLabel(opt.slice(0, 70))
          .setStyle(ButtonStyle.Secondary)),
      ));
    }
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('anket:bitir').setLabel('Anketi Bitir').setEmoji('🔒').setStyle(ButtonStyle.Danger),
    ));
  }
  return { embeds: [embed], components: rows };
}

async function endPoll(client, guildId, messageId) {
  const g = db.guild(guildId);
  const poll = g.polls[messageId];
  if (!poll || poll.ended) return;
  poll.ended = true;
  db.save();
  try {
    const channel = await client.channels.fetch(poll.channelId);
    const msg = await channel.messages.fetch(messageId);
    await msg.edit(renderPoll(poll));
    const counts = tally(poll);
    const total = counts.reduce((a, b) => a + b, 0);
    const max = Math.max(...counts);
    const winners = poll.options.filter((_, i) => counts[i] === max);
    await msg.reply({
      content: total
        ? `📊 **${poll.question}** anketi bitti! Kazanan: **${winners.join(', ')}** (${max} oy)`
        : `📊 **${poll.question}** anketi bitti, hiç oy kullanılmadı.`,
      allowedMentions: { parse: [] },
    });
  } catch { /* mesaj silinmiş olabilir */ }
  // 7 günden eski bitmiş anketleri temizle
  for (const [id, p] of Object.entries(g.polls)) {
    if (p.ended && Date.now() - (p.endsAt || p.createdAt) > 7 * 864e5) delete g.polls[id];
  }
  db.save();
}

module.exports = { renderPoll, endPoll, tally };
