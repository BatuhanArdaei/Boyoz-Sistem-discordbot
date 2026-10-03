// Kulüp -> lig eşlemesi. Futbolcu tahmin oyununda "5 büyük lig" kategorileri, oyuncunun forma giydiği
// kulüplerden otomatik hesaplanır (o ligde bir kulüpte oynamışsa o kategoriye girer).
const LEAGUES = {
  pl: {
    label: '🏴 Premier Lig',
    clubs: ['Manchester United', 'Manchester City', 'Liverpool', 'Arsenal', 'Chelsea', 'Tottenham', 'Everton', 'West Ham', 'Newcastle United',
      'Aston Villa', 'Leicester City', 'Southampton', 'Blackburn Rovers', 'Crystal Palace', 'Brighton', 'Fulham', 'Leeds United', 'Nottingham Forest',
      'Stoke City', 'Middlesbrough', 'Bolton', 'Sunderland', 'Watford', 'Norwich City', 'Bournemouth', 'Brentford', 'West Bromwich Albion',
      'Sheffield United', 'Derby County', 'Coventry City'],
  },
  laliga: {
    label: '🇪🇸 La Liga',
    clubs: ['Barcelona', 'Real Madrid', 'Atlético Madrid', 'Sevilla', 'Valencia', 'Villarreal', 'Real Sociedad', 'Athletic Bilbao', 'Real Betis',
      'Deportivo La Coruña', 'Celta Vigo', 'Getafe', 'Mallorca', 'Málaga', 'Real Zaragoza', 'Sporting Gijón', 'Las Palmas', 'Almería'],
  },
  seriea: {
    label: '🇮🇹 Serie A',
    clubs: ['Juventus', 'Milan', 'Inter', 'Roma', 'Lazio', 'Napoli', 'Fiorentina', 'Atalanta', 'Parma', 'Sampdoria', 'Udinese', 'Brescia',
      'Bologna', 'Torino', 'Cagliari', 'Palermo', 'Perugia', 'Venezia', 'Sassuolo', 'Bari'],
  },
  bundesliga: {
    label: '🇩🇪 Bundesliga',
    clubs: ['Bayern Münih', 'Borussia Dortmund', 'Bayer Leverkusen', 'Schalke 04', 'Werder Bremen', 'Wolfsburg', 'Hamburg', 'VfB Stuttgart',
      'RB Leipzig', 'Eintracht Frankfurt', 'Borussia Mönchengladbach', '1. FC Köln', 'Hertha Berlin', 'Hoffenheim', 'Freiburg', 'Kaiserslautern',
      'Karlsruher SC', 'Hannover 96', 'Fortuna Düsseldorf', '1. FC Nürnberg', 'Union Berlin'],
  },
  ligue1: {
    label: '🇫🇷 Ligue 1',
    clubs: ['Paris Saint-Germain', 'Marseille', 'Lyon', 'Monaco', 'Lille', 'Rennes', 'Nice', 'Bordeaux', 'Saint-Étienne', 'Nantes', 'Auxerre',
      'Cannes', 'Toulouse', 'Sochaux', 'Caen', 'Guingamp', 'Le Mans', 'Nancy', 'Bastia', 'Le Havre'],
  },
};

// Oyuncunun oynadığı liglerin anahtarlarını döner
function leaguesOf(p) {
  const clubs = [p.s, p.sk, ...(p.k || [])].filter(Boolean);
  return Object.entries(LEAGUES).filter(([, l]) => clubs.some((c) => l.clubs.includes(c))).map(([key]) => key);
}

module.exports = { LEAGUES, leaguesOf };
