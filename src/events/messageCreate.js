// Gelen mesajlar: automod -> otomatik cevap -> seviye sistemi
const { Events } = require('discord.js');
const db = require('../lib/db');
const automod = require('../lib/automod');
const levels = require('../lib/levels');
const { fillTemplate } = require('../lib/util');

const autoresponseCooldown = new Map();

async function autoresponse(message) {
  const list = db.guild(message.guild.id).autoresponses;
  if (!list.length) return;
  const content = message.content.toLocaleLowerCase('tr').trim();
  const hit = list.find((a) => {
    const trigger = a.trigger.toLocaleLowerCase('tr');
    if (a.match === 'tam') return content === trigger;
    if (a.match === 'baslar') return content.startsWith(trigger);
    return content.includes(trigger);
  });
  if (!hit) return;
  const key = `${message.channel.id}:${hit.trigger}`;
  if (Date.now() - (autoresponseCooldown.get(key) || 0) < 5000) return;
  autoresponseCooldown.set(key, Date.now());
  const text = fillTemplate(hit.response, { member: message.member, user: message.author, guild: message.guild });
  if (hit.react) await message.react(hit.react).catch(() => {});
  if (text) await message.reply({ content: text, allowedMentions: { users: [message.author.id], repliedUser: false } }).catch(() => {});
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (!message.guild || message.author.bot || message.webhookId) return;
    if (await automod.handle(message)) return;
    await autoresponse(message);
    await levels.handle(message);
  },
};
