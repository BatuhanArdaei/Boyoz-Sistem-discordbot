// Oyunlarda kullanılan içerik listeleri.

// Bayrak bilmece: ülke kodu (flagcdn.com) -> kabul edilen cevaplar (ilki gösterilen isim)
const FLAGS = {
  tr: ['Türkiye', 'turkey'], de: ['Almanya', 'germany'], fr: ['Fransa', 'france'], it: ['İtalya', 'italy'],
  es: ['İspanya', 'spain'], gb: ['Birleşik Krallık', 'ingiltere', 'uk', 'united kingdom', 'britanya'],
  us: ['ABD', 'amerika', 'amerika birlesik devletleri', 'usa'], br: ['Brezilya', 'brazil'], ar: ['Arjantin', 'argentina'],
  jp: ['Japonya', 'japan'], kr: ['Güney Kore', 'kore', 'south korea'], cn: ['Çin', 'china'], ru: ['Rusya', 'russia'],
  ua: ['Ukrayna', 'ukraine'], az: ['Azerbaycan', 'azerbaijan'], gr: ['Yunanistan', 'greece'], nl: ['Hollanda', 'netherlands', 'holland'],
  be: ['Belçika', 'belgium'], pt: ['Portekiz', 'portugal'], ch: ['İsviçre', 'switzerland'], se: ['İsveç', 'sweden'],
  no: ['Norveç', 'norway'], fi: ['Finlandiya', 'finland'], dk: ['Danimarka', 'denmark'], pl: ['Polonya', 'poland'],
  at: ['Avusturya', 'austria'], ca: ['Kanada', 'canada'], mx: ['Meksika', 'mexico'], in: ['Hindistan', 'india'],
  pk: ['Pakistan'], sa: ['Suudi Arabistan', 'saudi arabia'], eg: ['Mısır', 'egypt'], ma: ['Fas', 'morocco'],
  dz: ['Cezayir', 'algeria'], ng: ['Nijerya', 'nigeria'], za: ['Güney Afrika', 'south africa'], au: ['Avustralya', 'australia'],
  nz: ['Yeni Zelanda', 'new zealand'], ie: ['İrlanda', 'ireland'], cz: ['Çekya', 'cek cumhuriyeti', 'czechia'],
  hu: ['Macaristan', 'hungary'], ro: ['Romanya', 'romania'], bg: ['Bulgaristan', 'bulgaria'], rs: ['Sırbistan', 'serbia'],
  hr: ['Hırvatistan', 'croatia'], ba: ['Bosna Hersek', 'bosna', 'bosnia'], al: ['Arnavutluk', 'albania'],
  mk: ['Kuzey Makedonya', 'makedonya', 'north macedonia'], ge: ['Gürcistan', 'georgia'], ir: ['İran', 'iran'],
  iq: ['Irak', 'iraq'], qa: ['Katar', 'qatar'], ae: ['Birleşik Arap Emirlikleri', 'bae', 'uae'], kz: ['Kazakistan', 'kazakhstan'],
  uz: ['Özbekistan', 'uzbekistan'], kg: ['Kırgızistan', 'kyrgyzstan'], tm: ['Türkmenistan', 'turkmenistan'],
  id: ['Endonezya', 'indonesia'], my: ['Malezya', 'malaysia'], th: ['Tayland', 'thailand'], vn: ['Vietnam'],
  ph: ['Filipinler', 'philippines'], co: ['Kolombiya', 'colombia'], cl: ['Şili', 'chile'], pe: ['Peru'],
  uy: ['Uruguay'], jm: ['Jamaika', 'jamaica'], cu: ['Küba', 'cuba'], is: ['İzlanda', 'iceland'], ee: ['Estonya', 'estonia'],
  lv: ['Letonya', 'latvia'], lt: ['Litvanya', 'lithuania'], kp: ['Kuzey Kore', 'north korea'], mn: ['Moğolistan', 'mongolia'],
  np: ['Nepal'], lk: ['Sri Lanka'], ke: ['Kenya'], et: ['Etiyopya', 'ethiopia'], gh: ['Gana', 'ghana'], sn: ['Senegal'],
  cm: ['Kamerun', 'cameroon'], tn: ['Tunus', 'tunisia'], jo: ['Ürdün', 'jordan'], lb: ['Lübnan', 'lebanon'],
};

