// Hızlı eğlence komutları.
const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { base, replyFail } = require('../../lib/embeds');
const { pick, randInt } = require('../../lib/util');
const { FORTUNES } = require('../../data/icerik');

const guildOnly = (b) => b.setContexts(InteractionContextType.Guild);

const BALL = [
  'Kesinlikle evet. ✅', 'Hiç şüphen olmasın.', 'Bence evet. 🥐', 'Büyük ihtimalle.', 'Görünüşe göre evet.',
  'İşaretler evet diyor.', 'Şu an söyleyemem, sonra tekrar sor.', 'Boyozumu yerken düşüneyim... 🤔', 'Şimdi söylemesem daha iyi.',
  'Buna güvenme.', 'Cevabım hayır. ❌', 'Kaynaklarım hayır diyor.', 'Pek iyi görünmüyor.', 'Çok şüpheli.', 'Rüyanda görürsün. 😴',
];

const JOKES = [
  'Adamın biri boyoz almış, eve gelince bakmış ki "boy"u kısa, "oz"u fazla. 🥐',
  'Matematik kitabı neden üzgündü? Çünkü çok problemi vardı.',
  'Bilgisayar neden üşümüş? Pencereleri açık kalmış.',
  'Fırıncıya sordum "taze mi?" dedi "dünden beri taze".',
  'Kaleci neden partiye gitmemiş? Çünkü hep kurtarılmayı bekliyormuş.',
  'Temel bilgisayar almış, "neden internet yok?" demiş. Dursun: "Fişini prize takmadın ki."',
  'Karpuz neden kırmızıdır? Çünkü yeşil kabuğun altında utanır.',
  'Bir boyoz diğerine ne demiş? "Kat kat seviyorum seni." 🧡',
  'Kediler neden bilgisayar kullanamaz? Çünkü mouse\'u yakalamaya çalışırlar.',
  'İzmirli turiste sormuşlar "Neden boyoz?" demiş. "Çünkü gevrek değil, simit!"',
  'Pilot uçağı neden durdurmuş? Kırmızı ışıkta yaya geçiyormuş… bulutların arasından.',
  'Doktor: "Her gün bir elma yiyin." Hasta: "Boyoz olmaz mı?" Doktor: "O zaman iki tane." 🥐',
];

const COMPLIMENTS = [
  'bugün de boyoz gibi çıtır çıtırsın! 🥐', 'sohbetin Kordon\'da gün batımı kadar güzel. 🌅', 'senin olduğun sunucu kat kat güzelleşiyor.',
  'enerjin sabah çayı kadar iyi geliyor. ☕', 'gülüşün fırından yeni çıkmış boyoz kadar sıcak.', 'bu sunucunun gizli kahramanısın. 🦸',
  'zekâna hayranım, gerçekten!', 'sen varsan moral her zaman yerinde. 💛', 'mesajların kahvaltı sofrası gibi; doyurucu ve keyifli.',
];

const SLOTS = ['🥐', '🍳', '☕', '🧀', '🍅', '🫒', '🥚'];

