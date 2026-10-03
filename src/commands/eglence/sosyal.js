// Etkileşim GIF'leri (nekos.best) ve hayvan fotoğrafları. Ücretsiz, anahtarsız açık API'ler kullanılır.
const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const db = require('../../lib/db');
const { base, replyFail } = require('../../lib/embeds');
const { pick } = require('../../lib/util');

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// kategori: nekos.best uç noktası; self: kendine yapınca; text: başkasına yapınca
const ACTIONS = {
  saril: { api: 'hug', emoji: '🤗', desc: 'Birine sarıl', text: '{a}, {b} kişisine sımsıkı sarıldı!', self: '{a} kendine sarıldı... Gel buraya, biz sarılalım. 🫂', count: 'sarılma' },
  tokat: { api: 'slap', emoji: '👋', desc: 'Birine tokat at', text: '{a}, {b} kişisine şaplak attı!', self: '{a} kendine tokat attı. Kendine iyi bak! 😵', count: 'tokat' },
  op: { api: 'kiss', emoji: '💋', desc: 'Birini öp', text: '{a}, {b} kişisini öptü!', self: '{a} aynaya öpücük gönderdi. 😘', count: 'öpücük' },
  oksa: { api: 'pat', emoji: '🫳', desc: 'Birinin başını okşa', text: '{a}, {b} kişisinin başını okşadı!', self: '{a} kendi başını okşadı. Aferin sana! 🥹', count: 'okşama' },
  yumruk: { api: 'punch', emoji: '👊', desc: 'Birine (şakadan) yumruk at', text: '{a}, {b} kişisine yumruk attı! (şakadan 😅)', self: '{a} kendine yumruk attı?! 🤨', count: 'yumruk' },
  cak: { api: 'highfive', emoji: '🙌', desc: 'Birine beşlik çak', text: '{a}, {b} ile beşlik çaktı!', self: '{a} havaya beşlik çaktı. ✋', count: 'beşlik' },
  dans: { api: 'dance', emoji: '💃', desc: 'Dans et (istersen biriyle)', text: '{a}, {b} ile dans ediyor!', self: '{a} dans ediyor! 🎶', count: 'dans', optional: true },
  agla: { api: 'cry', emoji: '😭', desc: 'Ağla (istersen birine)', text: '{a}, {b} yüzünden ağlıyor! 😢', self: '{a} ağlıyor... Biri teselli etsin. 🥺', count: 'ağlama', optional: true },
};

function buildAction(name, a) {
  return {
    data: new SlashCommandBuilder().setName(name).setDescription(`${a.emoji} ${a.desc}`).setContexts(InteractionContextType.Guild)
      .addUserOption((o) => o.setName('kullanici').setDescription('Kime?').setRequired(!a.optional)),
    async execute(interaction) {
      const target = interaction.options.getUser('kullanici');
      const self = !target || target.id === interaction.user.id;
      let gif;
      try {
        gif = (await getJson(`https://nekos.best/api/v2/${a.api}`)).results[0].url;
      } catch {
        return replyFail(interaction, 'Görsel servisine şu an ulaşılamıyor, birazdan tekrar dene.');
      }
      // Sayaç: bu ikili arasında kaçıncı kez
      const social = db.guild(interaction.guild.id).social;
      let footer = null;
      if (!self) {
        const key = `${name}:${interaction.user.id}:${target.id}`;
        social[key] = (social[key] || 0) + 1;
        db.save();
        footer = `${interaction.user.username} → ${target.username}: ${social[key]}. ${a.count}`;
      }
      const text = (self ? a.self : a.text).replace('{a}', `**${interaction.user.username}**`).replace('{b}', `**${target?.username}**`);
      const embed = base().setDescription(`${a.emoji} ${text}`).setImage(gif);
      if (footer) embed.setFooter({ text: footer });
      await interaction.reply({ content: self ? undefined : `${target}`, embeds: [embed], allowedMentions: { users: self ? [] : [target.id] } });
    },
  };
}

const ANIMALS = {
  kedi: { label: '🐱 Kedi', fetch: async () => (await getJson('https://api.thecatapi.com/v1/images/search'))[0].url, lines: ['Miyav! 🐱', 'Bu tatlılığa dayanılmaz.', 'Kedi terapisi zamanı.'] },
  kopek: { label: '🐶 Köpek', fetch: async () => (await getJson('https://dog.ceo/api/breeds/image/random')).message, lines: ['Hav hav! 🐶', 'Kuyruk sallama seviyesi: maksimum.', 'En iyi dost burada.'] },
  tilki: { label: '🦊 Tilki', fetch: async () => (await getJson('https://randomfox.ca/floof/')).image, lines: ['Kurnaz ama tatlı. 🦊', 'Tilki modu: açık.'] },
  ordek: { label: '🦆 Ördek', fetch: async () => (await getJson('https://random-d.uk/api/v2/random')).url.replace(/^http:/, 'https:'), lines: ['Vak vak! 🦆', 'Ördek gözetimi altındasın.'] },
};

const { group } = require('../../lib/group');

module.exports = [
  group({
    name: 'etkilesim', description: '🤗 Sarıl, tokat at, öp, okşa, dans et... (hareketli GIF ile)',
    parts: Object.entries(ACTIONS).map(([name, a]) => ({ sub: name, cmd: buildAction(name, a) })),
  }),
  {
    data: new SlashCommandBuilder().setName('hayvan').setDescription('🐾 Rastgele sevimli hayvan fotoğrafı.').setContexts(InteractionContextType.Guild)
      .addStringOption((o) => o.setName('tur').setDescription('Hangi hayvan? (boş = rastgele)').addChoices(...Object.entries(ANIMALS).map(([value, x]) => ({ name: x.label, value })))),
    async execute(interaction) {
      const key = interaction.options.getString('tur') || pick(Object.keys(ANIMALS));
      const animal = ANIMALS[key];
      try {
        const url = await animal.fetch();
        await interaction.reply({ embeds: [base().setTitle(animal.label).setDescription(pick(animal.lines)).setImage(url)] });
      } catch {
        await replyFail(interaction, 'Hayvan fotoğrafı servisine ulaşılamadı, birazdan tekrar dene.');
      }
    },
  },
];