// Emoji bilmece: e = emojiler, a = kabul edilen cevaplar (ilki gösterilen), k = kategori
const EMOJI_PUZZLES = [
  { e: '🦁👑', a: ['Aslan Kral', 'the lion king', 'lion king'], k: 'Film' },
  { e: '🕷️🧑‍🦱🕸️', a: ['Örümcek Adam', 'spiderman', 'spider man'], k: 'Film' },
  { e: '❄️👸⛄', a: ['Karlar Ülkesi', 'frozen'], k: 'Film' },
  { e: '🚢🧊💔', a: ['Titanik', 'titanic'], k: 'Film' },
  { e: '🦇🧔🌃', a: ['Batman', 'yarasa adam'], k: 'Film' },
  { e: '💍🌋🧙‍♂️', a: ['Yüzüklerin Efendisi', 'lord of the rings'], k: 'Film' },
  { e: '⚡👓🧙‍♂️', a: ['Harry Potter'], k: 'Film' },
  { e: '🦖🏝️🚙', a: ['Jurassic Park', 'jurassic world'], k: 'Film' },
  { e: '🐠🔍🌊', a: ['Kayıp Balık Nemo', 'nemo', 'finding nemo'], k: 'Film' },
  { e: '🤖🌱🌍', a: ['WALL-E', 'wall e', 'walle'], k: 'Film' },
  { e: '🐀👨‍🍳🍲', a: ['Ratatuy', 'ratatouille'], k: 'Film' },
  { e: '🏴‍☠️🚢🦜', a: ['Karayip Korsanları', 'pirates of the caribbean'], k: 'Film' },
  { e: '👻🚫🔫', a: ['Hayalet Avcıları', 'ghostbusters'], k: 'Film' },
  { e: '🍫🏭🎩', a: ['Charlie\'nin Çikolata Fabrikası', 'cikolata fabrikasi', 'charlie and the chocolate factory'], k: 'Film' },
  { e: '🐼🥋🥟', a: ['Kung Fu Panda'], k: 'Film' },
  { e: '🦍🏙️✈️', a: ['King Kong'], k: 'Film' },
  { e: '🏠🎈👴', a: ['Yukarı Bak', 'up'], k: 'Film' },
  { e: '🐢🍕🥷', a: ['Ninja Kaplumbağalar', 'ninja turtles', 'tmnt'], k: 'Film' },
  { e: '🏃‍♂️🍫🪶', a: ['Forrest Gump'], k: 'Film' },
  { e: '🛡️⭐🇺🇸', a: ['Kaptan Amerika', 'captain america'], k: 'Film' },
  { e: '🔨⚡👱‍♂️', a: ['Thor'], k: 'Film' },
  { e: '💚💪😡', a: ['Hulk'], k: 'Film' },
  { e: '🧑‍🚀🌽🕳️', a: ['Yıldızlararası', 'interstellar'], k: 'Film' },
  { e: '🦈🏖️😱', a: ['Jaws', 'denizin dişleri'], k: 'Film' },
  { e: '👦🏠🎄🪤', a: ['Evde Tek Başına', 'home alone'], k: 'Film' },
  { e: '🧽🍍🌊', a: ['Sünger Bob', 'spongebob', 'sunger bob kare pantolon'], k: 'Çizgi film' },
  { e: '🟡👨‍👩‍👧‍👦🍩', a: ['Simpsonlar', 'the simpsons', 'simpsons'], k: 'Çizgi film' },
  { e: '🐭🐱💥', a: ['Tom ve Jerry', 'tom and jerry', 'tom jerry'], k: 'Çizgi film' },
  { e: '🧑‍🏫📚😂', a: ['Hababam Sınıfı'], k: 'Türk filmi' },
  { e: '👨‍🍳🔥🏆', a: ['MasterChef', 'masterchef turkiye'], k: 'Yarışma' },
  { e: '🧱⛏️🟩', a: ['Minecraft'], k: 'Oyun' },
  { e: '🍄👨‍🔧👸', a: ['Super Mario', 'mario'], k: 'Oyun' },
  { e: '🚗🔫🌴', a: ['GTA', 'grand theft auto'], k: 'Oyun' },
  { e: '🔫🪂🏝️', a: ['PUBG', 'fortnite', 'free fire'], k: 'Oyun' },
  { e: '🐦😡🐷', a: ['Angry Birds'], k: 'Oyun' },
];

