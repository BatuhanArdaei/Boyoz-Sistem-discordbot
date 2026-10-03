// Futbolcu tahmin oyunu verisi.
// n: tam ad, a: kabul edilen cevaplar, c: ülke kodu (flagcdn.com), u: uyruk, p: mevki, s: profesyonel kariyerine başladığı kulüp,
// y: doğum yılı, d: vefat yılı (varsa), da: vefat yaşı (yıl farkı tutmuyorsa), k: forma giydiği diğer kulüplerden bazıları (sıralı), f: ipucu olarak verilecek bilgi
// Not: "Şu anki takım" bilgisi bilinçli olarak yok; transferlerle eskiyebilir.
const LIST = [
  // ---------------- Türk futbolcular
  { n: 'Hakan Şükür', a: ['hakan sukur', 'sukur'], c: 'tr', u: 'Türkiye', p: 'Forvet', s: 'Sakaryaspor', y: 1971, k: ['Bursaspor', 'Galatasaray', 'Inter', 'Parma', 'Blackburn Rovers'], f: 'Dünya Kupası tarihinin en hızlı golünü attı (11 saniye, 2002).' },
  { n: 'Rüştü Reçber', a: ['rustu recber', 'rustu'], c: 'tr', u: 'Türkiye', p: 'Kaleci', s: 'Antalyaspor', y: 1973, k: ['Fenerbahçe', 'Barcelona', 'Beşiktaş'], f: '2002 Dünya Kupası\'nda turnuvanın en iyi 11\'ine seçildi.' },
  { n: 'Emre Belözoğlu', a: ['emre belozoglu', 'emre', 'belozoglu'], c: 'tr', u: 'Türkiye', p: 'Orta saha', s: 'Galatasaray', y: 1980, k: ['Inter', 'Newcastle United', 'Fenerbahçe', 'Atlético Madrid', 'Başakşehir'], f: '2000 yılında UEFA Kupası\'nı kazanan takımda genç yaşta forma giydi.' },
  { n: 'Arda Turan', a: ['arda turan', 'arda', 'turan'], c: 'tr', u: 'Türkiye', p: 'Orta saha', s: 'Galatasaray', y: 1987, k: ['Atlético Madrid', 'Barcelona', 'Başakşehir'], f: 'Atlético Madrid ile 2014\'te La Liga şampiyonu oldu.' },
  { n: 'Hakan Çalhanoğlu', a: ['hakan calhanoglu', 'calhanoglu'], c: 'tr', u: 'Türkiye', p: 'Orta saha', s: 'Karlsruher SC', y: 1994, k: ['Hamburg', 'Bayer Leverkusen', 'Milan', 'Inter'], f: 'Serbest vuruş ustası; Milan\'dan şehir rakibine bedelsiz transfer oldu.' },
  { n: 'Arda Güler', a: ['arda guler', 'guler'], c: 'tr', u: 'Türkiye', p: 'Orta saha', s: 'Gençlerbirliği', y: 2005, k: ['Fenerbahçe', 'Real Madrid'], f: 'EURO 2024\'te Gürcistan\'a attığı uzak mesafe golüyle konuşuldu.' },
  { n: 'Kenan Yıldız', a: ['kenan yildiz', 'kenan', 'yildiz'], c: 'tr', u: 'Türkiye', p: 'Forvet', s: 'Juventus', y: 2005, k: [], f: 'Bayern Münih altyapısından yetişti, Torino ekibinde 10 numarayı giydi.' },
  { n: 'Burak Yılmaz', a: ['burak yilmaz', 'burak'], c: 'tr', u: 'Türkiye', p: 'Forvet', s: 'Antalyaspor', y: 1985, k: ['Beşiktaş', 'Fenerbahçe', 'Trabzonspor', 'Galatasaray', 'Lille'], f: 'Lille ile 2021\'de Fransa Ligue 1 şampiyonu oldu.' },
  { n: 'Ferdi Kadıoğlu', a: ['ferdi kadioglu', 'ferdi', 'kadioglu'], c: 'tr', u: 'Türkiye', p: 'Defans', s: 'NEC Nijmegen', y: 1999, k: ['Fenerbahçe', 'Brighton'], f: 'Hollanda doğumlu; EURO 2024\'te sol bekte parladı.' },
  { n: 'Tuncay Şanlı', a: ['tuncay sanli', 'tuncay'], c: 'tr', u: 'Türkiye', p: 'Forvet', s: 'Sakaryaspor', y: 1982, k: ['Fenerbahçe', 'Middlesbrough', 'Stoke City', 'Wolfsburg'], f: 'Fenerbahçe formasıyla Manchester United\'a hat-trick yaptı (2004).' },
  { n: 'Nihat Kahveci', a: ['nihat kahveci', 'nihat'], c: 'tr', u: 'Türkiye', p: 'Forvet', s: 'Beşiktaş', y: 1979, k: ['Real Sociedad', 'Villarreal'], f: 'EURO 2008\'de Çekya maçında son dakikalarda 2 gol attı.' },
  { n: 'Kerem Aktürkoğlu', a: ['kerem akturkoglu', 'kerem', 'akturkoglu'], c: 'tr', u: 'Türkiye', p: 'Kanat', s: '24 Erzincanspor', y: 1998, k: ['Galatasaray', 'Benfica'], f: 'Alt liglerden yükselip Süper Lig\'de şampiyonluk yaşadı.' },
  { n: 'Barış Alper Yılmaz', a: ['baris alper yilmaz', 'baris alper'], c: 'tr', u: 'Türkiye', p: 'Kanat', s: 'Ankara Keçiörengücü', y: 2000, k: ['Galatasaray'], f: 'Hem kanatta hem forvette oynayabilen hızlı bir oyuncu; 1. Lig\'den Süper Lig\'e transfer oldu.' },

  // ---------------- Süper Lig'de oynamış yabancılar
  { n: 'Alex de Souza', a: ['alex de souza', 'alex'], c: 'br', u: 'Brezilya', p: 'Orta saha', s: 'Coritiba', y: 1977, k: ['Palmeiras', 'Cruzeiro', 'Fenerbahçe'], f: 'Fenerbahçe\'de uzun yıllar kaptanlık yapan efsane 10 numara.' },
  { n: 'Gheorghe Hagi', a: ['gheorghe hagi', 'hagi'], c: 'ro', u: 'Romanya', p: 'Orta saha', s: 'FC Constanța', y: 1965, k: ['Steaua Bükreş', 'Real Madrid', 'Brescia', 'Barcelona', 'Galatasaray'], f: '"Karpatların Maradonası" lakaplı; 2000\'de UEFA Kupası kazandı.' },
  { n: 'Didier Drogba', a: ['didier drogba', 'drogba'], c: 'ci', u: 'Fildişi Sahili', p: 'Forvet', s: 'Le Mans', y: 1978, k: ['Guingamp', 'Marseille', 'Chelsea', 'Shanghai Shenhua', 'Galatasaray'], f: '2012 Şampiyonlar Ligi finalinde son dakika golü ve kazandıran penaltı.' },
  { n: 'Wesley Sneijder', a: ['wesley sneijder', 'sneijder'], c: 'nl', u: 'Hollanda', p: 'Orta saha', s: 'Ajax', y: 1984, k: ['Real Madrid', 'Inter', 'Galatasaray'], f: '2010\'da Inter ile üçlü kupa kazandı, aynı yıl Dünya Kupası finali oynadı.' },
  { n: 'Ricardo Quaresma', a: ['ricardo quaresma', 'quaresma'], c: 'pt', u: 'Portekiz', p: 'Kanat', s: 'Sporting CP', y: 1983, k: ['Barcelona', 'Porto', 'Inter', 'Beşiktaş'], f: 'Dış ayakla attığı "trivela" vuruşlarıyla ünlü.' },
  { n: 'Roberto Carlos', a: ['roberto carlos'], c: 'br', u: 'Brezilya', p: 'Defans', s: 'União São João', y: 1973, k: ['Palmeiras', 'Inter', 'Real Madrid', 'Fenerbahçe'], f: '1997\'de Fransa\'ya attığı fizik kurallarını zorlayan frikik golüyle ünlü.' },
  { n: 'Robin van Persie', a: ['robin van persie', 'van persie', 'rvp'], c: 'nl', u: 'Hollanda', p: 'Forvet', s: 'Feyenoord', y: 1983, k: ['Arsenal', 'Manchester United', 'Fenerbahçe'], f: '2014 Dünya Kupası\'nda İspanya\'ya attığı "uçan Hollandalı" kafa golü.' },
  { n: 'Mesut Özil', a: ['mesut ozil', 'ozil', 'mesut'], c: 'de', u: 'Almanya', p: 'Orta saha', s: 'Schalke 04', y: 1988, k: ['Werder Bremen', 'Real Madrid', 'Arsenal', 'Fenerbahçe', 'Başakşehir'], f: '2014 Dünya Kupası\'nı kazandı; asist ustası.' },
  { n: 'Lukas Podolski', a: ['lukas podolski', 'podolski'], c: 'de', u: 'Almanya', p: 'Forvet', s: '1. FC Köln', y: 1985, k: ['Bayern Münih', 'Arsenal', 'Inter', 'Galatasaray', 'Vissel Kobe'], f: 'Polonya doğumlu; 2014 Dünya Kupası şampiyonu.' },
  { n: 'Fernando Muslera', a: ['fernando muslera', 'muslera'], c: 'uy', u: 'Uruguay', p: 'Kaleci', s: 'Montevideo Wanderers', y: 1986, k: ['Lazio', 'Galatasaray'], f: '2010 Dünya Kupası\'nda Uruguay\'ı yarı finale taşıyan kaleci.' },
  { n: 'Mauro Icardi', a: ['mauro icardi', 'icardi'], c: 'ar', u: 'Arjantin', p: 'Forvet', s: 'Sampdoria', y: 1993, k: ['Inter', 'Paris Saint-Germain', 'Galatasaray'], f: 'Barcelona altyapısından geçti; Inter\'de kaptanlık yaptı.' },
  { n: 'Victor Osimhen', a: ['victor osimhen', 'osimhen'], c: 'ng', u: 'Nijerya', p: 'Forvet', s: 'Wolfsburg', y: 1998, k: ['Charleroi', 'Lille', 'Napoli', 'Galatasaray'], f: 'Napoli\'nin 33 yıllık şampiyonluk hasretini bitiren takımın golcüsü; maskesiyle tanınır.' },
  { n: 'Edin Džeko', a: ['edin dzeko', 'dzeko'], c: 'ba', u: 'Bosna-Hersek', p: 'Forvet', s: 'Željezničar', y: 1986, k: ['Teplice', 'Wolfsburg', 'Manchester City', 'Roma', 'Inter', 'Fenerbahçe'], f: 'Wolfsburg ile 2009\'da Bundesliga şampiyonu oldu, ertesi sezon gol kralı.' },
  { n: 'Dušan Tadić', a: ['dusan tadic', 'tadic'], c: 'rs', u: 'Sırbistan', p: 'Kanat', s: 'Vojvodina', y: 1988, k: ['Groningen', 'Twente', 'Southampton', 'Ajax', 'Fenerbahçe'], f: 'Ajax\'la 2019\'da Şampiyonlar Ligi yarı finaline yükseldi.' },

  // ---------------- Dünya yıldızları
  { n: 'Lionel Messi', a: ['lionel messi', 'messi', 'leo messi'], c: 'ar', u: 'Arjantin', p: 'Forvet', s: 'Barcelona', y: 1987, k: ['Paris Saint-Germain', 'Inter Miami'], f: '2022 Dünya Kupası\'nı kazandı; Ballon d\'Or rekortmeni.' },
  { n: 'Cristiano Ronaldo', a: ['cristiano ronaldo', 'cristiano', 'ronaldo', 'cr7'], c: 'pt', u: 'Portekiz', p: 'Forvet', s: 'Sporting CP', y: 1985, k: ['Manchester United', 'Real Madrid', 'Juventus', 'Al Nassr'], f: 'Portekiz ile EURO 2016\'yı kazandı; Şampiyonlar Ligi\'nin en golcü oyuncusu.' },
  { n: 'Neymar', a: ['neymar', 'neymar jr'], c: 'br', u: 'Brezilya', p: 'Forvet', s: 'Santos', y: 1992, k: ['Barcelona', 'Paris Saint-Germain', 'Al Hilal'], f: 'Futbol tarihinin en pahalı transferi (222 milyon €).' },
  { n: 'Kylian Mbappé', a: ['kylian mbappe', 'mbappe'], c: 'fr', u: 'Fransa', p: 'Forvet', s: 'Monaco', y: 1998, k: ['Paris Saint-Germain', 'Real Madrid'], f: '19 yaşında Dünya Kupası kazandı; 2022 finalinde hat-trick yaptı.' },
  { n: 'Erling Haaland', a: ['erling haaland', 'haaland'], c: 'no', u: 'Norveç', p: 'Forvet', s: 'Bryne', y: 2000, k: ['Molde', 'Red Bull Salzburg', 'Borussia Dortmund', 'Manchester City'], f: 'Premier Lig\'de tek sezonda 36 golle rekor kırdı (2022-23).' },
  { n: 'Mohamed Salah', a: ['mohamed salah', 'salah', 'muhammed salah'], c: 'eg', u: 'Mısır', p: 'Kanat', s: 'Al Mokawloon', y: 1992, k: ['Basel', 'Chelsea', 'Fiorentina', 'Roma', 'Liverpool'], f: '"Mısır Kralı" lakaplı; Liverpool ile hem Şampiyonlar Ligi hem Premier Lig kazandı.' },
  { n: 'Kevin De Bruyne', a: ['kevin de bruyne', 'de bruyne', 'kdb'], c: 'be', u: 'Belçika', p: 'Orta saha', s: 'Genk', y: 1991, k: ['Chelsea', 'Wolfsburg', 'Manchester City'], f: 'Premier Lig\'in tek sezonda en çok asist rekorunu paylaşır (20).' },
  { n: 'Luka Modrić', a: ['luka modric', 'modric'], c: 'hr', u: 'Hırvatistan', p: 'Orta saha', s: 'Dinamo Zagreb', y: 1985, k: ['Tottenham', 'Real Madrid'], f: '2018\'de Ballon d\'Or kazanarak Messi-Ronaldo serisini bozdu.' },
  { n: 'Zlatan İbrahimović', a: ['zlatan ibrahimovic', 'zlatan', 'ibrahimovic'], c: 'se', u: 'İsveç', p: 'Forvet', s: 'Malmö FF', y: 1981, k: ['Ajax', 'Juventus', 'Inter', 'Barcelona', 'Milan', 'Paris Saint-Germain', 'Manchester United'], f: 'İngiltere\'ye attığı rövaşata golüyle Puskás Ödülü kazandı.' },
  { n: 'Thierry Henry', a: ['thierry henry', 'henry'], c: 'fr', u: 'Fransa', p: 'Forvet', s: 'Monaco', y: 1977, k: ['Juventus', 'Arsenal', 'Barcelona', 'New York Red Bulls'], f: 'Arsenal\'in "Yenilmezler" takımının yıldızı ve kulübün en golcü oyuncusu.' },
  { n: 'Zinedine Zidane', a: ['zinedine zidane', 'zidane', 'zizou'], c: 'fr', u: 'Fransa', p: 'Orta saha', s: 'Cannes', y: 1972, k: ['Bordeaux', 'Juventus', 'Real Madrid'], f: '1998 Dünya Kupası finalinde 2 kafa golü attı.' },
  { n: 'Ronaldinho', a: ['ronaldinho', 'ronaldinho gaucho'], c: 'br', u: 'Brezilya', p: 'Orta saha', s: 'Grêmio', y: 1980, k: ['Paris Saint-Germain', 'Barcelona', 'Milan'], f: 'Santiago Bernabéu\'da Real Madrid taraftarlarından ayakta alkış aldı (2005).' },
  { n: 'Ronaldo Nazário', a: ['ronaldo nazario', 'r9', 'ronaldo lima'], c: 'br', u: 'Brezilya', p: 'Forvet', s: 'Cruzeiro', y: 1976, k: ['PSV', 'Barcelona', 'Inter', 'Real Madrid', 'Milan'], f: '"Fenomen" lakaplı; 2002 Dünya Kupası\'nda 8 golle gol kralı oldu.' },
  { n: 'Kaká', a: ['kaka', 'ricardo kaka'], c: 'br', u: 'Brezilya', p: 'Orta saha', s: 'São Paulo', y: 1982, k: ['Milan', 'Real Madrid', 'Orlando City'], f: '2007\'de Ballon d\'Or kazandı.' },
  { n: 'Andrés Iniesta', a: ['andres iniesta', 'iniesta'], c: 'es', u: 'İspanya', p: 'Orta saha', s: 'Barcelona', y: 1984, k: ['Vissel Kobe'], f: '2010 Dünya Kupası finalinde şampiyonluk golünü attı.' },
  { n: 'Xavi Hernández', a: ['xavi', 'xavi hernandez'], c: 'es', u: 'İspanya', p: 'Orta saha', s: 'Barcelona', y: 1980, k: ['Al Sadd'], f: 'Pas ustası; sonrasında yetiştiği kulübün teknik direktörü oldu.' },
  { n: 'Sergio Ramos', a: ['sergio ramos', 'ramos'], c: 'es', u: 'İspanya', p: 'Defans', s: 'Sevilla', y: 1986, k: ['Real Madrid', 'Paris Saint-Germain'], f: '2014 Şampiyonlar Ligi finalinde 93. dakikada attığı kafa golü.' },
  { n: 'Gerard Piqué', a: ['gerard pique', 'pique'], c: 'es', u: 'İspanya', p: 'Defans', s: 'Manchester United', y: 1987, k: ['Real Zaragoza', 'Barcelona'], f: 'Barcelona ile iki kez üçlü kupa kazandı.' },
  { n: 'Paolo Maldini', a: ['paolo maldini', 'maldini'], c: 'it', u: 'İtalya', p: 'Defans', s: 'Milan', y: 1968, k: [], f: 'Tüm kariyerini tek kulüpte geçirdi; 5 kez Avrupa\'nın en büyük kupasını kaldırdı.' },
  { n: 'Andrea Pirlo', a: ['andrea pirlo', 'pirlo'], c: 'it', u: 'İtalya', p: 'Orta saha', s: 'Brescia', y: 1979, k: ['Inter', 'Milan', 'Juventus', 'New York City'], f: '2006 Dünya Kupası şampiyonu; "Mimar" lakaplı.' },
  { n: 'Gianluigi Buffon', a: ['gianluigi buffon', 'buffon', 'gigi buffon'], c: 'it', u: 'İtalya', p: 'Kaleci', s: 'Parma', y: 1978, k: ['Juventus', 'Paris Saint-Germain'], f: '2006 Dünya Kupası\'nı kazandı; kaleci için rekor bonservisle transfer oldu (2001).' },
  { n: 'Francesco Totti', a: ['francesco totti', 'totti'], c: 'it', u: 'İtalya', p: 'Forvet', s: 'Roma', y: 1976, k: [], f: 'Tüm kariyerini doğduğu şehrin kulübünde geçirdi; "Kral" lakaplı.' },
  { n: 'Wayne Rooney', a: ['wayne rooney', 'rooney'], c: 'gb-eng', u: 'İngiltere', p: 'Forvet', s: 'Everton', y: 1985, k: ['Manchester United', 'DC United', 'Derby County'], f: 'Manchester United\'ın tüm zamanların en golcü oyuncusu.' },
  { n: 'David Beckham', a: ['david beckham', 'beckham'], c: 'gb-eng', u: 'İngiltere', p: 'Orta saha', s: 'Manchester United', y: 1975, k: ['Real Madrid', 'LA Galaxy', 'Milan', 'Paris Saint-Germain'], f: 'Orta yuvarlaktan attığı golle tanındı; sonra MLS\'te kendi kulübünü kurdu.' },
  { n: 'Steven Gerrard', a: ['steven gerrard', 'gerrard'], c: 'gb-eng', u: 'İngiltere', p: 'Orta saha', s: 'Liverpool', y: 1980, k: ['LA Galaxy'], f: '2005 İstanbul finalinde 3-0\'dan dönüşü başlatan golü attı.' },
  { n: 'Frank Lampard', a: ['frank lampard', 'lampard'], c: 'gb-eng', u: 'İngiltere', p: 'Orta saha', s: 'West Ham', y: 1978, k: ['Chelsea', 'Manchester City', 'New York City'], f: 'Chelsea\'nin tüm zamanların en golcü oyuncusu (orta saha olarak!).' },
  { n: 'Harry Kane', a: ['harry kane', 'kane'], c: 'gb-eng', u: 'İngiltere', p: 'Forvet', s: 'Tottenham', y: 1993, k: ['Bayern Münih'], f: 'İngiltere milli takımının tüm zamanların en golcü oyuncusu.' },
  { n: 'Jude Bellingham', a: ['jude bellingham', 'bellingham'], c: 'gb-eng', u: 'İngiltere', p: 'Orta saha', s: 'Birmingham City', y: 2003, k: ['Borussia Dortmund', 'Real Madrid'], f: 'İlk kulübü, giydiği 22 numaralı formayı emekliye ayırdı.' },
  { n: 'Phil Foden', a: ['phil foden', 'foden'], c: 'gb-eng', u: 'İngiltere', p: 'Orta saha', s: 'Manchester City', y: 2000, k: [], f: 'Çocukken taraftarı olduğu kulübün altyapısından çıkıp yıldız oldu.' },
  { n: 'Cole Palmer', a: ['cole palmer', 'palmer'], c: 'gb-eng', u: 'İngiltere', p: 'Orta saha', s: 'Manchester City', y: 2002, k: ['Chelsea'], f: '"Cold Palmer" lakabı ve gol sevinciyle tanınır.' },
  { n: 'Gareth Bale', a: ['gareth bale', 'bale'], c: 'gb-wls', u: 'Galler', p: 'Kanat', s: 'Southampton', y: 1989, k: ['Tottenham', 'Real Madrid', 'Los Angeles FC'], f: '2018 Şampiyonlar Ligi finalinde rövaşata golü attı.' },
  { n: 'Ryan Giggs', a: ['ryan giggs', 'giggs'], c: 'gb-wls', u: 'Galler', p: 'Kanat', s: 'Manchester United', y: 1973, k: [], f: 'Premier Lig\'i rekor 13 kez kazandı; tüm kariyeri tek kulüpte.' },
  { n: 'Luís Figo', a: ['luis figo', 'figo'], c: 'pt', u: 'Portekiz', p: 'Kanat', s: 'Sporting CP', y: 1972, k: ['Barcelona', 'Real Madrid', 'Inter'], f: 'Ezeli rakibe olay transferi yaptı; 2000\'de Ballon d\'Or kazandı.' },
  { n: 'Bruno Fernandes', a: ['bruno fernandes', 'bruno'], c: 'pt', u: 'Portekiz', p: 'Orta saha', s: 'Novara', y: 1994, k: ['Udinese', 'Sampdoria', 'Sporting CP', 'Manchester United'], f: 'Profesyonel kariyerine İtalya\'nın alt liginde başladı.' },
  { n: 'Virgil van Dijk', a: ['virgil van dijk', 'van dijk', 'vvd'], c: 'nl', u: 'Hollanda', p: 'Defans', s: 'Groningen', y: 1991, k: ['Celtic', 'Southampton', 'Liverpool'], f: '2019\'da Ballon d\'Or oylamasında ikinci oldu (bir defans oyuncusu olarak).' },
  { n: 'Johan Cruyff', a: ['johan cruyff', 'cruyff', 'cruijff'], c: 'nl', u: 'Hollanda', p: 'Forvet', s: 'Ajax', y: 1947, d: 2016, k: ['Barcelona', 'Feyenoord'], f: '"Total futbol"un simgesi; adını taşıyan bir çalım hareketi var.' },
  { n: 'Marco van Basten', a: ['marco van basten', 'van basten'], c: 'nl', u: 'Hollanda', p: 'Forvet', s: 'Ajax', y: 1964, k: ['Milan'], f: 'EURO 1988 finalinde imkânsız açıdan vole golü attı.' },
  { n: 'Dennis Bergkamp', a: ['dennis bergkamp', 'bergkamp'], c: 'nl', u: 'Hollanda', p: 'Forvet', s: 'Ajax', y: 1969, k: ['Inter', 'Arsenal'], f: 'Uçak korkusu yüzünden "Uçmayan Hollandalı" diye anıldı.' },
  { n: 'Ruud Gullit', a: ['ruud gullit', 'gullit'], c: 'nl', u: 'Hollanda', p: 'Orta saha', s: 'HFC Haarlem', y: 1962, k: ['Feyenoord', 'PSV', 'Milan', 'Sampdoria', 'Chelsea'], f: '1987\'de Ballon d\'Or kazandı; rasta saçlarıyla ünlü.' },
  { n: 'Luis Suárez', a: ['luis suarez', 'suarez'], c: 'uy', u: 'Uruguay', p: 'Forvet', s: 'Nacional', y: 1987, k: ['Groningen', 'Ajax', 'Liverpool', 'Barcelona', 'Atlético Madrid', 'Grêmio', 'Inter Miami'], f: 'Barcelona\'da "MSN" üçlüsünün parçasıydı.' },
  { n: 'Karim Benzema', a: ['karim benzema', 'benzema'], c: 'fr', u: 'Fransa', p: 'Forvet', s: 'Lyon', y: 1987, k: ['Real Madrid', 'Al Ittihad'], f: '2022\'de Ballon d\'Or kazandı.' },
  { n: 'Antoine Griezmann', a: ['antoine griezmann', 'griezmann'], c: 'fr', u: 'Fransa', p: 'Forvet', s: 'Real Sociedad', y: 1991, k: ['Atlético Madrid', 'Barcelona'], f: '2018 Dünya Kupası finalinde penaltı golü attı, maçın oyuncusu seçildi.' },
  { n: 'N\'Golo Kanté', a: ['ngolo kante', 'kante', 'n golo kante'], c: 'fr', u: 'Fransa', p: 'Orta saha', s: 'Boulogne', y: 1991, k: ['Caen', 'Leicester City', 'Chelsea', 'Al Ittihad'], f: 'Leicester City\'nin 5000\'de 1 ihtimalle gelen şampiyonluğunun yıldızı.' },
  { n: 'Vinícius Júnior', a: ['vinicius junior', 'vinicius', 'vini jr', 'vinicius jr'], c: 'br', u: 'Brezilya', p: 'Kanat', s: 'Flamengo', y: 2000, k: ['Real Madrid'], f: '2022 Şampiyonlar Ligi finalinde tek golü attı.' },
  { n: 'Lamine Yamal', a: ['lamine yamal', 'yamal'], c: 'es', u: 'İspanya', p: 'Kanat', s: 'Barcelona', y: 2007, k: [], f: 'EURO 2024\'ü 17 yaşında kazanıp turnuvanın en iyi genç oyuncusu seçildi.' },
  { n: 'Pedri', a: ['pedri', 'pedro gonzalez'], c: 'es', u: 'İspanya', p: 'Orta saha', s: 'Las Palmas', y: 2002, k: ['Barcelona'], f: 'Kanarya Adaları\'ndan çıkıp Golden Boy ödülünü kazandı (2021).' },
  { n: 'Rodri', a: ['rodri', 'rodrigo hernandez'], c: 'es', u: 'İspanya', p: 'Orta saha', s: 'Villarreal', y: 1996, k: ['Atlético Madrid', 'Manchester City'], f: '2024 Ballon d\'Or sahibi; 2023 Şampiyonlar Ligi finalinde golü attı.' },
  { n: 'Iker Casillas', a: ['iker casillas', 'casillas'], c: 'es', u: 'İspanya', p: 'Kaleci', s: 'Real Madrid', y: 1981, k: ['Porto'], f: 'Kaptan olarak hem Dünya Kupası hem 2 Avrupa Şampiyonası kaldırdı.' },
  { n: 'Manuel Neuer', a: ['manuel neuer', 'neuer'], c: 'de', u: 'Almanya', p: 'Kaleci', s: 'Schalke 04', y: 1986, k: ['Bayern Münih'], f: '"Libero kaleci" tarzının öncüsü; 2014 Dünya Kupası şampiyonu.' },
  { n: 'Oliver Kahn', a: ['oliver kahn', 'kahn'], c: 'de', u: 'Almanya', p: 'Kaleci', s: 'Karlsruher SC', y: 1969, k: ['Bayern Münih'], f: '2002 Dünya Kupası\'nda turnuvanın en iyi oyuncusu seçilen ilk kaleci.' },
  { n: 'Franz Beckenbauer', a: ['franz beckenbauer', 'beckenbauer', 'kaiser'], c: 'de', u: 'Almanya', p: 'Defans', s: 'Bayern Münih', y: 1945, d: 2024, da: 78, k: ['New York Cosmos', 'Hamburg'], f: '"Kaiser" lakaplı; Dünya Kupası\'nı hem oyuncu hem teknik direktör olarak kazandı.' },
  { n: 'Pelé', a: ['pele', 'edson arantes'], c: 'br', u: 'Brezilya', p: 'Forvet', s: 'Santos', y: 1940, d: 2022, k: ['New York Cosmos'], f: '3 Dünya Kupası kazanan tek futbolcu.' },
  { n: 'Diego Maradona', a: ['diego maradona', 'maradona'], c: 'ar', u: 'Arjantin', p: 'Orta saha', s: 'Argentinos Juniors', y: 1960, d: 2020, k: ['Boca Juniors', 'Barcelona', 'Napoli', 'Sevilla'], f: '1986\'da İngiltere\'ye "Tanrı\'nın Eli" golünü ve "Yüzyılın Golü"nü attı.' },
  { n: 'Lautaro Martínez', a: ['lautaro martinez', 'lautaro'], c: 'ar', u: 'Arjantin', p: 'Forvet', s: 'Racing Club', y: 1997, k: ['Inter'], f: '"Boğa" lakaplı; 2024 Copa América\'da gol kralı oldu.' },
  { n: 'Julián Álvarez', a: ['julian alvarez', 'alvarez'], c: 'ar', u: 'Arjantin', p: 'Forvet', s: 'River Plate', y: 2000, k: ['Manchester City', 'Atlético Madrid'], f: '"Örümcek" lakaplı; 2022 Dünya Kupası\'nda 4 gol attı.' },
  { n: 'Cafu', a: ['cafu'], c: 'br', u: 'Brezilya', p: 'Defans', s: 'São Paulo', y: 1970, k: ['Real Zaragoza', 'Palmeiras', 'Roma', 'Milan'], f: 'Üst üste 3 Dünya Kupası finali oynayan tek oyuncu.' },
  { n: 'Romário', a: ['romario'], c: 'br', u: 'Brezilya', p: 'Forvet', s: 'Vasco da Gama', y: 1966, k: ['PSV', 'Barcelona', 'Valencia', 'Flamengo'], f: '1994 Dünya Kupası\'nın en iyi oyuncusu seçildi.' },
  { n: 'Ferenc Puskás', a: ['ferenc puskas', 'puskas'], c: 'hu', u: 'Macaristan', p: 'Forvet', s: 'Kispest Honvéd', y: 1927, d: 2006, k: ['Real Madrid'], f: 'FIFA\'nın yılın en güzel golü ödülü onun adını taşır.' },
  { n: 'Son Heung-min', a: ['son heung min', 'son', 'heung min son'], c: 'kr', u: 'Güney Kore', p: 'Forvet', s: 'Hamburg', y: 1992, k: ['Bayer Leverkusen', 'Tottenham'], f: 'Premier Lig gol krallığını paylaşan ilk Asyalı oyuncu (2021-22).' },
];

