// Özel oda (join-to-create): "Oda Oluştur" kanalına giren kişiye ait ses odası açılır, boşalınca silinir.
const {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const db = require('./db');
const { base } = require('./embeds');

const cfg = (guildId) => db.guild(guildId).rooms;

function panel(channelId) {
  const b = (id, label, emoji, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(`ozel-oda:${id}:${channelId}`).setLabel(label).setEmoji(emoji).setStyle(style);
  return [
    new ActionRowBuilder().addComponents(
      b('kilit', 'Kilitle / Aç', '🔒'), b('gizle', 'Gizle / Göster', '👁️'), b('limit', 'Kişi Limiti', '👥'), b('isim', 'İsim', '✏️'),
    ),
    new ActionRowBuilder().addComponents(
      b('izin', 'İzin Ver', '✅', ButtonStyle.Success), b('at', 'Odadan At', '👢', ButtonStyle.Danger), b('devral', 'Sahipliği Al', '👑', ButtonStyle.Primary),
    ),
  ];
}

async function create(member, hub) {
  const c = cfg(member.guild.id);
  const name = `🥐 ${member.displayName}`.slice(0, 90);
  const channel = await member.guild.channels.create({
    name, type: ChannelType.GuildVoice, parent: c.categoryId || hub.parentId, bitrate: hub.bitrate,
    permissionOverwrites: [
      ...hub.permissionOverwrites.cache.map((o) => ({ id: o.id, allow: o.allow, deny: o.deny, type: o.type })),
      { id: member.id, allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream] },
      { id: member.guild.members.me.id, allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.SendMessages] },
    ],
  });
  c.active[channel.id] = member.id;
  db.save();
  await member.voice.setChannel(channel).catch(() => {});
  await channel.send({
    content: `${member}`,
    embeds: [base().setTitle('🔊 Özel odan hazır!').setDescription('Bu oda senin. Aşağıdaki butonlarla yönetebilirsin. Oda boşalınca otomatik silinir.')],
    components: panel(channel.id), allowedMentions: { users: [member.id] },
  }).catch(() => {});
}

async function onVoice(oldState, newState) {
  const guild = newState.guild;
  const c = cfg(guild.id);
  if (!c.hubId) return;
  const member = newState.member;
  if (newState.channelId === c.hubId && member && !member.user.bot) {
    const hub = guild.channels.cache.get(c.hubId);
    // Zaten bir odası varsa ona taşı
    const existing = Object.entries(c.active).find(([, owner]) => owner === member.id)?.[0];
    if (existing && guild.channels.cache.has(existing)) await member.voice.setChannel(existing).catch(() => {});
    else if (hub) await create(member, hub);
  }
  // Boşalan özel odayı sil
  const left = oldState.channelId && c.active[oldState.channelId] ? oldState.channel : null;
  if (left && left.members.filter((m) => !m.user.bot).size === 0) {
    delete c.active[left.id];
    db.save();
    await left.delete('Özel oda boşaldı').catch(() => {});
  }
}

// Bot kapalıyken boşalmış odaları temizle
async function cleanup(client) {
  for (const [guildId, g] of Object.entries(db.data.guilds)) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild || !g.rooms?.active) continue;
    for (const id of Object.keys(g.rooms.active)) {
      const ch = guild.channels.cache.get(id);
      if (!ch) delete g.rooms.active[id];
      else if (ch.members.filter((m) => !m.user.bot).size === 0) { delete g.rooms.active[id]; await ch.delete('Özel oda boşaldı').catch(() => {}); }
    }
  }
  db.save();
}

module.exports = { onVoice, cleanup, panel, cfg };