// Hızlı yaz: görsel olarak çizilip yazdırılan ifadeler
const TYPE_PHRASES = [
  'boyoz ve yumurta', 'çıtır çıtır boyoz', 'kordonda gün batımı', 'sabah çayı demlendi', 'izmirin dağlarında',
  'kumru ile ayran', 'gevrek değil simit', 'kemeraltı çarşısı', 'saat kulesi önünde', 'boyozcu amca geldi',
  'discord sunucusu', 'klavye savaşçısı', 'hızlı yazan kazanır', 'parmakların ısınsın', 'birinci olan sensin',
  'kahve fincanı', 'gökkuşağı renkleri', 'yaz tatili bitti', 'kar yağıyor dışarıda', 'boyozlar fırından çıktı',
  'şemsiyeni unutma', 'çay mı kahve mi', 'oyun gecesi başlasın', 'mikrofonun açık', 'kimse beni yenemez',
  'üç beş boyoz alalım', 'ağır çekimde koşu', 'yıldızlara bakıyorum', 'deniz kenarında yürüyüş', 'müzik sesini aç',
];

// Kelime çöz (anagram) ve adam asmaca kelimeleri: w = kelime, k = ipucu kategorisi
const WORDS = [
  { w: 'bilgisayar', k: 'Teknoloji' }, { w: 'klavye', k: 'Teknoloji' }, { w: 'kulaklık', k: 'Teknoloji' }, { w: 'telefon', k: 'Teknoloji' },
  { w: 'mikrofon', k: 'Teknoloji' }, { w: 'ekran', k: 'Teknoloji' }, { w: 'internet', k: 'Teknoloji' }, { w: 'yazılım', k: 'Teknoloji' },
  { w: 'boyoz', k: 'Yemek' }, { w: 'kumru', k: 'Yemek' }, { w: 'lahmacun', k: 'Yemek' }, { w: 'baklava', k: 'Yemek' },
  { w: 'mantı', k: 'Yemek' }, { w: 'menemen', k: 'Yemek' }, { w: 'köfte', k: 'Yemek' }, { w: 'dondurma', k: 'Yemek' },
  { w: 'karpuz', k: 'Meyve' }, { w: 'çilek', k: 'Meyve' }, { w: 'portakal', k: 'Meyve' }, { w: 'muz', k: 'Meyve' }, { w: 'kiraz', k: 'Meyve' },
  { w: 'aslan', k: 'Hayvan' }, { w: 'zürafa', k: 'Hayvan' }, { w: 'penguen', k: 'Hayvan' }, { w: 'kaplumbağa', k: 'Hayvan' },
  { w: 'kelebek', k: 'Hayvan' }, { w: 'yunus', k: 'Hayvan' }, { w: 'tavşan', k: 'Hayvan' }, { w: 'kartal', k: 'Hayvan' },
  { w: 'izmir', k: 'Şehir' }, { w: 'istanbul', k: 'Şehir' }, { w: 'ankara', k: 'Şehir' }, { w: 'antalya', k: 'Şehir' },
  { w: 'trabzon', k: 'Şehir' }, { w: 'eskişehir', k: 'Şehir' }, { w: 'gaziantep', k: 'Şehir' },
  { w: 'futbol', k: 'Spor' }, { w: 'basketbol', k: 'Spor' }, { w: 'voleybol', k: 'Spor' }, { w: 'yüzme', k: 'Spor' }, { w: 'satranç', k: 'Spor' },
  { w: 'gitar', k: 'Müzik' }, { w: 'piyano', k: 'Müzik' }, { w: 'davul', k: 'Müzik' }, { w: 'keman', k: 'Müzik' }, { w: 'bağlama', k: 'Müzik' },
  { w: 'deniz', k: 'Doğa' }, { w: 'orman', k: 'Doğa' }, { w: 'gökkuşağı', k: 'Doğa' }, { w: 'yanardağ', k: 'Doğa' }, { w: 'şelale', k: 'Doğa' },
  { w: 'öğretmen', k: 'Meslek' }, { w: 'doktor', k: 'Meslek' }, { w: 'itfaiyeci', k: 'Meslek' }, { w: 'fırıncı', k: 'Meslek' }, { w: 'pilot', k: 'Meslek' },
  { w: 'şemsiye', k: 'Eşya' }, { w: 'buzdolabı', k: 'Eşya' }, { w: 'ayna', k: 'Eşya' }, { w: 'yastık', k: 'Eşya' }, { w: 'merdiven', k: 'Eşya' },
];

