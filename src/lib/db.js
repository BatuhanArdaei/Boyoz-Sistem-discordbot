// Basit, bağımlılıksız JSON veritabanı.
// Veriler bellekte tutulur, değişiklikten sonra db.save() çağrılır ve 1 sn içinde diske atomik olarak yazılır.
const fs = require('node:fs');
const path = require('node:path');
const { dataFile } = require('../config');

const DEFAULT_BADWORDS = [
  'amk', 'aq', 'amq', 'amına*', 'amina*', 'aminakoyim', 'orospu*', 'piç', 'pic', 'piçlik',
  'siktir*', 'sikerim', 'sikeyim', 'sikik', 'yarrak*', 'yarak*', 'ananı', 'anani', 'ananızı',
  'pezevenk*', 'kahpe*', 'yavşak*', 'yavsak*', 'ibne*', 'oç', 'göt', 'götveren', 'gotveren',
  'gavat*', 'kaltak*', 'şerefsiz*', 'serefsiz*', 'dalyarak*', 'salak', 'gerizekalı', 'gerizekali',
];

const guildDefaults = () => ({
  logs: { mesaj: null, uye: null, ses: null, sunucu: null, moderasyon: null },
  welcome: {
    enabled: false,
    channel: null,
    message: '{kullanici} aramıza hoş geldin! 🥐 Seninle birlikte **{uye_sayisi}** kişiyiz.',
    card: true,
    dm: false,
    dmMessage: '**{sunucu}** sunucusuna hoş geldin! Kuralları okumayı unutma. 🥐',
  },
  goodbye: {
    enabled: false,
    channel: null,
    message: '**{kullanici_adi}** aramızdan ayrıldı. Artık **{uye_sayisi}** kişiyiz. 👋',
  },
  autorole: { human: [], bot: [] },
  automod: {
    enabled: false,
    invites: false,
    links: false,
    badwords: false,
    caps: false,
    spam: false,
    mentionLimit: 0,
    words: [...DEFAULT_BADWORDS],
    allowedLinks: ['tenor.com', 'giphy.com', 'youtube.com', 'youtu.be'],
    action: 'sil', // sil | uyar | sustur
    muteMinutes: 5,
    exemptRoles: [],
    exemptChannels: [],
  },
  autoresponses: [],
  levels: {
    enabled: false,
    channel: null,
    message: '🎉 Tebrikler {kullanici}, **{seviye}**. seviyeye ulaştın!',
    rewards: [],
    users: {},
  },
  announce: { channel: null, schedules: [] },
  polls: {},
  tempbans: [],
  cases: [],
  caseCount: 0,
  warnings: {},
  economy: {},
  rolemenus: {},
  tiktok: { accounts: [] },
  channelGames: {
    sayma: { channelId: null, current: 0, lastUser: null, record: 0 },
    kelime: { channelId: null, lastWord: null, lastUser: null, used: [], count: 0, record: 0 },
  },
  social: {},
  voice: { channelId: null },
});

const rootDefaults = () => ({ guilds: {}, reminders: [], meta: { owners: [], presence: null, scheduleCounter: 0 } });

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

// Eksik anahtarları varsayılanlarla doldurur (mevcut değerlere dokunmaz).
function fillDefaults(target, defaults) {
  for (const [key, value] of Object.entries(defaults)) {
    if (!(key in target)) target[key] = value;
    else if (isPlainObject(value) && isPlainObject(target[key]) && Object.keys(value).length) {
      fillDefaults(target[key], value);
    }
  }
  return target;
}

function load() {
  try {
    return fillDefaults(JSON.parse(fs.readFileSync(dataFile, 'utf8')), rootDefaults());
  } catch (err) {
    if (err.code !== 'ENOENT') {
      const backup = `${dataFile}.bozuk-${Date.now()}`;
      try { fs.copyFileSync(dataFile, backup); } catch { /* yok say */ }
      console.error(`[db] Veritabanı okunamadı, yedeği ${backup} olarak alındı:`, err.message);
    }
    return rootDefaults();
  }
}

const data = load();
const hydrated = new Set();
let timer = null;

function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  const tmp = `${dataFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, dataFile);
}

function save() {
  if (!timer) timer = setTimeout(flush, 1000);
}

function guild(id) {
  if (!data.guilds[id]) data.guilds[id] = guildDefaults();
  else if (!hydrated.has(id)) fillDefaults(data.guilds[id], guildDefaults());
  hydrated.add(id);
  return data.guilds[id];
}

process.on('exit', () => { if (timer) flush(); });
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { if (timer) flush(); process.exit(0); });
}

module.exports = { data, guild, save, flush, DEFAULT_BADWORDS };
