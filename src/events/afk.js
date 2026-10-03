// Seste hareket eden AFK kullanıcıların AFK'sını kaldırır.
const { Events } = require('discord.js');
const afk = require('../lib/afk');

module.exports = {
  name: Events.VoiceStateUpdate,
  execute: (oldState, newState) => afk.handleVoice(oldState, newState),
};
