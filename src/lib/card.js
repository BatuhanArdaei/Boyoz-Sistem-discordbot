// Hoş geldin / güle güle görsel kartı. @napi-rs/canvas yüklenemezse null döner ve bot kartsız devam eder.
const { AttachmentBuilder } = require('discord.js');
const { assets } = require('../config');

let canvasLib = null;
try {
  canvasLib = require('@napi-rs/canvas');
} catch (err) {
  console.warn('[kart] @napi-rs/canvas yüklenemedi, karşılama kartları kapalı:', err.message);
}

const FONT = '"Segoe UI", "Noto Sans", "DejaVu Sans", Arial, sans-serif';
let bannerImage = null;

async function fetchImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Görsel indirilemedi: ${res.status}`);
  return canvasLib.loadImage(Buffer.from(await res.arrayBuffer()));
}

function fitText(ctx, text, maxWidth, startSize, weight = 'bold') {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px ${FONT}`;
    size -= 2;
  } while (ctx.measureText(text).width > maxWidth && size > 20);
  return text;
}

async function welcomeCard(member, { title = 'HOŞ GELDİN', subtitle } = {}) {
  if (!canvasLib) return null;
  const { createCanvas, loadImage } = canvasLib;
  const W = 1100;
  const H = 400;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Arka plan: banner, "cover" kırpma
  bannerImage ??= await loadImage(assets.banner);
  const scale = Math.max(W / bannerImage.width, H / bannerImage.height);
  const bw = bannerImage.width * scale;
  const bh = bannerImage.height * scale;
  ctx.drawImage(bannerImage, (W - bw) / 2, (H - bh) / 2, bw, bh);

  // Okunabilirlik için karartma
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, 'rgba(15, 10, 5, 0.88)');
  grad.addColorStop(0.65, 'rgba(15, 10, 5, 0.70)');
  grad.addColorStop(1, 'rgba(15, 10, 5, 0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Avatar
  const cx = 200;
  const cy = H / 2;
  const r = 120;
  try {
    const avatar = await fetchImage(member.user.displayAvatarURL({ extension: 'png', size: 256 }));
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  } catch { /* avatar alınamazsa sadece halka çizilir */ }
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#DF8E4E';
  ctx.stroke();

  // Metinler
  const textX = 370;
  const maxW = W - textX - 50;
  ctx.fillStyle = '#F8C291';
  ctx.font = `bold 34px ${FONT}`;
  ctx.fillText(title, textX, 140);

  ctx.fillStyle = '#FFFFFF';
  const name = member.displayName || member.user.username;
  fitText(ctx, name, maxW, 72);
  ctx.fillText(name, textX, 225);

  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  const sub = subtitle || `${member.guild.name} • ${member.guild.memberCount}. üye`;
  fitText(ctx, sub, maxW, 28, 'normal');
  ctx.fillText(sub, textX, 285);

  const buffer = await canvas.encode('png');
  return new AttachmentBuilder(buffer, { name: 'hosgeldin.png' });
}

module.exports = { welcomeCard, available: () => Boolean(canvasLib) };
