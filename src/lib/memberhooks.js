// Üye katılınca çalışan sistemler: jail kaçağı yakalama ve kayıt sistemi (kayıtsız / şüpheli hesap).
// true dönerse normal otorol verilmez.
const db = require('./db');
const { base } = require('./embeds');
const { ts } = require('./util');

async function onJoin(member) {
  if (member.user.bot) return false;
  const g = db.guild(member.guild.id);

  // Jail'den çıkıp girerek kaçmaya çalışanlar
  const jailed = g.jail.users[member.id];
  if (jailed && (!jailed.until || jailed.until > Date.now()) && g.jail.roleId) {
    await member.roles.add(g.jail.roleId, 'Jail cezası devam ediyor').catch(() => {});
    return true;
  }

  const k = g.kayit;
  if (!k.enabled) return false;
  const age = Date.now() - member.user.createdTimestamp;
  const suspicious = k.suspiciousRoleId && age < k.suspiciousDays * 864e5;
  const role = suspicious ? k.suspiciousRoleId : k.unregRoleId;
  if (role) await member.roles.add(role, suspicious ? 'Şüpheli (yeni) hesap' : 'Kayıtsız').catch(() => {});
  if (member.manageable) await member.setNickname(suspicious ? 'Şüpheli Hesap' : 'Kayıtsız').catch(() => {});

  const channel = k.channelId && member.guild.channels.cache.get(k.channelId);
  if (channel?.isTextBased()) {
    const embed = base(suspicious ? 0xed4245 : 0xdf8e4e)
      .setTitle(suspicious ? '⚠️ Şüpheli hesap katıldı' : '👋 Yeni üye kayıt bekliyor')
      .setThumbnail(member.user.displayAvatarURL())
      .setDescription(`${member} sunucumuza katıldı! Seninle birlikte **${member.guild.memberCount}** kişiyiz. 🥐\n\n`
        + `📅 Hesap oluşturma: ${ts(member.user.createdTimestamp)} (${ts(member.user.createdTimestamp, 'R')})\n`
        + (suspicious
          ? `🔒 Hesap **${k.suspiciousDays} günden yeni** olduğu için şüpheli olarak işaretlendi.`
          : 'Ses teyit kanalına geçip yetkililerimizi bekleyebilirsin, kısa sürede kaydın yapılacak.'));
    await channel.send({
      content: `${member}${k.staffRoleId ? ` <@&${k.staffRoleId}>` : ''}`,
      embeds: [embed],
      allowedMentions: { users: [member.id], roles: k.staffRoleId ? [k.staffRoleId] : [] },
    }).catch(() => {});
  }
  return true;
}

module.exports = { onJoin };
