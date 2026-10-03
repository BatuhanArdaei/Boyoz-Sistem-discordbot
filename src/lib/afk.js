// AFK sistemi: /afk ile ayarlanır, kullanıcı yazınca veya seste hareket edince kalkar.
const db = require('./db');
const { base } = require('./embeds');
const { truncate } = require('./util');

const PREFIX = '[AFK] ';
const GRACE = 5000; // /afk yazdıktan hemen sonraki hareketler AFK'yı kaldırmasın
const NOTICE_TTL = 10000;
const noticeCooldown = new Map(); // "kanal:kullanıcı" -> zaman (aynı kişiyi art arda bildirmemek için)

const store = (guildId) => db.guild(guildId).afk;
const get = (guildId, userId) => store(guildId)[userId] || null;

async function set(member, reason) {
  const entry = { reason: reason || null, since: Date.now(), oldNick: member.nickname ?? null, nickChanged: false, pings: [] };
  const current = member.displayName;
  if (member.manageable && !current.startsWith(PREFIX)) {
    const nick = `${PREFIX}${current}`.slice(0, 32);
    entry.nickChanged = await member.setNickname(nick, 'AFK').then(() => true).catch(() => false);
  }
  store(member.guild.id)[member.id] = entry;
  db.save();
  return entry;
}

// AFK'yı kaldırır ve kullanıcıya sadece onun görebileceği şekilde bildirir.
async function clear(member, { fallbackChannel = null, fallbackMessage = null } = {}) {
  const afk = store(member.guild.id);
  const entry = afk[member.id];
  if (!entry) return;
  delete afk[member.id];
  db.save();

  if (entry.nickChanged && member.manageable && member.displayName.startsWith(PREFIX)) {
    await member.setNickname(entry.oldNick, 'AFK bitti').catch(() => {});
  }

  const mins = Math.max(1, Math.round((Date.now() - entry.since) / 60000));
  const embed = base(0x57f287).setTitle('👋 Tekrar hoş geldin!')
    .setDescription(`Artık AFK değilsin. **${mins} dakika** AFK kaldın.${entry.reason ? `\nSebep: *${entry.reason}*` : ''}`);
  if (entry.pings.length) {
    embed.addFields({
      name: `🔔 AFK iken ${entry.pings.length} kez etiketlendin`,
      value: truncate(entry.pings.slice(-10).map((p) => `• <@${p.by}> <t:${Math.floor(p.at / 1000)}:R> — [mesaja git](${p.url})`).join('\n'), 1024),
    });
  }
  embed.setFooter({ text: member.guild.name });

  // Sadece kullanıcı görsün: önce DM, DM kapalıysa kanalda kısa süreli yanıt
  const dm = await member.send({ embeds: [embed] }).then(() => true).catch(() => false);
  if (!dm && (fallbackMessage || fallbackChannel)) {
    const payload = { content: `${member}`, embeds: [embed], allowedMentions: { users: [member.id] } };
    const sent = fallbackMessage
      ? await fallbackMessage.reply(payload).catch(() => null)
      : await fallbackChannel.send(payload).catch(() => null);
    if (sent) setTimeout(() => sent.delete().catch(() => {}), 5000);
  }
}

// Mesajda AFK birinden bahsedildiyse bilgi verir; yazan AFK ise AFK'sını kaldırır.
async function handleMessage(message) {
  const { guild, member } = message;
  const afk = store(guild.id);
  if (!Object.keys(afk).length) return;

  const own = afk[message.author.id];
  if (own && Date.now() - own.since > GRACE && member) await clear(member, { fallbackMessage: message });

  const targets = new Set(message.mentions.users.keys());
  if (message.mentions.repliedUser) targets.add(message.mentions.repliedUser.id);
  targets.delete(message.author.id);
  const lines = [];
  for (const id of targets) {
    const entry = afk[id];
    if (!entry) continue;
    entry.pings.push({ by: message.author.id, at: Date.now(), url: message.url });
    if (entry.pings.length > 50) entry.pings.shift();
    const key = `${message.channel.id}:${id}`;
    if (Date.now() - (noticeCooldown.get(key) || 0) < 30000) continue;
    noticeCooldown.set(key, Date.now());
    lines.push(`💤 <@${id}> şu an **AFK**${entry.reason ? `: *${entry.reason}*` : ''} • <t:${Math.floor(entry.since / 1000)}:R>`);
  }
  if (lines.length) db.save();
  if (!lines.length) return;
  const notice = await message.reply({ embeds: [base(0x99aab5).setDescription(lines.join('\n'))], allowedMentions: { parse: [], repliedUser: false } }).catch(() => null);
  if (notice) setTimeout(() => notice.delete().catch(() => {}), NOTICE_TTL);
}

// Seste herhangi bir hareket (giriş, çıkış, geçiş, mikrofon/kulaklık) AFK'yı kaldırır.
async function handleVoice(oldState, newState) {
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;
  const entry = get(member.guild.id, member.id);
  if (!entry || Date.now() - entry.since < GRACE) return;
  const changed = oldState.channelId !== newState.channelId
    || oldState.selfMute !== newState.selfMute
    || oldState.selfDeaf !== newState.selfDeaf
    || oldState.streaming !== newState.streaming
    || oldState.selfVideo !== newState.selfVideo;
  // DM kapalıysa bildirim ses kanalının kendi sohbetine düşer
  const voiceChat = newState.channel?.isTextBased() ? newState.channel : null;
  if (changed) await clear(member, { fallbackChannel: voiceChat });
}

module.exports = { set, clear, get, handleMessage, handleVoice, PREFIX };
