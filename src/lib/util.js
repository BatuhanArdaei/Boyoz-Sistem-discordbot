const { PermissionFlagsBits } = require('discord.js');
const config = require('../config');
const db = require('./db');

// ---------- Yetki ----------
function isOwner(userId) {
  return config.ownerIds.includes(userId) || db.data.meta.owners.includes(userId);
}

// Moderatörün hedef üye üzerinde işlem yapıp yapamayacağını kontrol eder. Hata metni veya null döner.
function checkHierarchy(interaction, target) {
  const { guild, member: mod } = interaction;
  if (!target) return null;
  if (target.id === mod.id) return 'Bu işlemi kendine uygulayamazsın.';
  if (target.id === guild.ownerId) return 'Sunucu sahibine bu işlemi uygulayamazsın.';
  if (target.id === interaction.client.user.id) return 'Bunu bana yapamazsın. 🥲';
  const me = guild.members.me;
  if (target.roles.highest.position >= me.roles.highest.position) {
    return 'Bu kullanıcının rolü benim en yüksek rolümden yüksek veya eşit, işlem yapamıyorum.';
  }
  if (mod.id !== guild.ownerId && !isOwner(mod.id) && target.roles.highest.position >= mod.roles.highest.position) {
    return 'Bu kullanıcının rolü seninkinden yüksek veya eşit.';
  }
  return null;
}

function isStaff(member) {
  return member.permissions.has(PermissionFlagsBits.ManageMessages) || isOwner(member.id);
}

// ---------- Süre ----------
const UNITS = { s: 1e3, sn: 1e3, m: 6e4, dk: 6e4, h: 36e5, sa: 36e5, d: 864e5, g: 864e5, w: 6048e5, hf: 6048e5 };

// "10m", "1sa 30dk", "2d", "45" (dakika) -> milisaniye
function parseDuration(input) {
  if (!input) return null;
  const str = String(input).toLowerCase().replace(/\s+/g, '');
  if (/^\d+$/.test(str)) return Number(str) * 6e4;
  const re = /(\d+)(sn|dk|sa|hf|s|m|h|d|g|w)/g;
  let total = 0;
  let consumed = 0;
  let match;
  while ((match = re.exec(str))) {
    total += Number(match[1]) * UNITS[match[2]];
    consumed += match[0].length;
  }
  return consumed === str.length && total > 0 ? total : null;
}

function formatDuration(ms) {
  if (ms <= 0) return '0 saniye';
  const parts = [];
  const add = (v, label) => { if (v) parts.push(`${v} ${label}`); };
  add(Math.floor(ms / 864e5), 'gün');
  add(Math.floor((ms % 864e5) / 36e5), 'saat');
  add(Math.floor((ms % 36e5) / 6e4), 'dakika');
  add(Math.floor((ms % 6e4) / 1e3), 'saniye');
  return parts.slice(0, 2).join(' ');
}

// "2026-10-05 20:30", "05.10.2026 20:30", "20:30" (bugün/yarın) veya süre ("2h") -> timestamp (Türkiye saati)
function parseWhen(input) {
  const str = String(input).trim();
  const offset = config.utcOffsetMinutes * 6e4;
  const toTs = (y, mo, d, h, mi) => Date.UTC(y, mo - 1, d, h, mi) - offset;

  let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})$/);
  if (m) return toTs(+m[1], +m[2], +m[3], +m[4], +m[5]);
  m = str.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4}) (\d{1,2}):(\d{2})$/);
  if (m) return toTs(+m[3], +m[2], +m[1], +m[4], +m[5]);
  m = str.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const nowLocal = new Date(Date.now() + offset);
    let ts = toTs(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth() + 1, nowLocal.getUTCDate(), +m[1], +m[2]);
    if (ts <= Date.now()) ts += 864e5;
    return ts;
  }
  const dur = parseDuration(str);
  return dur ? Date.now() + dur : null;
}

const ts = (ms, style = 'f') => `<t:${Math.floor(ms / 1000)}:${style}>`;

// ---------- Metin ----------
function fillTemplate(template, { member, user, guild, extra = {} }) {
  const u = user || member?.user;
  const values = {
    '{kullanici}': u ? `<@${u.id}>` : '',
    '{kullanici_adi}': u ? u.username : '',
    '{isim}': member?.displayName || u?.globalName || u?.username || '',
    '{sunucu}': guild?.name || '',
    '{uye_sayisi}': guild?.memberCount ?? '',
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [`{${k}}`, v])),
  };
  return Object.entries(values).reduce((acc, [k, v]) => acc.split(k).join(String(v)), template).replace(/\\n/g, '\n');
}

const truncate = (str, max = 1024) => (str && str.length > max ? `${str.slice(0, max - 1)}…` : str || '');
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function parseColor(input, fallback = config.colors.brand) {
  if (!input) return fallback;
  const named = {
    turuncu: 0xdf8e4e, kirmizi: 0xed4245, yesil: 0x57f287, mavi: 0x5865f2, sari: 0xfee75c,
    mor: 0x9b59b6, pembe: 0xeb459e, siyah: 0x23272a, beyaz: 0xffffff, gri: 0x99aab5,
  };
  const key = input.toLowerCase().replace(/ı/g, 'i').replace(/ş/g, 's');
  if (named[key] !== undefined) return named[key];
  const hex = input.replace('#', '');
  return /^[0-9a-f]{6}$/i.test(hex) ? parseInt(hex, 16) : fallback;
}

const isUrl = (s) => /^https?:\/\/\S+$/i.test(s || '');

module.exports = {
  isOwner, checkHierarchy, isStaff,
  parseDuration, formatDuration, parseWhen, ts,
  fillTemplate, truncate, pick, randInt, parseColor, isUrl,
};
