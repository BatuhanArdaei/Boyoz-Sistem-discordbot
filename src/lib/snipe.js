// Kanallarda son silinen mesajları bellekte tutar (/snipe için). Diske yazılmaz.
const store = new Map(); // kanalId -> [{...}]
const MAX = 10;

function add(message) {
  if (!message.guild || message.author?.bot || (!message.content && !message.attachments?.size)) return;
  const list = store.get(message.channel.id) || [];
  list.unshift({
    tag: message.author?.tag || 'Bilinmiyor',
    avatar: message.author?.displayAvatarURL(),
    content: message.content,
    image: message.attachments?.find((a) => a.contentType?.startsWith('image/'))?.proxyURL || null,
    at: Date.now(),
  });
  store.set(message.channel.id, list.slice(0, MAX));
}

const get = (channelId) => (store.get(channelId) || []).filter((m) => Date.now() - m.at < 6 * 36e5);

module.exports = { add, get };
