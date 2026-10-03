// /boyoz: Sunucuya özel boyoz ekonomisi ve boyoz bilgileri. 🥐
const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const db = require('../../lib/db');
const { base, replyFail, files, urls } = require('../../lib/embeds');
const { pick, randInt, ts } = require('../../lib/util');

const DAY = 864e5;
const WORK_COOLDOWN = 60 * 60000;

const FACTS = [
  'Boyoz, İzmir\'e özgü bir hamur işidir ve kökeni Sefarad Yahudilerine dayanır.',
  'Boyoz hamuru, saatlerce yağda dinlendirilerek kat kat açılır; o çıtırlık buradan gelir.',
  'Klasik İzmir kahvaltısı: boyoz + haşlanmış yumurta + çay. 🥚☕',
  'Boyoz adının Ladino (Yahudi İspanyolcası) "boyo" yani küçük çörek kelimesinden geldiği söylenir.',
  'Boyoz geleneksel olarak taş fırında pişirilir.',
  'Ispanaklı, peynirli, patlıcanlı boyoz da vardır ama sade boyoz bir klasiktir.',
  'İzmir\'de boyoz genelde sabah erken saatlerde taze taze satılır, öğlene kalmaz!',
  'Boyozu gevrekle karıştırma: İzmir\'de simide "gevrek" denir. 😄',
  'Boyoz yumurtanın yanında, çoğu zaman bir bardak tavşan kanı çayla servis edilir.',
];

const WORKS = [
  'Fırında hamur açtın', 'Kordon\'da boyoz sattın', 'Kemeraltı\'nda çay taşıdın', 'Fırıncıya yumurta haşladın',
  'Sabah 5\'te fırını yaktın', 'Boyoz tezgâhını düzenledin', 'Bisikletle boyoz dağıttın', 'Hamura yağ sürdün',
];

const EAT = [
  'Çıtır çıtır! 😋', 'Yanına bir de yumurta iyi giderdi. 🥚', 'Kat kat mutluluk! 🧡', 'Çayın yanında efsane oldu. ☕',
  'Ağzının kenarında kırıntı kaldı… 👀', 'Bir boyoz daha mı? Neden olmasın!',
];

function wallet(guildId, userId) {
  const eco = db.guild(guildId).economy;
  return (eco[userId] ??= { balance: 0, eaten: 0, lastDaily: 0, streak: 0, lastWork: 0 });
}

