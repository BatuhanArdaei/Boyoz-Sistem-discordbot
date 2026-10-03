// PM2 ayarları: botu arka planda çalıştırır, çökerse yeniden başlatır.
// Kullanım: pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'boyoz',
      script: 'src/index.js',
      cwd: __dirname,
      autorestart: true,
      restart_delay: 5000,
      max_memory_restart: '400M',
      kill_timeout: 5000, // kapanırken veritabanını diske yazmaya zaman tanı
      time: true, // loglara zaman damgası ekle
    },
  ],
};
