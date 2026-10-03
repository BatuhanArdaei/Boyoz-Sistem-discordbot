const fs = require('node:fs');
const path = require('node:path');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config');
const { loadCommands } = require('./lib/registry');

if (!config.token) {
  console.error('❌ DISCORD_TOKEN bulunamadı. Proje kökünde .env.local dosyası oluşturup token\'ı girin (.env.example\'a bakın).');
  process.exit(1);
}
if (!config.ownerIds.length) {
  console.warn('⚠️  OWNER_IDS boş. Özel komutları (/yaz vb.) kimse kullanamayacak.');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // ayrıcalıklı intent: Developer Portal'da açılmalı
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // ayrıcalıklı intent: Developer Portal'da açılmalı
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildInvites,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User],
  allowedMentions: { parse: ['users'], repliedUser: false },
});

client.commands = loadCommands();

const eventsDir = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsDir).filter((f) => f.endsWith('.js'))) {
  const exported = require(path.join(eventsDir, file));
  for (const event of Array.isArray(exported) ? exported : [exported]) {
    const run = (...args) => Promise.resolve(event.execute(...args, client)).catch((err) => {
      console.error(`[event:${event.name}] Hata:`, err);
    });
    if (event.once) client.once(event.name, run);
    else client.on(event.name, run);
  }
}

process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));

client.login(config.token).catch((err) => {
  console.error('❌ Giriş yapılamadı:', err.message);
  if (/disallowed intents/i.test(err.message)) {
    console.error('👉 Developer Portal > Bot sekmesinde "SERVER MEMBERS INTENT" ve "MESSAGE CONTENT INTENT" açık olmalı.');
  }
  process.exit(1);
});
