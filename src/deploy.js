// Slash komutlarını Discord'a yükler.
// Kullanım: npm run deploy            -> GUILD_ID varsa o sunucuya, yoksa global yükler
//           npm run deploy:temizle    -> yüklü tüm komutları (global + GUILD_ID) siler
const { REST, Routes } = require('discord.js');
const config = require('./config');
const { loadCommands } = require('./lib/registry');

async function deployCommands({ clear = false } = {}) {
  if (!config.token) throw new Error('DISCORD_TOKEN bulunamadı. .env.local dosyasını kontrol edin.');
  const rest = new REST().setToken(config.token);
  const app = await rest.get(Routes.currentApplication());

  if (clear) {
    await rest.put(Routes.applicationCommands(app.id), { body: [] });
    if (config.guildId) await rest.put(Routes.applicationGuildCommands(app.id, config.guildId), { body: [] });
    return { count: 0, scope: 'temizlendi', appId: app.id };
  }

  const body = [...loadCommands().values()].map((c) => c.data.toJSON());
  if (config.guildId) {
    await rest.put(Routes.applicationGuildCommands(app.id, config.guildId), { body });
    return { count: body.length, scope: `sunucu (${config.guildId})`, appId: app.id };
  }
  await rest.put(Routes.applicationCommands(app.id), { body });
  return { count: body.length, scope: 'global', appId: app.id };
}

if (require.main === module) {
  const clear = process.argv.includes('--temizle');
  deployCommands({ clear })
    .then((r) => console.log(clear ? '🧹 Tüm komutlar silindi.' : `✅ ${r.count} komut yüklendi → ${r.scope}`))
    .catch((err) => { console.error('❌ Komut yükleme hatası:', err); process.exit(1); });
}

module.exports = { deployCommands };
