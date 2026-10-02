const path = require('node:path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
dotenv.config({ path: [path.join(root, '.env.local'), path.join(root, '.env')], quiet: true });

const list = (value) => (value || '').split(',').map((s) => s.trim()).filter(Boolean);

module.exports = {
  root,
  token: process.env.DISCORD_TOKEN,
  guildId: process.env.GUILD_ID || null,
  ownerIds: list(process.env.OWNER_IDS),
  autoDeploy: (process.env.AUTO_DEPLOY || 'true').toLowerCase() !== 'false',
  dataFile: path.join(root, 'data', 'db.json'),
  assets: {
    avatar: path.join(root, 'assets', 'avatar.png'),
    logo: path.join(root, 'assets', 'logo.png'),
    banner: path.join(root, 'assets', 'banner.jpg'),
    profileBanner: path.join(root, 'assets', 'profil-banner.png'),
    boyoz: path.join(root, 'assets', 'boyoz.jpg'),
  },
  // Türkiye saati (UTC+3, yaz saati uygulaması yok)
  utcOffsetMinutes: 180,
  colors: {
    brand: 0xdf8e4e,
    success: 0x57f287,
    error: 0xed4245,
    warning: 0xfee75c,
    info: 0x5865f2,
    dark: 0x2b2d31,
  },
};
