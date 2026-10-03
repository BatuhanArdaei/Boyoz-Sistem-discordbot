// /emoji: sunucuya emoji ekleme (dosya, link veya başka sunucunun emojisi), mesajdan toplu kopyalama, silme, listeleme, büyütme.
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { base, reply, replyFail } = require('../../lib/embeds');
const { group } = require('../../lib/group');
const { lib: canvas } = require('../../lib/canvas');
const { truncate } = require('../../lib/util');
const { colors } = require('../../config');

const CUSTOM_RE = /<(a?):(\w{2,32}):(\d{17,20})>/g;
const MAX_BYTES = 256 * 1024;
const TR = { ı: 'i', İ: 'I', ş: 's', Ş: 'S', ğ: 'g', Ğ: 'G', ü: 'u', Ü: 'U', ö: 'o', Ö: 'O', ç: 'c', Ç: 'C' };

const cleanName = (s) => (s || '').replace(/[ıİşŞğĞüÜöÖçÇ]/g, (c) => TR[c]).replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').slice(0, 32).padEnd(2, '_');
const emojiUrl = (id, animated) => `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}?size=128&quality=lossless`;

async function download(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Görsel indirilemedi (HTTP ${res.status}).`);
  const type = res.headers.get('content-type') || '';
  if (!/image\/(png|jpe?g|gif|webp)/.test(type)) throw new Error('Bağlantı bir görsel değil (png, jpg, gif, webp olmalı).');
  return { buffer: Buffer.from(await res.arrayBuffer()), gif: type.includes('gif') };
}

// 256 KB'tan büyük sabit görselleri 128x128'e küçültür
async function fit(buffer, gif) {
  if (buffer.length <= MAX_BYTES) return buffer;
  if (gif || !canvas) throw new Error('Görsel 256 KB\'tan büyük. Hareketli (GIF) emojiler otomatik küçültülemez, daha küçük bir dosya dene.');
  const img = await canvas.loadImage(buffer);
  const c = canvas.createCanvas(128, 128);
  const ctx = c.getContext('2d');
  const scale = Math.min(128 / img.width, 128 / img.height);
  const w = img.width * scale; const h = img.height * scale;
  ctx.drawImage(img, (128 - w) / 2, (128 - h) / 2, w, h);
  return c.encode('png');
}

async function create(guild, name, url, by) {
  const { buffer, gif } = await download(url);
  const data = await fit(buffer, gif);
  return guild.emojis.create({ attachment: data, name: cleanName(name), reason: `Emoji ekleme: ${by}` });
}

function limits(guild) {
  const max = [50, 100, 150, 250][guild.premiumTier] ?? 50;
  const stat = guild.emojis.cache.filter((e) => !e.animated).size;
  const anim = guild.emojis.cache.filter((e) => e.animated).size;
  return { max, stat, anim };
}

function friendlyError(err) {
  if (err.code === 30008) return 'Sunucunun emoji sınırı doldu.';
  if (err.code === 50013) return 'Emoji ekleme iznim yok ("İfadeleri Yönet" izni gerekli).';
  if (err.code === 50035) return 'Discord bu görseli kabul etmedi (boyut/biçim/isim hatalı olabilir).';
  return err.message;
}

const ekle = {
  data: new SlashCommandBuilder().setName('ekle').setDescription('Sunucuya emoji ekler')
    .addStringOption((o) => o.setName('isim').setDescription('Emoji adı (harf, rakam, _)').setRequired(true).setMinLength(2).setMaxLength(32))
    .addAttachmentOption((o) => o.setName('dosya').setDescription('Görsel dosyası (png, jpg, gif, webp)'))
    .addStringOption((o) => o.setName('link').setDescription('Görsel linki'))
    .addStringOption((o) => o.setName('emoji').setDescription('Başka sunucudaki bir emojiyi buraya yapıştır')),
  async execute(interaction) {
    const file = interaction.options.getAttachment('dosya');
    const link = interaction.options.getString('link');
    const pasted = [...(interaction.options.getString('emoji') || '').matchAll(CUSTOM_RE)][0];
    const url = file?.url || (pasted && emojiUrl(pasted[3], pasted[1] === 'a')) || link;
    if (!url) return replyFail(interaction, '`dosya`, `link` veya `emoji` seçeneklerinden birini doldur.');
    if (link && !/^https?:\/\//i.test(link) && !file && !pasted) return replyFail(interaction, 'Geçerli bir link gir (https://...).');
    await interaction.deferReply();
    try {
      const e = await create(interaction.guild, interaction.options.getString('isim'), url, interaction.user.tag);
      return interaction.editReply({ embeds: [base(colors.success).setDescription(`✅ Emoji eklendi: ${e} \`:${e.name}:\``).setThumbnail(e.imageURL())] });
    } catch (err) {
      return interaction.editReply({ embeds: [base(colors.error).setDescription(`❌ ${friendlyError(err)}`)] });
    }
  },
};