// Kelimebul (Wordle) - 5 harfli kelimeler
const WORDLE_WORDS = [
  'boyoz', 'kumru', 'kalem', 'kitap', 'araba', 'elmas', 'deniz', 'güneş', 'bulut', 'çiçek', 'masal', 'sabah', 'akşam', 'bahar',
  'çatal', 'bıçak', 'tabak', 'kaşık', 'sehpa', 'perde', 'duvar', 'bahçe', 'fidan', 'çamur', 'fırın', 'ekmek', 'simit', 'biber',
  'salça', 'çorba', 'pilav', 'köfte', 'dolma', 'sarma', 'helva', 'lokum', 'kahve', 'tavuk', 'aslan', 'zebra', 'tilki', 'ördek',
  'horoz', 'balık', 'yunus', 'şahin', 'serçe', 'karga', 'dalga', 'liman', 'vapur', 'kayık', 'roket', 'taksi', 'metro', 'durak',
  'köprü', 'sokak', 'cadde', 'şehir', 'dünya', 'müzik', 'şarkı', 'gitar', 'davul', 'zurna', 'sahne', 'zaman', 'hafta', 'resim',
  'fırça', 'kağıt', 'silgi', 'sınıf', 'sevgi', 'huzur', 'çanta', 'valiz', 'ceket', 'kazak', 'şapka', 'çorap', 'bilek', 'kulak',
  'burun', 'dudak', 'yanak', 'beyin', 'buzul', 'orman', 'nehir', 'ırmak', 'yayla', 'altın', 'gümüş', 'bakır', 'demir', 'çelik',
  'kömür', 'tarla', 'mısır', 'pamuk', 'nohut', 'armut', 'kiraz', 'çilek', 'kavun', 'limon', 'incir', 'vişne', 'kuzey', 'güney',
  'radyo', 'video', 'ekran', 'robot', 'kutup', 'gölge', 'kartal', 'pirinç',
].filter((w, i, arr) => [...w].length === 5 && arr.indexOf(w) === i);

// Doğruluk mu cesaret mi
const TRUTHS = [
  'Bu sunucuda en çok kiminle konuşmaktan keyif alıyorsun?', 'En son ne zaman ağladın ve neden?', 'Hiç birine yalan söyleyip yakalandın mı?',
  'En utanç verici anını anlat.', 'Telefonunda en son aradığın şey neydi?', 'Gizli bir yeteneğin var mı?',
  'En sevdiğin çizgi film karakteri kim?', 'Bir gün görünmez olsan ne yapardın?', 'Hiç bir oyunda hile yaptın mı?',
  'En garip yemek kombinasyonun ne?', 'Çocukken ne olmak istiyordun?', 'Bu sunucudaki en komik kişi sence kim?',
  'En son hangi şarkıyı tekrar tekrar dinledin?', 'Hiç sınavda kopya çektin mi?', 'Hayatında yaptığın en çılgın şey neydi?',
  'En çok korktuğun şey ne?', 'Bir ünlüyle bir gün geçirebilsen kim olurdu?', 'En sevmediğin yemek ne?',
  'Telefonunda en çok vakit geçirdiğin uygulama hangisi?', 'Gece kaçta uyuyorsun, dürüst ol!', 'Hiç birine gizlice hayranlık duydun mu?',
  'Boyozu neyle yemeyi seversin?', 'Hayatında hiç kaybolduğun oldu mu?', 'İlk kullandığın Discord adı neydi?',
];
const DARES = [
  'Sonraki 3 mesajını sadece büyük harfle yaz.', 'Bu kanala en sevdiğin emojiyi 10 kez gönder.', 'Profil durumunu 10 dakikalığına "Boyoz yiyorum 🥐" yap.',
  'Bir sonraki mesajını tersten yaz.', 'Sunucuda rastgele birine iltifat et.', 'En son çektiğin (uygun) fotoğrafı anlat.',
  'Bir dakika boyunca sadece emojiyle konuş.', 'En sevdiğin şarkının ilk iki dizesini yaz.', 'Kendini 3 kelimeyle anlat.',
  'Bir hayvan taklidini yazıyla yap.', 'Sonraki mesajını şiir gibi kafiyeli yaz.', 'Sunucudaki birine komik bir lakap tak (kibar ol!).',
  'Bir tekerleme yaz ve hiç hata yapmadan bitir.', 'En kötü esprini yap.', 'Klavyeni görmeden "boyoz sistem en iyi bot" yaz.',
  '"Ben bir boyozum" cümlesini 5 farklı dilde yazmaya çalış.', 'Takma adını 10 dakikalığına komik bir şey yap.', 'Bir sonraki mesajında sadece soru sor.',
  'Ses kanalındaysan 10 saniye şarkı söyle.', 'Kendine bir süper kahraman adı uydur ve gücünü anlat.', 'Bir ünlü taklidi yap (yazıyla).',
];

