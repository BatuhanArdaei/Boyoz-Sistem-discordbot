// Ses olayları: AFK kaldırma, ses istatistiği, özel odalar.
const { Events } = require('discord.js');
const afk = require('../lib/afk');
const stats = require('../lib/stats');
const rooms = require('../lib/rooms');

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    stats.onVoice(oldState, newState);
    await rooms.onVoice(oldState, newState).catch((err) => console.warn('[özel oda]', err.message));
    await afk.handleVoice(oldState, newState);
  },
};
