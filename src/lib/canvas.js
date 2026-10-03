// @napi-rs/canvas yükleyici. Sunucularda sistem yazı tipi olmayabileceği için Poppins projeye gömülüdür.
const fs = require('node:fs');
const path = require('node:path');
const { root } = require('../config');

let lib = null;
try {
  lib = require('@napi-rs/canvas');
  const dir = path.join(root, 'assets', 'fonts');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.ttf'))) {
    lib.GlobalFonts.registerFromPath(path.join(dir, file), 'Poppins');
  }
} catch (err) {
  console.warn('[canvas] Görsel üretimi kapalı:', err.message);
  lib = null;
}

module.exports = { lib, FONT: 'Poppins' };