// Kategoriler: 'eski' = Eski Yıldızlar (futbolu bırakmış), 'karam' = KARAM TAYFA (2000-2008 Milli Takım kuşağı)
const KARAM = ['Hakan Şükür', 'Rüştü Reçber', 'Emre Belözoğlu', 'Tuncay Şanlı', 'Nihat Kahveci', 'Arda Turan'];
const ESKI = [
  ...KARAM, 'Burak Yılmaz', 'Alex de Souza', 'Gheorghe Hagi', 'Didier Drogba', 'Wesley Sneijder', 'Roberto Carlos', 'Robin van Persie',
  'Mesut Özil', 'Zlatan İbrahimović', 'Thierry Henry', 'Zinedine Zidane', 'Ronaldinho', 'Ronaldo Nazário', 'Kaká', 'Andrés Iniesta',
  'Xavi Hernández', 'Gerard Piqué', 'Paolo Maldini', 'Andrea Pirlo', 'Gianluigi Buffon', 'Francesco Totti', 'Wayne Rooney', 'David Beckham',
  'Steven Gerrard', 'Frank Lampard', 'Gareth Bale', 'Ryan Giggs', 'Luís Figo', 'Johan Cruyff', 'Marco van Basten', 'Dennis Bergkamp',
  'Ruud Gullit', 'Iker Casillas', 'Oliver Kahn', 'Franz Beckenbauer', 'Pelé', 'Diego Maradona', 'Cafu', 'Romário', 'Ferenc Puskás',
];
for (const pl of LIST) {
  pl.t = [...(ESKI.includes(pl.n) ? ['eski'] : []), ...(KARAM.includes(pl.n) ? ['karam'] : [])];
}

const { leaguesOf } = require('./ligler');

// 1988'den önce doğduğu halde 2025 itibarıyla hâlâ oynadığı bilinenler ("güncel" kategorisi için)
const ACTIVE_VETERANS = ['Lionel Messi', 'Cristiano Ronaldo', 'Luka Modrić', 'Edin Džeko', 'Jamie Vardy', 'Fernando Muslera', 'Sergio Ramos', 'Luis Suárez'];

const ALL = [...LIST, ...require('./futbolcular-ek'), ...require('./futbolcular-ek2')];
for (const pl of ALL) {
  pl.t = [...new Set([...(pl.t || []), ...leaguesOf(pl)])];
  if (!pl.t.includes('eski') && (pl.y >= 1988 || ACTIVE_VETERANS.includes(pl.n))) pl.t.push('aktif');
}

module.exports = ALL;
