// Çekiliş sistemi: butonla katılım, rol şartı, boyoz ödülü, yeniden çekme.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('./db');
const economy = require('./economy');
const { base } = require('./embeds');
const { ts } = require('./util');
const { colors } = require('../config');

function render(gw) {
  const embed = base(gw.ended ? colors.dark : 0xf1c40f)
    .setTitle(`🎉 ${gw.prize}`)
    .setDescription([
      gw.description ? `${gw.description}\n` : '',
      gw.ended ? `**Bitti!** ${gw.winners.length ? `Kazanan: ${gw.winners.map((id) => `<@${id}>`).join(', ')}` : 'Yeterli katılım olmadı.'}` : `⏰ Bitiş: ${ts(gw.endsAt, 'R')} (${ts(gw.endsAt)})`,
      `👥 Katılımcı: **${gw.entrants.length}** • 🏆 Kazanan sayısı: **${gw.winnerCount}**`,
      gw.roleReq ? `🔒 Şart: <@&${gw.roleReq}> rolüne sahip olmak` : '',
      gw.boyoz ? `🥐 Her kazanana **${gw.boyoz.toLocaleString('tr-TR')}** boyoz!` : '',
      `🎙️ Düzenleyen: <@${gw.hostId}>`,
    ].filter(Boolean).join('\n'));
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cekilis:katil').setLabel(gw.ended ? 'Çekiliş bitti' : 'Katıl').setEmoji('🎉').setStyle(ButtonStyle.Success).setDisabled(gw.ended),
    new ButtonBuilder().setCustomId('cekilis:liste').setLabel(`${gw.entrants.length}`).setEmoji('👥').setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [row], allowedMentions: { parse: [] } };
}

function pickWinners(entrants, count, exclude = []) {
  const pool = entrants.filter((id) => !exclude.includes(id));
  const out = [];
  while (pool.length && out.length < count) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}

async function end(client, guildId, messageId, { reroll = false } = {}) {
  const gw = db.guild(guildId).giveaways[messageId];
  if (!gw || (gw.ended && !reroll)) return null;
  const winners = pickWinners(gw.entrants, reroll ? 1 : gw.winnerCount, reroll ? gw.winners : []);
  gw.winners = reroll ? [...gw.winners, ...winners] : winners;
  gw.ended = true;
  if (gw.boyoz) for (const id of winners) economy.reward(guildId, id, gw.boyoz);
  db.save();
  const channel = await client.channels.fetch(gw.channelId).catch(() => null);
  const msg = await channel?.messages.fetch(messageId).catch(() => null);
  if (msg) await msg.edit(render(gw)).catch(() => {});
  if (channel) {
    await channel.send({
      content: winners.length
        ? `🎉 Tebrikler ${winners.map((id) => `<@${id}>`).join(', ')}! **${gw.prize}** kazandın${winners.length > 1 ? 'ız' : ''}!${gw.boyoz ? ` (+${gw.boyoz} 🥐)` : ''}${reroll ? ' *(yeniden çekiliş)*' : ''}`
        : `😔 **${gw.prize}** çekilişine yeterli katılım olmadı.`,
      reply: msg ? { messageReference: msg.id, failIfNotExists: false } : undefined,
      allowedMentions: { users: winners },
    }).catch(() => {});
  }
  // 14 günden eski bitmiş çekilişleri temizle
  const all = db.guild(guildId).giveaways;
  for (const [id, x] of Object.entries(all)) if (x.ended && Date.now() - x.endsAt > 14 * 864e5) delete all[id];
  db.save();
  return winners;
}

module.exports = { render, end };