// Hangisini tercih ederdin
const WOULD_YOU_RATHER = [
  ['Ömür boyu sadece boyoz yemek', 'Ömür boyu hiç boyoz yememek'], ['Uçabilmek', 'Görünmez olabilmek'],
  ['Geçmişe gidebilmek', 'Geleceğe gidebilmek'], ['Hiç uyumamak', 'Hiç yemek yememek'], ['Denizde yaşamak', 'Dağda yaşamak'],
  ['Her dili konuşabilmek', 'Her enstrümanı çalabilmek'], ['İnternetsiz 1 ay', 'Arkadaşsız 1 ay'], ['Hep yaz', 'Hep kış'],
  ['Zihin okuyabilmek', 'Geleceği görebilmek'], ['Ünlü olmak', 'Zengin olmak'], ['Kedi', 'Köpek'], ['Çay', 'Kahve'],
  ['Hayvanlarla konuşabilmek', 'Bitkilerle konuşabilmek'], ['Sadece fısıldayarak konuşmak', 'Sadece bağırarak konuşmak'],
  ['10 yıl önceye dönmek', '10 yıl sonrasını görmek'], ['Bilgisayar oyunları', 'Masa oyunları'], ['Sabahçı olmak', 'Gece kuşu olmak'],
  ['Telefonsuz 1 hafta', 'Müziksiz 1 hafta'], ['Süper hız', 'Süper güç'], ['Uzayda yaşamak', 'Okyanusun dibinde yaşamak'],
  ['Hiç hasta olmamak', 'Hiç yorulmamak'], ['Pizza', 'Hamburger'], ['Film izlemek', 'Dizi izlemek'], ['Kumsal tatili', 'Kayak tatili'],
  ['Her gün yağmur', 'Her gün aşırı sıcak'], ['Bir ejderhaya sahip olmak', 'Bir robota sahip olmak'],
];

// Kahve falı
const FORTUNES = [
  'Fincanında bir kuş görüyorum, yakında güzel bir haber alacaksın. 🕊️', 'Yolun açık görünüyor, kısa bir seyahat kapıda. ✈️',
  'Kalbinde bir ağırlık var ama üç vakte kadar ferahlayacaksın. 💛', 'Bir boyoz şekli var... Bu çok şanslı bir işaret! 🥐',
  'Karşına beklemediğin bir fırsat çıkacak, kaçırma. 🍀', 'Seni çekemeyen biri var ama nazarı tutmayacak. 🧿',
  'Yakında cüzdanın kabaracak, harcarken dikkat et. 💰', 'Bir dostundan sürpriz bir mesaj geliyor. 💌',
  'Fincanın dibinde bir yol var; yeni bir maceraya atılacaksın. 🗺️', 'Kısmetin açılıyor, ama önce sabır lazım. ⏳',
  'Bir dağ görüyorum; zorlukları aşıp zirveye çıkacaksın. ⛰️', 'Evinde bir kutlama olacak, hazırlıklı ol. 🎉',
];

module.exports = { FLAGS, EMOJI_PUZZLES, TYPE_PHRASES, WORDS, WORDLE_WORDS, TRUTHS, DARES, WOULD_YOU_RATHER, FORTUNES };
