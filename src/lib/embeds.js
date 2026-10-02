const { EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const { colors, assets } = require('../config');

let botAvatar = null;
const setBotAvatar = (url) => { botAvatar = url; };

function base(color = colors.brand) {
  return new EmbedBuilder()
    .setColor(color)
    .setFooter({ text: 'Boyoz Sistem', iconURL: botAvatar || undefined })
    .setTimestamp();
}

const ok = (description, title) => base(colors.success).setDescription(`✅ ${description}`).setTitle(title || null);
const fail = (description, title) => base(colors.error).setDescription(`❌ ${description}`).setTitle(title || null);
const warn = (description, title) => base(colors.warning).setDescription(`⚠️ ${description}`).setTitle(title || null);
const info = (description, title) => base(colors.brand).setDescription(description).setTitle(title || null);

// Görsel ekleri (her kullanımda yeni AttachmentBuilder gerekir)
const files = {
  banner: () => new AttachmentBuilder(assets.banner, { name: 'boyoz-banner.jpg' }),
  logo: () => new AttachmentBuilder(assets.logo, { name: 'boyoz-logo.png' }),
  boyoz: () => new AttachmentBuilder(assets.boyoz, { name: 'boyoz.jpg' }),
};
const urls = {
  banner: 'attachment://boyoz-banner.jpg',
  logo: 'attachment://boyoz-logo.png',
  boyoz: 'attachment://boyoz.jpg',
};

// Etkileşime güvenli şekilde (zaten yanıtlandıysa followUp) gizli yanıt verir.
async function reply(interaction, embed, { ephemeral = true, components = [], files: attach = [] } = {}) {
  const payload = { embeds: [embed], components, files: attach };
  if (ephemeral) payload.flags = MessageFlags.Ephemeral;
  if (interaction.deferred || interaction.replied) {
    if (interaction.deferred && !interaction.replied) return interaction.editReply(payload);
    return interaction.followUp(payload);
  }
  return interaction.reply(payload);
}

const replyOk = (i, text, opts) => reply(i, ok(text), opts);
const replyFail = (i, text, opts) => reply(i, fail(text), opts);

module.exports = { base, ok, fail, warn, info, files, urls, reply, replyOk, replyFail, setBotAvatar };
