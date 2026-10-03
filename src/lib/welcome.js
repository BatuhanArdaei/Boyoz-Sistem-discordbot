// Karşılama ve veda mesajlarını hazırlar (event'ler ve test komutları ortak kullanır).
const db = require('./db');
const { base, files, urls } = require('./embeds');
const { welcomeCard } = require('./card');
const { fillTemplate } = require('./util');
const { colors } = require('../config');

// Karşılama mesajını hazırlar (test komutu da kullanır)
async function buildWelcome(member) {
  const cfg = db.guild(member.guild.id).welcome;
  const text = fillTemplate(cfg.message, { member, guild: member.guild });
  const embed = base().setDescription(text).setAuthor({ name: `${member.guild.name} • Hoş geldin!`, iconURL: member.guild.iconURL() || undefined });
  const payload = { content: `${member}`, embeds: [embed], files: [], allowedMentions: { users: [member.id] } };
  const card = cfg.card ? await welcomeCard(member).catch((err) => { console.warn('[kart]', err.message); return null; }) : null;
  if (card) {
    embed.setImage('attachment://hosgeldin.png');
    payload.files.push(card);
  } else {
    embed.setThumbnail(member.user.displayAvatarURL()).setImage(urls.banner);
    payload.files.push(files.banner());
  }
  return payload;
}

function buildGoodbye(member) {
  const cfg = db.guild(member.guild.id).goodbye;
  const text = fillTemplate(cfg.message, { member, user: member.user, guild: member.guild });
  return { embeds: [base(colors.dark).setDescription(text).setThumbnail(member.user.displayAvatarURL())], allowedMentions: { parse: [] } };
}

module.exports = { buildWelcome, buildGoodbye };
