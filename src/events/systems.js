// Guard (koruma) ve Boyozboard tepki olayları.
const { Events } = require('discord.js');
const guard = require('../lib/guard');
const community = require('../lib/community');

const safe = (fn) => (...args) => fn(...args).catch((err) => console.warn('[guard]', err.message));

module.exports = [
  { name: Events.ChannelDelete, execute: safe(guard.onChannelDelete) },
  { name: Events.GuildRoleDelete, execute: safe(guard.onRoleDelete) },
  { name: Events.GuildRoleUpdate, execute: safe(guard.onRoleUpdate) },
  { name: Events.GuildBanAdd, execute: safe(guard.onBan) },
  { name: Events.WebhooksUpdate, execute: safe(guard.onWebhooks) },
  { name: Events.GuildUpdate, execute: safe(guard.onGuildUpdate) },
  { name: Events.MessageReactionAdd, execute: (reaction) => community.onReaction(reaction).catch(() => {}) },
  { name: Events.MessageReactionRemove, execute: (reaction) => community.onReaction(reaction).catch(() => {}) },
];
