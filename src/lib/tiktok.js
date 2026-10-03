// TikTok canlı yayın takibi.
// Her hesap için kanalda sürekli duran bir "durum kartı" tutulur: ÇEVRİMDIŞI <-> ÇEVRİMİÇİ.
// Yayın başlayınca kart güncellenir ve ayrı bir mesajla rol etiketlenir (düzenlenen mesajlar bildirim göndermez).
// Not: TikTok'un resmi bir canlı yayın API'si yok; TikTok web sitesinin kullandığı uç nokta okunur.
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, PermissionFlagsBits, MessageFlags,
} = require('discord.js');
const db = require('./db');
const { lib: canvas, FONT } = require('./canvas');
const { fillTemplate } = require('./util');

const POLL_INTERVAL = 90 * 1000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const DEFAULT_MESSAGE = '{etiket} 🔴 **{isim} yayında!** Hemen katıl 👉 {link}';

const liveLink = (username) => `https://www.tiktok.com/@${username}/live`;
const profileLink = (username) => `https://www.tiktok.com/@${username}`;

// Hesabın anlık durumunu getirir.
async function fetchStatus(username) {
  const url = `https://www.tiktok.com/api-live/user/room/?aid=1988&sourceType=54&uniqueId=${encodeURIComponent(username)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`TikTok HTTP ${res.status}`);
  const json = await res.json();
  const user = json?.data?.user;
  if (!user) throw new Error(json?.statusCode ? `TikTok kullanıcı bulunamadı (${json.statusCode})` : 'TikTok yanıtı okunamadı');
  const room = json.data.liveRoom || {};
  return {
    live: room.status === 2 || user.status === 2,
    roomId: user.roomId || null,
    nickname: user.nickname || username,
    avatar: user.avatarLarger || user.avatarMedium || null,
    title: room.title || null,
    cover: room.coverUrl || null,
    startTime: room.startTime ? room.startTime * 1000 : null,
    viewers: room.liveRoomStats?.userCount ?? null,
    followers: json.data.stats?.followerCount ?? null,
  };
}

// ---------------------------------------------------------------- durum kartı görseli
async function loadRemote(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(String(res.status));
  return canvas.loadImage(Buffer.from(await res.arrayBuffer()));
}

// Yazı tipinde olmayan emojileri görselden çıkarır (Discord metninde kalırlar)
const stripEmoji = (text) => (text || '').replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F1E6}-\u{1F1FF}]/gu, '').replace(/\s+/g, ' ').trim();

async function renderCard(acc, status) {
  if (!canvas) return null;
  const W = 1000;
  const H = 300;
  const c = canvas.createCanvas(W, H);
  const ctx = c.getContext('2d');
  const live = status.live;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  if (live) { bg.addColorStop(0, '#2a0a12'); bg.addColorStop(1, '#5c0f24'); } else { bg.addColorStop(0, '#16171a'); bg.addColorStop(1, '#25272c'); }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // TikTok renklerinde ince çizgiler
  ctx.fillStyle = '#25f4ee'; ctx.fillRect(0, H - 8, W / 2, 8);
  ctx.fillStyle = '#fe2c55'; ctx.fillRect(W / 2, H - 8, W / 2, 8);

  // Avatar
  const cx = 150; const cy = H / 2 - 4; const r = 100;
  try {
    if (status.avatar) {
      const img = await loadRemote(status.avatar);
      ctx.save();
      if (!live) ctx.filter = 'grayscale(100%)';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
    }
  } catch { /* avatar alınamazsa sadece halka */ }
  ctx.beginPath(); ctx.arc(cx, cy, r + 7, 0, Math.PI * 2);
  ctx.lineWidth = 10; ctx.strokeStyle = live ? '#fe2c55' : '#5b5e66'; ctx.stroke();
  if (live) {
    // "CANLI" rozeti
    ctx.fillStyle = '#fe2c55';
    ctx.beginPath(); ctx.roundRect(cx - 55, cy + r - 18, 110, 38, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `bold 22px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText('CANLI', cx, cy + r + 9);
    ctx.textAlign = 'left';
  }

  const x = 300;
  ctx.fillStyle = live ? '#fe2c55' : '#6b6f78';
  ctx.beginPath(); ctx.arc(x + 9, 86, 9, 0, Math.PI * 2); ctx.fill();
  ctx.font = `bold 26px ${FONT}`;
  ctx.fillStyle = live ? '#ff8aa3' : '#8b8f99';
  ctx.fillText(live ? 'YAYINCI ÇEVRİMİÇİ' : 'YAYINCI ÇEVRİMDIŞI', x + 30, 95);

  ctx.fillStyle = '#ffffff';
  let size = 58;
  const name = stripEmoji(status.nickname) || acc.username;
  do { ctx.font = `800 ${size}px ${FONT}`; size -= 2; } while (ctx.measureText(name).width > W - x - 40 && size > 24);
  ctx.fillText(name, x, 165);

  ctx.font = `26px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  let sub = live ? (stripEmoji(status.title) || 'Canlı yayında!') : `@${acc.username} • TikTok`;
  while (ctx.measureText(sub).width > W - x - 40 && sub.length > 4) sub = `${sub.slice(0, -2)}…`;
  ctx.fillText(sub, x, 215);

  if (!live) {
    ctx.font = `22px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText('Yayın başlayınca burada haber vereceğiz', x, 255);
  }
  return new AttachmentBuilder(await c.encode('png'), { name: 'tiktok-durum.png' });
}

