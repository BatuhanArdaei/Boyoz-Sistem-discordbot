// Zamanlanmış işler: duyurular, anket bitişleri, süreli banlar, hatırlatıcılar.
const db = require('./db');
const { sendAnnouncement } = require('./announce');
const { endPoll } = require('./polls');
const { createCase } = require('./modcase');
const { base } = require('./embeds');

const INTERVAL = 15000;
let running = false;

async function tick(client) {
  if (running) return;
  running = true;
  const now = Date.now();
  try {
    for (const [guildId, g] of Object.entries(db.data.guilds)) {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;

      // Zamanlanmış duyurular
      const due = (g.announce?.schedules || []).filter((s) => s.at <= now);
      if (due.length) {
        g.announce.schedules = g.announce.schedules.filter((s) => s.at > now);
        db.save();
        for (const s of due) {
          await sendAnnouncement(guild, s).catch((err) => console.warn(`[zamanlayıcı] Duyuru #${s.id} gönderilemedi:`, err.message));
          if (s.repeat) {
            let next = s.at + s.repeat;
            while (next <= now) next += s.repeat;
            g.announce.schedules.push({ ...s, at: next });
            db.save();
          }
        }
      }

      // Anketler
      for (const [messageId, poll] of Object.entries(g.polls || {})) {
        if (!poll.ended && poll.endsAt && poll.endsAt <= now) await endPoll(client, guildId, messageId);
      }

      // Süreli roller
      const roleDue = (g.tempRoles || []).filter((t) => t.until <= now);
      if (roleDue.length) {
        g.tempRoles = g.tempRoles.filter((t) => t.until > now);
        db.save();
        for (const t of roleDue) {
          const m = await guild.members.fetch(t.userId).catch(() => null);
          await m?.roles.remove(t.roleId, 'Süreli rolün süresi doldu').catch(() => {});
        }
      }

      // Süreli jail
      for (const [userId, j] of Object.entries(g.jail?.users || {})) {
        if (j.until && j.until <= now) await require('../commands/moderasyon/ekstra').release(guild, userId, client.user.id, 'Jail süresi doldu (otomatik)');
      }

      // Çekilişler
      for (const [messageId, gw] of Object.entries(g.giveaways || {})) {
        if (!gw.ended && gw.endsAt <= now) await require('./giveaways').end(client, guildId, messageId).catch((e) => console.warn('[çekiliş]', e.message));
      }

      // Süreli banlar
      const expired = (g.tempbans || []).filter((b) => b.until <= now);
      if (expired.length) {
        g.tempbans = g.tempbans.filter((b) => b.until > now);
        db.save();
        for (const b of expired) {
          const ok = await guild.members.unban(b.userId, 'Süreli yasak sona erdi').then(() => true).catch(() => false);
          if (ok) await createCase(guild, { type: 'unban', targetId: b.userId, modId: client.user.id, reason: 'Süreli yasak sona erdi (otomatik)' });
        }
      }
    }

    // Hatırlatıcılar
    const reminders = db.data.reminders.filter((r) => r.at <= now);
    if (reminders.length) {
      db.data.reminders = db.data.reminders.filter((r) => r.at > now);
      db.save();
      for (const r of reminders) {
        const embed = base().setTitle('⏰ Hatırlatma').setDescription(r.text).addFields({ name: 'Oluşturulma', value: `<t:${Math.floor(r.createdAt / 1000)}:R>` });
        const channel = r.channelId ? await client.channels.fetch(r.channelId).catch(() => null) : null;
        const sent = channel
          ? await channel.send({ content: `<@${r.userId}>`, embeds: [embed], allowedMentions: { users: [r.userId] } }).then(() => true).catch(() => false)
          : false;
        if (!sent) {
          const user = await client.users.fetch(r.userId).catch(() => null);
          await user?.send({ embeds: [embed] }).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error('[zamanlayıcı] Hata:', err);
  } finally {
    running = false;
  }
}

function start(client) {
  tick(client);
  setInterval(() => tick(client), INTERVAL);
}

module.exports = { start };
