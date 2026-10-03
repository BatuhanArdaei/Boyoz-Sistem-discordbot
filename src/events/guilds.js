// Bot yalnızca .env.local'daki GUILD_ID sunucusuna özeldir; başka bir sunucuya eklenirse hemen ayrılır.
const { Events } = require('discord.js');
const config = require('../config');

async function leaveIfForeign(guild) {
  if (!config.guildId || guild.id === config.guildId) return false;
  console.warn(`[sunucu] İzinsiz sunucudan ayrılıyorum: ${guild.name} (${guild.id})`);
  await guild.leave().catch((err) => console.error('[sunucu] Ayrılamadım:', err.message));
  return true;
}

module.exports = {
  name: Events.GuildCreate,
  leaveIfForeign,
  execute: (guild) => leaveIfForeign(guild),
};