async function buildCard(acc, status) {
  const live = status.live;
  const embed = new EmbedBuilder()
    .setColor(live ? 0xfe2c55 : 0x4f545c)
    .setAuthor({ name: `@${acc.username} • TikTok`, iconURL: status.avatar || undefined, url: profileLink(acc.username) })
    .setTitle(live ? '🔴 YAYINCI ÇEVRİMİÇİ' : '⚫ YAYINCI ÇEVRİMDIŞI')
    .setURL(live ? liveLink(acc.username) : profileLink(acc.username))
    .setFooter({ text: 'Boyoz Sistem • Durum otomatik güncellenir' })
    .setTimestamp();
  if (live) {
    embed.setDescription(`**${status.nickname}** şu an canlı yayında! Kaçırma 👇${status.title ? `\n\n> ${status.title}` : ''}`);
    const fields = [];
    if (status.startTime) fields.push({ name: '⏱️ Başladı', value: `<t:${Math.floor(status.startTime / 1000)}:R>`, inline: true });
    if (status.viewers != null) fields.push({ name: '👀 İzleyici', value: status.viewers.toLocaleString('tr-TR'), inline: true });
    if (fields.length) embed.addFields(fields);
  } else {
    embed.setDescription(`**${status.nickname}** şu an yayında değil.\nYayın başladığında ${acc.mention ? `<@&${acc.mention}>` : 'herkes'} etiketlenecek. 🔔`);
    if (acc.lastLiveAt) embed.addFields({ name: '📅 Son yayın', value: `<t:${Math.floor(acc.lastLiveAt / 1000)}:R>`, inline: true });
  }
  if (status.followers != null) embed.addFields({ name: '❤️ Takipçi', value: status.followers.toLocaleString('tr-TR'), inline: true });

  const files = [];
  const image = await renderCard(acc, status).catch(() => null);
  if (image) { embed.setImage('attachment://tiktok-durum.png'); files.push(image); } else if (live && status.cover) embed.setImage(status.cover);

  const row = new ActionRowBuilder().addComponents(live
    ? new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Yayına Katıl').setEmoji('🔴').setURL(liveLink(acc.username))
    : new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Profili Takip Et').setEmoji('🎵').setURL(profileLink(acc.username)));
  return { embeds: [embed], files, components: [row], attachments: [] };
}

// Kartı oluşturur ya da günceller (silinmişse yeniden gönderir).
async function upsertCard(guild, acc, status) {
  const channel = guild.channels.cache.get(acc.channelId);
  if (!channel?.isTextBased()) return;
  const payload = await buildCard(acc, status);
  let msg = acc.cardMessageId ? await channel.messages.fetch(acc.cardMessageId).catch(() => null) : null;
  if (msg) await msg.edit(payload);
  else {
    const { attachments: _attachments, ...sendPayload } = payload;
    msg = await channel.send(sendPayload);
    acc.cardMessageId = msg.id;
    db.save();
  }
}

async function notifyLive(guild, acc, status) {
  const channel = guild.channels.cache.get(acc.channelId);
  if (!channel?.isTextBased()) return;
  const mention = acc.mention === 'everyone' ? '@everyone' : acc.mention === 'here' ? '@here' : acc.mention ? `<@&${acc.mention}>` : '';
  const content = fillTemplate(acc.message || DEFAULT_MESSAGE, {
    guild,
    extra: { etiket: mention, isim: status.nickname, kullanici: `@${acc.username}`, link: liveLink(acc.username), baslik: status.title || '' },
  }).trim();
  const allowedMentions = acc.mention === 'everyone' || acc.mention === 'here'
    ? { parse: ['everyone'] } : { roles: acc.mention ? [acc.mention] : [] };
  // Kart zaten var, link önizlemesi gereksiz
  const msg = await channel.send({ content, allowedMentions, flags: MessageFlags.SuppressEmbeds });
  acc.pingMessageId = msg.id;
}

// Tek bir hesabı kontrol eder, durum değiştiyse kartı günceller.
async function checkAccount(guild, acc, { force = false } = {}) {
  const status = await fetchStatus(acc.username);
  acc.failures = 0;
  const wasLive = Boolean(acc.live);
  const roomKey = status.roomId || String(status.startTime || '');

  if (status.live && (!wasLive || acc.lastRoom !== roomKey)) {
    acc.live = true;
    acc.lastRoom = roomKey;
    acc.lastLiveAt = status.startTime || Date.now();
    db.save();
    await upsertCard(guild, acc, status);
    await notifyLive(guild, acc, status);
    db.save();
  } else if (!status.live && wasLive) {
    acc.live = false;
    // Yayın bitti: etiket mesajını kaldır, kart çevrimdışına döner
    if (acc.pingMessageId) {
      const channel = guild.channels.cache.get(acc.channelId);
      await channel?.messages.delete(acc.pingMessageId).catch(() => {});
      acc.pingMessageId = null;
    }
    db.save();
    await upsertCard(guild, acc, status);
  } else if (force || status.live) {
    // Yayın sürerken izleyici sayısı vb. güncellensin
    await upsertCard(guild, acc, status);
  }
  return status;
}

let running = false;
async function tick(client) {
  if (running) return;
  running = true;
  try {
    for (const [guildId, g] of Object.entries(db.data.guilds)) {
      const guild = client.guilds.cache.get(guildId);
      if (!guild || !g.tiktok?.accounts?.length) continue;
      for (const acc of g.tiktok.accounts) {
        try {
          await checkAccount(guild, acc, { force: !acc.cardMessageId }); // kart yoksa oluştur
        } catch (err) {
          acc.failures = (acc.failures || 0) + 1;
          if (acc.failures === 1 || acc.failures % 20 === 0) console.warn(`[tiktok] @${acc.username} kontrol edilemedi (${acc.failures}. kez):`, err.message);
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  } finally {
    running = false;
  }
}

function start(client) {
  setTimeout(() => tick(client), 10000);
  setInterval(() => tick(client), POLL_INTERVAL);
}

function canPost(guild, channelId) {
  const channel = guild.channels.cache.get(channelId);
  return channel?.permissionsFor(guild.members.me)?.has([
    PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ManageMessages,
  ]);
}

module.exports = { start, fetchStatus, checkAccount, upsertCard, notifyLive, buildCard, liveLink, canPost, DEFAULT_MESSAGE };