const fmt = (n) => `**${n.toLocaleString('tr-TR')}** 🥐`;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('boyoz')
    .setDescription('🥐 Boyoz ekonomisi ve boyoz dünyası.')
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName('bilgi').setDescription('Rastgele bir boyoz bilgisi'))
    .addSubcommand((s) => s.setName('gunluk').setDescription('Günlük boyozunu al (seri bonuslu!)'))
    .addSubcommand((s) => s.setName('calis').setDescription('Fırında çalışıp boyoz kazan (saatte bir)'))
    .addSubcommand((s) => s.setName('cuzdan').setDescription('Boyoz cüzdanını gösterir')
      .addUserOption((o) => o.setName('kullanici').setDescription('Kullanıcı')))
    .addSubcommand((s) => s.setName('ye').setDescription('Boyoz ye!')
      .addIntegerOption((o) => o.setName('adet').setDescription('Kaç tane?').setMinValue(1).setMaxValue(100)))
    .addSubcommand((s) => s.setName('ver').setDescription('Birine boyoz hediye et')
      .addUserOption((o) => o.setName('kullanici').setDescription('Kime?').setRequired(true))
      .addIntegerOption((o) => o.setName('miktar').setDescription('Kaç boyoz?').setRequired(true).setMinValue(1)))
    .addSubcommand((s) => s.setName('bahis').setDescription('Yazı-tura bahsi: kazanırsan 2 katı!')
      .addIntegerOption((o) => o.setName('miktar').setDescription('Bahis').setRequired(true).setMinValue(1))
      .addStringOption((o) => o.setName('secim').setDescription('Yazı mı tura mı?').setRequired(true).addChoices({ name: 'Yazı', value: 'yazi' }, { name: 'Tura', value: 'tura' })))
    .addSubcommand((s) => s.setName('siralama').setDescription('En zengin boyozcular')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const gid = interaction.guild.id;
    const me = wallet(gid, interaction.user.id);
    const now = Date.now();

    switch (sub) {
      case 'bilgi':
        return interaction.reply({ embeds: [base().setTitle('🥐 Boyoz Bilgisi').setDescription(pick(FACTS)).setThumbnail(urls.boyoz)], files: [files.boyoz()] });

      case 'gunluk': {
        if (now - me.lastDaily < DAY) {
          return replyFail(interaction, `Günlük boyozunu zaten aldın! Tekrar: ${ts(me.lastDaily + DAY, 'R')}`);
        }
        me.streak = now - me.lastDaily < 2 * DAY ? me.streak + 1 : 1;
        const bonus = Math.min(me.streak - 1, 10) * 10;
        const amount = randInt(50, 100) + bonus;
        me.balance += amount;
        me.lastDaily = now;
        db.save();
        return interaction.reply({ embeds: [base().setTitle('🌅 Günlük Boyoz').setThumbnail(urls.boyoz)
          .setDescription(`Fırından taze çıktı! ${fmt(amount)} kazandın.${bonus ? `\n🔥 **${me.streak} günlük seri** bonusu: +${bonus}` : ''}\n\nCüzdan: ${fmt(me.balance)}`)], files: [files.boyoz()] });
      }

      case 'calis': {
        if (now - me.lastWork < WORK_COOLDOWN) return replyFail(interaction, `Biraz dinlen! Tekrar çalışabilirsin: ${ts(me.lastWork + WORK_COOLDOWN, 'R')}`);
        const amount = randInt(10, 40);
        me.balance += amount;
        me.lastWork = now;
        db.save();
        return interaction.reply({ embeds: [base().setTitle('👨‍🍳 Mesai').setDescription(`${pick(WORKS)} ve ${fmt(amount)} kazandın!\n\nCüzdan: ${fmt(me.balance)}`)] });
      }

      case 'cuzdan': {
        const user = interaction.options.getUser('kullanici') || interaction.user;
        const w = wallet(gid, user.id);
        const rank = Object.entries(db.guild(gid).economy).sort((a, b) => b[1].balance - a[1].balance).findIndex(([id]) => id === user.id) + 1;
        return interaction.reply({ embeds: [base().setAuthor({ name: user.username, iconURL: user.displayAvatarURL() }).setTitle('👛 Boyoz Cüzdanı').addFields(
          { name: 'Bakiye', value: fmt(w.balance), inline: true },
          { name: 'Yenen boyoz', value: `**${w.eaten}** 😋`, inline: true },
          { name: 'Günlük seri', value: `🔥 ${w.streak}`, inline: true },
          { name: 'Sıralama', value: rank ? `#${rank}` : '—', inline: true },
          { name: 'Günlük', value: now - w.lastDaily >= DAY ? '✅ Alınabilir' : ts(w.lastDaily + DAY, 'R'), inline: true },
        )] });
      }

      case 'ye': {
        const count = interaction.options.getInteger('adet') || 1;
        if (me.balance < count) return replyFail(interaction, `Yeterli boyozun yok! Cüzdan: ${fmt(me.balance)}`);
        me.balance -= count;
        me.eaten += count;
        db.save();
        return interaction.reply({ embeds: [base().setTitle(`😋 ${count} boyoz yedin!`).setDescription(`${pick(EAT)}\n\nToplam yenen: **${me.eaten}** • Kalan: ${fmt(me.balance)}`).setThumbnail(urls.boyoz)], files: [files.boyoz()] });
      }

      case 'ver': {
        const user = interaction.options.getUser('kullanici');
        const amount = interaction.options.getInteger('miktar');
        if (user.bot || user.id === interaction.user.id) return replyFail(interaction, 'Geçerli bir kullanıcı seç.');
        if (me.balance < amount) return replyFail(interaction, `Yeterli boyozun yok! Cüzdan: ${fmt(me.balance)}`);
        me.balance -= amount;
        wallet(gid, user.id).balance += amount;
        db.save();
        return interaction.reply({ content: `🎁 ${interaction.user} → ${user}: ${fmt(amount)} hediye etti!`, allowedMentions: { users: [user.id] } });
      }

      case 'bahis': {
        const amount = interaction.options.getInteger('miktar');
        const choice = interaction.options.getString('secim');
        if (me.balance < amount) return replyFail(interaction, `Yeterli boyozun yok! Cüzdan: ${fmt(me.balance)}`);
        const result = Math.random() < 0.5 ? 'yazi' : 'tura';
        const win = result === choice;
        me.balance += win ? amount : -amount;
        db.save();
        return interaction.reply({ embeds: [base(win ? 0x57f287 : 0xed4245).setTitle(win ? '🎉 Kazandın!' : '💸 Kaybettin!')
          .setDescription(`Para: **${result === 'yazi' ? '🪙 Yazı' : '🦅 Tura'}**\n${win ? `+${fmt(amount)}` : `-${fmt(amount)}`}\n\nCüzdan: ${fmt(me.balance)}`)] });
      }

      case 'siralama': {
        const list = Object.entries(db.guild(gid).economy).filter(([, w]) => w.balance > 0).sort((a, b) => b[1].balance - a[1].balance).slice(0, 10);
        if (!list.length) return replyFail(interaction, 'Henüz kimsenin boyozu yok. `/boyoz gunluk` ile başla!');
        const medals = ['🥇', '🥈', '🥉'];
        return interaction.reply({ embeds: [base().setTitle('🏆 En Zengin Boyozcular').setThumbnail(urls.boyoz)
          .setDescription(list.map(([id, w], i) => `${medals[i] || `**${i + 1}.**`} <@${id}> • ${fmt(w.balance)} • 😋 ${w.eaten}`).join('\n'))], files: [files.boyoz()], allowedMentions: { parse: [] } });
      }

      default:
        return replyFail(interaction, 'Bilinmeyen işlem.');
    }
  },
};
