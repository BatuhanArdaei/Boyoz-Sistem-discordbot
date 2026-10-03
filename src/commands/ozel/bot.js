// /bot: Botu Discord'dan yönetme paneli (durum, güncelleme, loglar, bakım, komut kapatma, kara liste).
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const {
  SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags, AttachmentBuilder,
} = require('discord.js');
const config = require('../../config');
const db = require('../../lib/db');
const { base, replyOk, replyFail, reply } = require('../../lib/embeds');
const { formatDuration, truncate } = require('../../lib/util');
const { colors } = require('../../config');

const underPm2 = () => process.env.pm_id !== undefined;
const TOKEN_RE = /[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}/g;

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd: config.root, timeout: 180000, shell: process.platform === 'win32' }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: `${stdout || ''}${stderr || ''}`.trim() });
    });
  });
}

function tail(file, lines) {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').slice(-lines).join('\n').replace(TOKEN_RE, '[TOKEN GİZLENDİ]');
  } catch {
    return null;
  }
}

const meta = () => db.data.meta;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bot')
    .setDescription('👑 Bot kontrol paneli: durum, güncelleme, bakım, komut kapatma, kara liste.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName('durum').setDescription('Botun ve sunucunun sağlık durumu'))
    .addSubcommand((s) => s.setName('guncelle').setDescription('GitHub\'daki son sürümü çeker ve botu yeniden başlatır'))
    .addSubcommand((s) => s.setName('yeniden-baslat').setDescription('Botu yeniden başlatır (takıldıysa ilk çare)'))
    .addSubcommand((s) => s.setName('sunucu-reboot').setDescription('⚠️ Oracle sunucusunu komple yeniden başlatır (bot 1-3 dk sonra geri gelir)'))
    .addSubcommand((s) => s.setName('komutlari-yenile').setDescription('Slash komutlarını Discord’a yeniden yükler (kaybolduysa)'))
    .addSubcommand((s) => s.setName('ses-yenile').setDescription('Ses kanalı bağlantısını sıfırlayıp yeniden bağlanır'))
    .addSubcommand((s) => s.setName('yedek').setDescription('Tüm veritabanını sana DM’den dosya olarak gönderir'))
    .addSubcommand((s) => s.setName('loglar').setDescription('Son log kayıtlarını gösterir')
      .addStringOption((o) => o.setName('tur').setDescription('Hangi log?').addChoices({ name: 'Hatalar', value: 'hata' }, { name: 'Normal çıktı', value: 'cikti' }))
      .addIntegerOption((o) => o.setName('satir').setDescription('Kaç satır? (varsayılan 40)').setMinValue(5).setMaxValue(500)))
    .addSubcommand((s) => s.setName('bakim').setDescription('Bakım modu: açıkken botu sadece yetkililer kullanabilir')
      .addBooleanOption((o) => o.setName('aktif').setDescription('Açık/kapalı').setRequired(true)))
    .addSubcommand((s) => s.setName('komut').setDescription('Bir komutu herkese kapatır/açar')
      .addStringOption((o) => o.setName('islem').setDescription('İşlem').setRequired(true).addChoices({ name: 'Kapat', value: 'kapat' }, { name: 'Aç', value: 'ac' }, { name: 'Kapalıları listele', value: 'liste' }))
      .addStringOption((o) => o.setName('isim').setDescription('Komut adı').setAutocomplete(true)))
    .addSubcommand((s) => s.setName('kara-liste').setDescription('Kullanıcının botu kullanmasını engeller/açar')
      .addStringOption((o) => o.setName('islem').setDescription('İşlem').setRequired(true).addChoices({ name: 'Ekle', value: 'ekle' }, { name: 'Çıkar', value: 'cikar' }, { name: 'Listele', value: 'liste' }))
      .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı'))),

  async autocomplete(interaction, client) {
    const q = interaction.options.getFocused().toLowerCase();
    const names = [...client.commands.keys()].filter((n) => n.includes(q) && !['bot', 'yetkili'].includes(n)).sort();
    await interaction.respond(names.slice(0, 25).map((n) => ({ name: `/${n}`, value: n })));
  },

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'durum') {
      const mem = process.memoryUsage().rss / 1048576;
      const total = os.totalmem() / 1048576; const free = os.freemem() / 1048576;
      let disk = '—';
      try {
        const st = fs.statfsSync(config.root);
        disk = `${((st.blocks - st.bavail) * st.bsize / 1073741824).toFixed(1)} / ${(st.blocks * st.bsize / 1073741824).toFixed(1)} GB`;
      } catch { /* desteklenmiyor */ }
      const commit = (await run('git', ['log', '-1', '--format=%h %s'])).out.split('\n')[0] || '—';
      let dbSize = '—';
      try { dbSize = `${(fs.statSync(config.dataFile).size / 1024).toFixed(1)} KB`; } catch { /* yok */ }
      const m = meta();
      return reply(interaction, base().setTitle('🖥️ Bot Durumu').addFields(
        { name: '⏱️ Çalışma süresi', value: formatDuration(client.uptime), inline: true },
        { name: '📶 Gecikme', value: `${Math.max(client.ws.ping, 0)} ms`, inline: true },
        { name: '💾 Bot belleği', value: `${mem.toFixed(0)} MB`, inline: true },
        { name: '🧠 Sunucu RAM', value: `${(total - free).toFixed(0)} / ${total.toFixed(0)} MB`, inline: true },
        { name: '⚙️ CPU yükü', value: os.loadavg().map((l) => l.toFixed(2)).join(' / '), inline: true },
        { name: '💽 Disk', value: disk, inline: true },
        { name: '🗄️ Veritabanı', value: dbSize, inline: true },
        { name: '⌨️ Komut', value: String(client.commands.size), inline: true },
        { name: '🟢 Node', value: process.version, inline: true },
        { name: '🛠️ Bakım modu', value: m.maintenance ? 'Açık' : 'Kapalı', inline: true },
        { name: '🚫 Kapalı komut', value: String(m.disabledCommands.length), inline: true },
        { name: '⛔ Kara liste', value: String(m.blacklist.length), inline: true },
        { name: '📦 Sürüm', value: `\`${truncate(commit, 200)}\`` },
      ));
    }

    if (sub === 'guncelle' || sub === 'yeniden-baslat') {
      if (!underPm2()) return replyFail(interaction, 'Bot PM2 altında çalışmıyor; kapanırsa kendiliğinden açılmaz. Bu komut sadece sunucuda kullanılabilir.');
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (sub === 'guncelle') {
        const pull = await run('git', ['pull', '--ff-only']);
        if (!pull.ok) return interaction.editReply(`❌ Güncelleme çekilemedi:\n\`\`\`${truncate(pull.out, 1800)}\`\`\``);
        if (/Already up to date|Zaten güncel/i.test(pull.out)) return interaction.editReply('✅ Bot zaten en güncel sürümde, yeniden başlatmaya gerek yok.');
        const npm = await run('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund']);
        if (!npm.ok) return interaction.editReply(`❌ Paketler kurulamadı, bot eski sürümle çalışmaya devam ediyor:\n\`\`\`${truncate(npm.out, 1800)}\`\`\``);
        await interaction.editReply(`✅ Güncellendi! Yeniden başlatıyorum, ~10 saniye sonra hazırım.\n\`\`\`${truncate(pull.out, 1500)}\`\`\``);
      } else {
        await interaction.editReply('🔄 Yeniden başlatılıyor, ~10 saniye sonra hazırım.');
      }
      db.flush();
      setTimeout(() => process.exit(0), 1500); // PM2 otomatik tekrar başlatır
      return;
    }

    if (sub === 'sunucu-reboot') {
      if (!underPm2() || process.platform !== 'linux') return replyFail(interaction, 'Bu komut sadece Linux sunucuda çalışır.');
      await interaction.reply({ content: '♻️ Sunucu yeniden başlatılıyor... Bot 1-3 dakika içinde geri gelecek.', flags: MessageFlags.Ephemeral });
      db.flush();
      setTimeout(() => execFile('sudo', ['reboot'], () => {}), 2000);
      return;
    }

    if (sub === 'komutlari-yenile') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const r = await require('../../deploy').deployCommands();
        return interaction.editReply(`✅ ${r.count} komut yeniden yüklendi → ${r.scope}`);
      } catch (err) {
        return interaction.editReply(`❌ Yüklenemedi: ${truncate(err.message, 1500)}`);
      }
    }

    if (sub === 'ses-yenile') {
      const voice = require('../../lib/voice');
      const channelId = db.guild(interaction.guild.id).voice.channelId;
      if (!channelId) return replyFail(interaction, 'Ayarlı bir ses kanalı yok (/ses-kanali ayarla).');
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      voice.leave(interaction.guild.id);
      await new Promise((r) => setTimeout(r, 1500));
      try { await voice.join(interaction.guild, channelId); return interaction.editReply(`✅ <#${channelId}> kanalına yeniden bağlandım.`); } catch (err) { return interaction.editReply(`❌ ${err.message}`); }
    }

    if (sub === 'yedek') {
      db.flush();
      const file = new AttachmentBuilder(fs.readFileSync(config.dataFile), { name: `boyoz-yedek-${new Date().toISOString().slice(0, 10)}.json` });
      const sent = await interaction.user.send({ content: '🗄️ Boyoz Sistem veritabanı yedeği. Güvenli bir yerde sakla!', files: [file] }).then(() => true).catch(() => false);
      return sent ? replyOk(interaction, 'Yedek DM’den gönderildi.') : replyFail(interaction, 'DM’lerin kapalı, yedek gönderilemedi.');
    }

    if (sub === 'loglar') {
      const type = interaction.options.getString('tur') || 'hata';
      const lines = interaction.options.getInteger('satir') || 40;
      const file = type === 'hata' ? process.env.pm_err_log_path : process.env.pm_out_log_path;
      if (!file) return replyFail(interaction, 'Log dosyası bulunamadı (bot PM2 altında çalışmıyor).');
      const text = tail(file, lines);
      if (!text?.trim()) return replyOk(interaction, 'Log boş. 🎉');
      if (text.length < 1900) return interaction.reply({ content: `\`\`\`\n${text}\n\`\`\``, flags: MessageFlags.Ephemeral });
      return interaction.reply({ content: `📄 Son ${lines} satır:`, files: [new AttachmentBuilder(Buffer.from(text, 'utf8'), { name: `${type}-log.txt` })], flags: MessageFlags.Ephemeral });
    }

    if (sub === 'bakim') {
      meta().maintenance = interaction.options.getBoolean('aktif');
      db.save();
      return replyOk(interaction, meta().maintenance ? '🛠️ Bakım modu **açık**. Botu sadece yetkililer kullanabilir.' : '✅ Bakım modu kapatıldı, herkes botu kullanabilir.');
    }

    if (sub === 'komut') {
      const op = interaction.options.getString('islem');
      const list = meta().disabledCommands;
      if (op === 'liste') return reply(interaction, base(colors.warning).setTitle('🚫 Kapalı Komutlar').setDescription(list.map((n) => `\`/${n}\``).join(' ') || 'Kapalı komut yok.'));
      const name = interaction.options.getString('isim')?.replace(/^\//, '');
      if (!name || !client.commands.has(name)) return replyFail(interaction, 'Geçerli bir komut adı seç.');
      if (['bot', 'yetkili'].includes(name)) return replyFail(interaction, 'Bu komut kapatılamaz.');
      if (op === 'kapat') { if (!list.includes(name)) list.push(name); } else meta().disabledCommands = list.filter((n) => n !== name);
      db.save();
      return replyOk(interaction, `\`/${name}\` ${op === 'kapat' ? 'herkese kapatıldı (yetkililer kullanabilir)' : 'tekrar açıldı'}.`);
    }

    // kara-liste
    const op = interaction.options.getString('islem');
    const bl = meta().blacklist;
    if (op === 'liste') return reply(interaction, base(colors.error).setTitle('⛔ Kara Liste').setDescription(bl.map((id) => `<@${id}> \`${id}\``).join('\n') || 'Kara liste boş.'));
    const user = interaction.options.getUser('kullanici');
    if (!user) return replyFail(interaction, 'Bir kullanıcı seç.');
    if (op === 'ekle') {
      if (config.ownerIds.includes(user.id) || db.data.meta.owners.includes(user.id)) return replyFail(interaction, 'Bot yetkilileri kara listeye alınamaz.');
      if (!bl.includes(user.id)) bl.push(user.id);
    } else meta().blacklist = bl.filter((id) => id !== user.id);
    db.save();
    return replyOk(interaction, `${user} ${op === 'ekle' ? 'kara listeye alındı, artık botu kullanamaz' : 'kara listeden çıkarıldı'}.`);
  },
};
