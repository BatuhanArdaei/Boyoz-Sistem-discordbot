// Discord bir sunucuda en fazla 100 slash komutuna izin verir. Bu yardımcı, mevcut komutları kodlarına
// dokunmadan tek bir komutun alt komutlarına dönüştürür: /jail ver, /jail kaldir, /jail ayar ...
// Alt komutları olan bir komut, "alt komut grubu" olur: /uyari ceza ekle
const { replyFail } = require('./embeds');

const LEADING_EMOJI = /^(\p{Extended_Pictographic}️?(‍\p{Extended_Pictographic}️?)*)\s*/u;

function group({ name, description, perm = null, parts }) {
  const options = parts.map((p) => {
    const src = p.cmd.data.toJSON();
    const desc = (p.desc || src.description.replace(LEADING_EMOJI, '')).slice(0, 100);
    const subs = (src.options || []).filter((o) => o.type === 1);
    return subs.length
      ? { type: 2, name: p.sub, description: desc, options: subs }
      : { type: 1, name: p.sub, description: desc, options: src.options || [] };
  });
  const json = { type: 1, name, description, contexts: [0], options };
  if (perm !== null) json.default_member_permissions = String(perm);

  const find = (interaction) => {
    const key = interaction.options.getSubcommandGroup(false) || interaction.options.getSubcommand();
    return parts.find((p) => p.sub === key);
  };

  return {
    data: { name, description, toJSON: () => json },
    parts,
    async execute(interaction, client) {
      const part = find(interaction);
      if (!part) return replyFail(interaction, 'Bilinmeyen alt komut.');
      if (part.perm && !interaction.memberPermissions?.has(part.perm)) return replyFail(interaction, 'Bu alt komut için yetkin yok.');
      return part.cmd.execute(interaction, client);
    },
    async autocomplete(interaction, client) {
      return find(interaction)?.cmd.autocomplete?.(interaction, client);
    },
    components: Object.assign({}, ...parts.map((p) => p.cmd.components || {})),
  };
}

// Bir komut listesinde belirtilenleri gruplar, geri kalanları olduğu gibi bırakır.
function regroup(list, groups) {
  const byName = (n) => {
    const c = list.find((x) => x.data.name === n);
    if (!c) throw new Error(`Gruplanacak komut bulunamadı: ${n}`);
    return c;
  };
  const used = new Set();
  const grouped = groups.map((g) => group({
    ...g,
    parts: g.parts.map((p) => { used.add(p.from); return { ...p, cmd: p.cmd || byName(p.from) }; }),
  }));
  return [...grouped, ...list.filter((c) => !used.has(c.data.name))];
}

module.exports = { group, regroup };
