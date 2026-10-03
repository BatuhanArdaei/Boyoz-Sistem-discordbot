// Botun belirli bir ses kanalında sürekli durması. Bağlantı koparsa veya bot kanaldan atılırsa geri döner.
const {
  joinVoiceChannel, getVoiceConnection, entersState, VoiceConnectionStatus,
} = require('@discordjs/voice');
const db = require('./db');

const WATCH_INTERVAL = 60 * 1000;

async function join(guild, channelId) {
  const channel = guild.channels.cache.get(channelId);
  if (!channel?.isVoiceBased()) throw new Error('Ses kanalı bulunamadı.');
  if (!channel.joinable) throw new Error(`${channel.name} kanalına bağlanma iznim yok.`);

  const existing = getVoiceConnection(guild.id);
  if (existing && existing.joinConfig.channelId === channelId && existing.state.status !== VoiceConnectionStatus.Destroyed) return existing;
  existing?.destroy();

  const conn = joinVoiceChannel({
    channelId, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator, selfDeaf: true, selfMute: true,
  });
  conn.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      // Kanal değişimi gibi kısa kopmalarda kendiliğinden toparlanır
      await Promise.race([
        entersState(conn, VoiceConnectionStatus.Signalling, 5000),
        entersState(conn, VoiceConnectionStatus.Connecting, 5000),
      ]);
    } catch {
      conn.destroy(); // gözetleyici bir sonraki turda yeniden bağlanır
    }
  });
  conn.on('error', (err) => console.warn('[ses] Bağlantı hatası:', err.message));
  await entersState(conn, VoiceConnectionStatus.Ready, 20000).catch((err) => {
    conn.destroy();
    throw new Error(`Ses kanalına bağlanılamadı: ${err.message}`);
  });
  return conn;
}

function leave(guildId) {
  getVoiceConnection(guildId)?.destroy();
}

async function check(client) {
  for (const [guildId, g] of Object.entries(db.data.guilds)) {
    const channelId = g.voice?.channelId;
    if (!channelId) continue;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;
    const conn = getVoiceConnection(guildId);
    const inChannel = guild.members.me?.voice.channelId === channelId;
    if (conn && conn.state.status !== VoiceConnectionStatus.Destroyed && inChannel) continue;
    try {
      await join(guild, channelId);
    } catch (err) {
      console.warn(`[ses] ${guild.name}: ${err.message}`);
    }
  }
}

function start(client) {
  setTimeout(() => check(client), 5000);
  setInterval(() => check(client), WATCH_INTERVAL);
}

module.exports = { start, join, leave, check };
