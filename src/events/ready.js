const { Events, ActivityType } = require('discord.js');
const config = require('../config');
const db = require('../lib/db');
const scheduler = require('../lib/scheduler');
const tiktok = require('../lib/tiktok');
const voice = require('../lib/voice');
const { leaveIfForeign } = require('./guilds');
const { setBotAvatar } = require('../lib/embeds');
const { deployCommands } = require('../deploy');

const ACTIVITY_TYPES = {
  oynuyor: ActivityType.Playing,
  izliyor: ActivityType.Watching,
  dinliyor: ActivityType.Listening,
  yarisiyor: ActivityType.Competing,
  ozel: ActivityType.Custom,
};

function applyPresence(client) {
  const p = db.data.meta.presence;
  if (p) {
    client.user.setPresence({
      status: p.status || 'online',
      activities: p.text ? [{ name: p.text, type: ACTIVITY_TYPES[p.type] ?? ActivityType.Custom, state: p.type === 'ozel' ? p.text : undefined }] : [],
    });
  } else {
    client.user.setPresence({ activities: [{ name: 'custom', type: ActivityType.Custom, state: '🥐 /yardim • Boyoz Sistem' }] });
  }
}

module.exports = {
  name: Events.ClientReady,
  once: true,
  ACTIVITY_TYPES,
  applyPresence,
  async execute(client) {
    console.log(`🥐 ${client.user.tag} olarak giriş yapıldı • ${client.guilds.cache.size} sunucu • ${client.commands.size} komut`);
    // Bot sadece GUILD_ID sunucusuna özel: başka sunucudaysa ayrıl
    for (const guild of client.guilds.cache.values()) await leaveIfForeign(guild);
    setBotAvatar(client.user.displayAvatarURL());
    applyPresence(client);

    if (config.autoDeploy) {
      try {
        const r = await deployCommands();
        console.log(`✅ ${r.count} slash komutu yüklendi → ${r.scope}`);
      } catch (err) {
        console.error('❌ Slash komutları yüklenemedi:', err.message);
      }
    }
    scheduler.start(client);
    tiktok.start(client);
    voice.start(client);
  },
};
