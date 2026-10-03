// Mesaj filtreleri: davet, link, küfür, büyük harf, spam, toplu etiket.
const { PermissionFlagsBits } = require('discord.js');
const db = require('./db');
const { base } = require('./embeds');
const { sendLog } = require('./logger');
const { createCase, addWarning } = require('./modcase');
const { isOwner, truncate } = require('./util');
const { colors } = require('../config');

const INVITE_RE = /(discord\.(gg|io|me|li)|discord(app)?\.com\/invite)\/[\w-]+/i;
const LINK_RE = /https?:\/\/([^\s/]+)/gi;
const spamTracker = new Map();

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i' };

// Küçük harfe çevirir, leetspeak'i çözer, tekrar eden harfleri teke indirir
function normalizeWord(word) {
  return word
    .toLocaleLowerCase('tr')
    .replace(/[013457@$!]/g, (c) => LEET[c])
    .replace(/[^a-zçğıöşü*]/g, '')
    .replace(/(.)\1+/g, '$1');
}

function findBadword(content, words) {
  const tokens = content.toLocaleLowerCase('tr').split(/[\s.,;:!?'"()[\]{}<>\-_/\\|+=~`^]+/).map(normalizeWord).filter(Boolean);
  // "a m k" gibi aralıklı yazımlar için birleşik hali de kontrol et
  const joined = normalizeWord(content.replace(/\s+/g, ''));
  for (const raw of words) {
    const prefix = raw.endsWith('*');
    const word = normalizeWord(raw.replace(/\*$/, ''));
    if (!word) continue;
    if (tokens.some((t) => (prefix ? t.startsWith(word) : t === word))) return raw;
    if (word.length >= 4 && joined === word) return raw;
  }
  return null;
}

function checkSpam(message) {
  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const list = (spamTracker.get(key) || []).filter((m) => now - m.at < 15000);
  list.push({ at: now, content: message.content.toLowerCase() });
  spamTracker.set(key, list);
  const fast = list.filter((m) => now - m.at < 5000).length >= 6;
  const dup = message.content.length > 0 && list.filter((m) => m.content === message.content.toLowerCase()).length >= 4;
  if (fast || dup) {
    spamTracker.delete(key);
    return fast ? 'Çok hızlı mesaj gönderme (spam)' : 'Aynı mesajı tekrar tekrar gönderme (spam)';
  }
  return null;
}

function detect(message, cfg) {
  const content = message.content || '';
  if (cfg.invites && INVITE_RE.test(content)) return 'Sunucu daveti paylaşmak yasak';
  if (cfg.links) {
    for (const m of content.matchAll(LINK_RE)) {
      const host = m[1].toLowerCase().replace(/^www\./, '');
      if (!cfg.allowedLinks.some((d) => host === d || host.endsWith(`.${d}`))) return 'Link paylaşmak yasak';
    }
  }
  if (cfg.badwords) {
    const word = findBadword(content, cfg.words);
    if (word) return 'Uygunsuz kelime kullanımı';
  }
  if (cfg.caps) {
    const letters = content.replace(/<[^>]+>/g, '').replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ]/g, '');
    const upper = letters.replace(/[^A-ZÇĞİÖŞÜ]/g, '');
    if (letters.length >= 12 && upper.length / letters.length > 0.75) return 'Aşırı büyük harf kullanımı';
  }
  if (cfg.mentionLimit > 0) {
    const count = message.mentions.users.size + message.mentions.roles.size + (message.mentions.everyone ? 1 : 0);
    if (count >= cfg.mentionLimit) return `Toplu etiketleme (${count} etiket)`;
  }
  if (cfg.spam) return checkSpam(message);
  return null;
}

function isExempt(message, cfg) {
  const { member, channel } = message;
  if (!member) return true;
  if (isOwner(member.id)) return true;
  if (member.permissions.has(PermissionFlagsBits.ManageMessages)) return true;
  if (cfg.exemptChannels.includes(channel.id) || (channel.parentId && cfg.exemptChannels.includes(channel.parentId))) return true;
  return member.roles.cache.some((r) => cfg.exemptRoles.includes(r.id));
}

// Mesaj ihlal ettiyse işlem yapar ve true döner.
async function handle(message) {
  const cfg = db.guild(message.guild.id).automod;
  if (!cfg.enabled || isExempt(message, cfg)) return false;
  const reason = detect(message, cfg);
  if (!reason) return false;

  await message.delete().catch(() => {});
  const me = message.guild.members.me;
  const fullReason = `AutoMod: ${reason}`;
  let note = '';

  if (cfg.action === 'uyar') {
    const { total } = await addWarning(message.guild, message.author.id, me.id, fullReason);
    note = ` (toplam uyarı: ${total})`;
  } else if (cfg.action === 'sustur' && message.member.moderatable) {
    const duration = cfg.muteMinutes * 60000;
    await message.member.timeout(duration, fullReason).catch(() => {});
    await createCase(message.guild, { type: 'timeout', targetId: message.author.id, modId: me.id, reason: fullReason, duration });
    note = ` ve ${cfg.muteMinutes} dakika susturuldun`;
  } else {
    await sendLog(message.guild, 'moderasyon', base(colors.dark)
      .setTitle('🤖 AutoMod • Mesaj silindi')
      .addFields(
        { name: 'Kullanıcı', value: `${message.author} (\`${message.author.id}\`)`, inline: true },
        { name: 'Kanal', value: `${message.channel}`, inline: true },
        { name: 'Sebep', value: reason },
        { name: 'İçerik', value: truncate(message.content, 1000) || '—' },
      ));
  }

  const warning = await message.channel.send({
    content: `${message.author}, ${reason.toLowerCase()}!${note ? ` Mesajın silindi${note}.` : ''} 🥐`,
    allowedMentions: { users: [message.author.id] },
  }).catch(() => null);
  if (warning) setTimeout(() => warning.delete().catch(() => {}), 6000);
  return true;
}

// Bellek sızıntısını önlemek için eski spam kayıtlarını temizle
setInterval(() => {
  const now = Date.now();
  for (const [key, list] of spamTracker) if (!list.some((m) => now - m.at < 15000)) spamTracker.delete(key);
}, 60000).unref();

module.exports = { handle, findBadword };
