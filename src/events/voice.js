// Ses olayları: kilitli kanallar, AFK kaldırma, ses istatistiği, özel odalar.
const { Events } = require('discord.js');
const afk = require('../lib/afk');
const stats = require('../lib/stats');
const rooms = require('../lib/rooms');
const voicelock = require('../lib/voicelock');

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    await voicelock.onVoice(oldState, newState).catch((err) => console.warn('[ses kilidi]', err.message));
    stats.onVoice(oldState, newState);
    await rooms.onVoice(oldState, newState).catch((err) => console.warn('[özel oda]', err.message));
    await afk.handleVoice(oldState, newState);
  },
};