module.exports = [
  {
    data: guildOnly(new SlashCommandBuilder().setName('zar').setDescription('🎲 Zar atar.'))
      .addIntegerOption((o) => o.setName('yuz').setDescription('Zarın yüz sayısı (varsayılan 6)').setMinValue(2).setMaxValue(1000))
      .addIntegerOption((o) => o.setName('adet').setDescription('Kaç zar? (1-10)').setMinValue(1).setMaxValue(10)),
    async execute(interaction) {
      const sides = interaction.options.getInteger('yuz') || 6;
      const count = interaction.options.getInteger('adet') || 1;
      const rolls = Array.from({ length: count }, () => randInt(1, sides));
      const total = rolls.reduce((a, b) => a + b, 0);
      await interaction.reply({ embeds: [base().setTitle('🎲 Zar').setDescription(`${rolls.map((r) => `**${r}**`).join(' • ')}${count > 1 ? `\n\nToplam: **${total}**` : ''}`).setFooter({ text: `${count}d${sides}` })] });
    },
  },
  {
    data: guildOnly(new SlashCommandBuilder().setName('yazitura').setDescription('🪙 Yazı tura atar.')),
    async execute(interaction) {
      const result = Math.random() < 0.5 ? '🪙 **YAZI**' : '🦅 **TURA**';
      await interaction.reply({ embeds: [base().setTitle('Yazı mı tura mı?').setDescription(`Para havada döndü döndü... ve ${result}!`)] });
    },
  },
  {
    data: guildOnly(new SlashCommandBuilder().setName('8top').setDescription('🎱 Sihirli 8 topuna soru sor.'))
      .addStringOption((o) => o.setName('soru').setDescription('Sorun').setRequired(true).setMaxLength(300)),
    async execute(interaction) {
      await interaction.reply({ embeds: [base().setTitle('🎱 Sihirli 8 Top').addFields(
        { name: '❓ Soru', value: interaction.options.getString('soru') },
        { name: '🔮 Cevap', value: pick(BALL) },
      )] });
    },
  },
  {
    data: guildOnly(new SlashCommandBuilder().setName('sec').setDescription('🤔 Seçenekler arasından rastgele seçer.'))
      .addStringOption((o) => o.setName('secenekler').setDescription('Virgülle ayır: pizza, döner, boyoz').setRequired(true).setMaxLength(1000)),
    async execute(interaction) {
      const opts = interaction.options.getString('secenekler').split(',').map((s) => s.trim()).filter(Boolean);
      if (opts.length < 2) return replyFail(interaction, 'En az 2 seçenek gir (virgülle ayır).');
      await interaction.reply({ embeds: [base().setTitle('🤔 Karar verdim!').setDescription(`Seçenekler: ${opts.map((o) => `\`${o}\``).join(', ')}\n\n👉 **${pick(opts)}**`)] });
    },
  },
  {
    data: guildOnly(new SlashCommandBuilder().setName('espri').setDescription('😂 Rastgele bir espri yapar.')),
    async execute(interaction) {
      await interaction.reply({ embeds: [base().setTitle('😂 Espri vakti').setDescription(pick(JOKES))] });
    },
  },
  {
    data: guildOnly(new SlashCommandBuilder().setName('iltifat').setDescription('💛 Birine iltifat eder.'))
      .addUserOption((o) => o.setName('kullanici').setDescription('Kime?').setRequired(true)),
    async execute(interaction) {
      const user = interaction.options.getUser('kullanici');
      await interaction.reply({ content: `${user}, ${pick(COMPLIMENTS)}`, allowedMentions: { users: [user.id] } });
    },
  },
  {
    data: guildOnly(new SlashCommandBuilder().setName('ask-olcer').setDescription('💘 İki kişi arasındaki uyumu ölçer.'))
      .addUserOption((o) => o.setName('kisi1').setDescription('Birinci kişi').setRequired(true))
      .addUserOption((o) => o.setName('kisi2').setDescription('İkinci kişi (boş = sen)')),
    async execute(interaction) {
      const a = interaction.options.getUser('kisi1');
      const b = interaction.options.getUser('kisi2') || interaction.user;
      // Aynı ikili her zaman aynı sonucu alsın
      const seed = [a.id, b.id].sort().join('');
      let hash = 0;
      for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) % 1000003;
      const pct = a.id === b.id ? 100 : hash % 101;
      const filled = Math.round(pct / 10);
      const text = pct >= 90 ? 'Ruh ikizi! 💞' : pct >= 70 ? 'Çok uyumlusunuz! 💖' : pct >= 50 ? 'Fena değil, bir boyoz paylaşın. 🥐' : pct >= 25 ? 'Biraz çaba lazım. 🤏' : 'Arkadaş kalalım… 💔';
      await interaction.reply({ embeds: [base(0xeb459e).setTitle('💘 Aşk Ölçer').setDescription(`${a} ❤️ ${b}\n\n${'❤️'.repeat(filled)}${'🖤'.repeat(10 - filled)} **%${pct}**\n\n${text}`)], allowedMentions: { parse: [] } });
    },
  },
  {
    data: guildOnly(new SlashCommandBuilder().setName('fal').setDescription('☕ Kahve falına bakarım (tamamen eğlence amaçlı!).')),
    async execute(interaction) {
      const picks = [...FORTUNES].sort(() => Math.random() - 0.5).slice(0, 3);
      await interaction.reply({ embeds: [base(0x6f4e37).setTitle('☕ Kahve Falı').setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
        .setDescription(`Fincanını kapattın, soğumasını bekledik... 👀\n\n${picks.map((f) => `• ${f}`).join('\n')}`)
        .setFooter({ text: 'Fala inanma, falsız da kalma 😄' })] });
    },
  },
  {
    data: guildOnly(new SlashCommandBuilder().setName('slot').setDescription('🎰 Kahvaltı slot makinesini çevirir.')),
    async execute(interaction) {
      const reels = [pick(SLOTS), pick(SLOTS), pick(SLOTS)];
      const unique = new Set(reels).size;
      const result = unique === 1 ? (reels[0] === '🥐' ? '🎉 **BOYOZ JACKPOT!** Efsanesin!' : '🎉 **JACKPOT!** Üçü de aynı!')
        : unique === 2 ? '✨ İkisi aynı, az kaldı!' : '😅 Olmadı, bir daha dene.';
      await interaction.reply({ embeds: [base().setTitle('🎰 Kahvaltı Slotu').setDescription(`┃ ${reels.join(' ┃ ')} ┃\n\n${result}`)] });
    },
  },
];
