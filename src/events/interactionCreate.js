// Tüm slash komut, buton, seçim menüsü, modal ve autocomplete etkileşimlerini yönlendirir.
const { Events } = require('discord.js');
const { isOwner } = require('../lib/util');
const { replyFail } = require('../lib/embeds');
const db = require('../lib/db');

async function safeError(interaction, err, where) {
  console.error(`[${where}] Hata:`, err);
  if (!interaction.isRepliable()) return;
  const text = err?.code === 50013
    ? 'Bu işlem için gerekli iznim yok. Rolümün yetkilerini ve sırasını kontrol et.'
    : 'Komut çalışırken bir hata oluştu. 🥲';
  await replyFail(interaction, text).catch(() => {});
}

// Bakım modu, kara liste ve kapatılmış komutlar (yetkililer her zaman geçer)
function accessBlocked(interaction, cmd) {
  if (isOwner(interaction.user.id)) return null;
  const meta = db.data.meta;
  if (meta.blacklist.includes(interaction.user.id)) return 'Botu kullanman yetkililer tarafından engellendi. 🚫';
  if (meta.maintenance) return '🛠️ Bot şu an **bakımda**. Biraz sonra tekrar dene!';
  if (meta.disabledCommands.includes(cmd.data.name)) return `\`/${cmd.data.name}\` komutu şu an kapalı.`;
  return null;
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    // Slash komutları
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(interaction.commandName);
      if (!cmd) return replyFail(interaction, 'Bu komut artık mevcut değil.');
      if (cmd.ownerOnly && !isOwner(interaction.user.id)) {
        return replyFail(interaction, 'Bu komut yalnızca **Boyoz Sistem yetkilileri** tarafından kullanılabilir. 👑');
      }
      const blocked = accessBlocked(interaction, cmd);
      if (blocked) return replyFail(interaction, blocked);
      if (!interaction.inGuild() && !cmd.dmAllowed) {
        return replyFail(interaction, 'Bu komut sadece sunucularda kullanılabilir.');
      }
      try {
        await cmd.execute(interaction, client);
      } catch (err) {
        await safeError(interaction, err, `/${interaction.commandName}`);
      }
      return;
    }

    if (interaction.isAutocomplete()) {
      const cmd = client.commands.get(interaction.commandName);
      try { await cmd?.autocomplete?.(interaction, client); } catch { /* yok say */ }
      return;
    }

    // Bileşenler: customId = "<komut>:<aksiyon>:<argümanlar...>"
    if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
      const [name, action, ...args] = interaction.customId.split(':');
      const cmd = client.commands.get(name);
      const handler = cmd?.components?.[action];
      if (!handler) return;
      if (cmd.ownerOnly && !isOwner(interaction.user.id)) {
        return replyFail(interaction, 'Bu işlem yalnızca bot yetkililerine açık.');
      }
      const blockedC = accessBlocked(interaction, cmd);
      if (blockedC) return replyFail(interaction, blockedC);
      try {
        await handler(interaction, args, client);
      } catch (err) {
        await safeError(interaction, err, `bileşen ${interaction.customId}`);
      }
    }
  },
};
