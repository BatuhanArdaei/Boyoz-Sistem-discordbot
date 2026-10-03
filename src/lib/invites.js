// Davet takibi: kim kimi getirdi, gerçek / sahte (yeni hesap) / ayrılan / bonus davetler. Gerçek davet boyoz kazandırır.
const { PermissionFlagsBits } = require('discord.js');
const db = require('./db');
const economy = require('./economy');

const cache = new Map(); // guildId -> Map(code -> uses)
const FAKE_AGE = 7 * 864e5;
const REWARD = 50;

async function load(guild) {
  if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild)) return;
  const invites = await guild.invites.fetch().catch(() => null);
  if (!invites) return;
  const map = new Map(invites.map((i) => [i.code, i.uses || 0]));
  if (guild.vanityURLCode) {
    const vanity = await guild.fetchVanityData().catch(() => null);
    if (vanity) map.set('__vanity', vanity.uses);
  }
  cache.set(guild.id, map);
}

const stat = (guildId, userId) => (db.guild(guildId).invites.users[userId] ??= { regular: 0, fake: 0, left: 0, bonus: 0 });
const total = (s) => s.regular + s.bonus - s.left;

// Katılan üyenin hangi davetle geldiğini bulur ve kaydeder. { inviterId, code, vanity, fake } döner.
async function onJoin(member) {
  const before = cache.get(member.guild.id) || new Map();
  await load(member.guild);
  const after = cache.get(member.guild.id) || new Map();
  let used = null;
  for (const [code, uses] of after) {
    if (code !== '__vanity' && uses > (before.get(code) || 0)) { used = code; break; }
  }
  // Tek kullanımlık davetler kullanılınca silinir: önceki listede olup şimdi olmayan
  if (!used) for (const code of before.keys()) if (code !== '__vanity' && !after.has(code)) { used = code; break; }
  const vanity = !used && (after.get('__vanity') || 0) > (before.get('__vanity') || 0);

  const inv = used ? await member.guild.invites.fetch(used).catch(() => null) : null;
  const inviterId = inv?.inviterId || (used && member.guild.invites.cache.get(used)?.inviterId) || null;
  const fake = Date.now() - member.user.createdTimestamp < FAKE_AGE;
  const g = db.guild(member.guild.id).invites;
  g.joins[member.id] = { inviterId, code: used, vanity, fake, at: Date.now() };
  if (inviterId && inviterId !== member.id) {
    const s = stat(member.guild.id, inviterId);
    if (fake) s.fake += 1;
    else {
      s.regular += 1;
      // Aynı kişi tekrar tekrar girip çıkarak boyoz kasılmasın: ilk girişte ödül
      if (!g.joins[member.id].rewarded) { economy.add(member.guild.id, inviterId, REWARD); g.joins[member.id].rewarded = true; }
    }
  }
  db.save();
  return { inviterId, code: used, vanity, fake, total: inviterId ? total(stat(member.guild.id, inviterId)) : 0 };
}

function onLeave(member) {
  const g = db.guild(member.guild.id).invites;
  const j = g.joins[member.id];
  if (!j?.inviterId || j.fake || j.counted === false) return null;
  stat(member.guild.id, j.inviterId).left += 1;
  db.save();
  return j.inviterId;
}

function onInviteCreate(invite) {
  if (!invite.guild) return;
  (cache.get(invite.guild.id) || cache.set(invite.guild.id, new Map()).get(invite.guild.id)).set(invite.code, invite.uses || 0);
}

module.exports = { load, onJoin, onLeave, onInviteCreate, stat, total, REWARD };