const kopyala = {
  data: new SlashCommandBuilder().setName('kopyala').setDescription('Bir mesajdaki veya yapıştırdığın tüm özel emojileri sunucuya ekler')
    .addStringOption((o) => o.setName('emojiler').setDescription('Emojileri buraya yapıştır (birden fazla olabilir)'))
    .addStringOption((o) => o.setName('mesaj').setDescription('Emojilerin olduğu mesajın linki/ID\'si (bu kanalda)')),
  async execute(interaction) {
    let text = interaction.options.getString('emojiler') || '';
    const msgRef = interaction.options.getString('mesaj');
    if (msgRef) {
      const msg = await interaction.channel.messages.fetch(msgRef.split('/').pop().trim()).catch(() => null);
      if (!msg) return replyFail(interaction, 'Mesaj bulunamadı (bu kanalda olmalı).');
      text += ` ${msg.content} ${msg.reactions.cache.map((r) => r.emoji.toString()).join(' ')}`;
    }
    const found = [...new Map([...text.matchAll(CUSTOM_RE)].map((m) => [m[3], m])).values()].slice(0, 20);
    if (!found.length) return replyFail(interaction, 'Özel (custom) emoji bulunamadı. Normal 😀 emojiler eklenemez.');
    await interaction.deferReply();
    const ok = []; const fail = [];
    for (const m of found) {
      if (interaction.guild.emojis.cache.has(m[3])) { fail.push(`\`${m[2]}\` (zaten bu sunucuda)`); continue; }
      try { ok.push(`${await create(interaction.guild, m[2], emojiUrl(m[3], m[1] === 'a'), interaction.user.tag)}`); } catch (err) { fail.push(`\`${m[2]}\` (${friendlyError(err)})`); }
    }
    return interaction.editReply({ embeds: [base(ok.length ? colors.success : colors.error)
      .setDescription(`${ok.length ? `✅ **${ok.length}** emoji eklendi: ${ok.join(' ')}` : ''}${fail.length ? `\n❌ Eklenemeyen: ${truncate(fail.join(', '), 1500)}` : ''}`)] });
  },
};

const sil = {
  data: new SlashCommandBuilder().setName('sil').setDescription('Sunucudan emoji siler')
    .addStringOption((o) => o.setName('emoji').setDescription('Emoji (yapıştır veya ara)').setRequired(true).setAutocomplete(true)),
  async autocomplete(interaction) {
    const q = interaction.options.getFocused().toLowerCase();
    await interaction.respond(interaction.guild.emojis.cache.filter((e) => e.name.toLowerCase().includes(q)).first(25).map((e) => ({ name: `:${e.name}:${e.animated ? ' (hareketli)' : ''}`, value: e.id })));
  },
  async execute(interaction) {
    const raw = interaction.options.getString('emoji');
    const id = raw.match(/\d{17,20}/)?.[0];
    const e = (id && interaction.guild.emojis.cache.get(id)) || interaction.guild.emojis.cache.find((x) => x.name === raw.replace(/:/g, ''));
    if (!e) return replyFail(interaction, 'Bu sunucuda böyle bir emoji yok.');
    await e.delete(`Silen: ${interaction.user.tag}`);
    return reply(interaction, base(colors.success).setDescription(`🗑️ \`:${e.name}:\` silindi.`), { ephemeral: false });
  },
};

const liste = {
  data: new SlashCommandBuilder().setName('liste').setDescription('Sunucunun emojilerini listeler'),
  async execute(interaction) {
    const { max, stat, anim } = limits(interaction.guild);
    const all = interaction.guild.emojis.cache;
    const s = all.filter((e) => !e.animated).map((e) => `${e}`).join(' ');
    const a = all.filter((e) => e.animated).map((e) => `${e}`).join(' ');
    return reply(interaction, base().setTitle(`😀 ${interaction.guild.name} • Emojiler`).addFields(
      { name: `🖼️ Sabit (${stat}/${max})`, value: truncate(s, 1024) || '—' },
      { name: `🎞️ Hareketli (${anim}/${max})`, value: truncate(a, 1024) || '—' },
    ), { ephemeral: false });
  },
};

const buyut = {
  data: new SlashCommandBuilder().setName('buyut').setDescription('Bir emojiyi büyük gösterir ve indirme linki verir')
    .addStringOption((o) => o.setName('emoji').setDescription('Özel emojiyi yapıştır').setRequired(true)),
  async execute(interaction) {
    const m = [...interaction.options.getString('emoji').matchAll(CUSTOM_RE)][0];
    if (!m) return replyFail(interaction, 'Sadece özel (custom) emojiler büyütülebilir.');
    const url = `https://cdn.discordapp.com/emojis/${m[3]}.${m[1] ? 'gif' : 'png'}?size=512&quality=lossless`;
    return interaction.reply({ embeds: [base().setTitle(`:${m[2]}:`).setURL(url).setImage(url).setFooter({ text: `ID: ${m[3]}` })] });
  },
};

const manage = PermissionFlagsBits.ManageGuildExpressions;

module.exports = group({
  name: 'emoji',
  description: '😀 Emoji ekle, başka sunucudan kopyala, sil, listele, büyüt.',
  parts: [
    { sub: 'ekle', cmd: ekle, perm: manage },
    { sub: 'kopyala', cmd: kopyala, perm: manage },
    { sub: 'sil', cmd: sil, perm: manage },
    { sub: 'liste', cmd: liste },
    { sub: 'buyut', cmd: buyut },
  ],
});
