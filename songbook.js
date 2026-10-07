// Mitgelieferter Liederfundus: fertige Akkordfolgen zum Auswählen.
// Enthalten sind gemeinfreie Volks-, Kinder- und Weihnachtslieder, traditionelle
// Folk- und Bluesstücke sowie reine Übungen. Keine Texte und keine Noten,
// nur die Akkordfolgen, die du zum Üben greifst.
//
// level: 1 = nur leichte Griffe, 2 = etwas mehr Wechsel, 3 = mit Barré
// chords: die Folge, wie sie beim Üben rundherum wiederholt wird

export const CATEGORIES = [
  { key: 'uebung',   label: 'Übungen und Akkordwechsel' },
  { key: 'kinder',   label: 'Kinder- und Volkslieder' },
  { key: 'folk',     label: 'Folk und Traditionals' },
  { key: 'blues',    label: 'Blues und Rock’n’Roll' },
  { key: 'weihnacht', label: 'Weihnachtslieder' },
  { key: 'progression', label: 'Bekannte Akkordfolgen' },
];

export const SONGBOOK = [
  // ---- Übungen ----
  { id: 'u-em-am', cat: 'uebung', level: 1, title: 'Wechsel Em – Am',
    chords: ['Em', 'Am'], note: 'Die zwei leichtesten Griffe. Nur der Wechsel zählt, nicht das Tempo.' },
  { id: 'u-am-c', cat: 'uebung', level: 1, title: 'Wechsel Am – C',
    chords: ['Am', 'C'], note: 'Zeigefinger bleibt liegen, nur Mittel- und Ringfinger wandern.' },
  { id: 'u-g-d', cat: 'uebung', level: 1, title: 'Wechsel G – D',
    chords: ['G', 'D'], note: 'Der Klassiker für die Greifhand. Achte darauf, dass das Handgelenk locker bleibt.' },
  { id: 'u-vier', cat: 'uebung', level: 2, title: 'Die vier Anfängerakkorde',
    chords: ['Em', 'G', 'C', 'D'], note: 'Reihum. Damit lassen sich erstaunlich viele Lieder begleiten.' },
  { id: 'u-sieben', cat: 'uebung', level: 2, title: 'Sieben offene Akkorde',
    chords: ['Em', 'Am', 'G', 'C', 'D', 'E', 'A'], note: 'Rundgang durch alle offenen Griffe ohne Barré.' },
  { id: 'u-moll', cat: 'uebung', level: 2, title: 'Mollrunde',
    chords: ['Am', 'Dm', 'Em', 'Am'], note: 'Dm ist eng gegriffen, gute Übung für steile Finger.' },
  { id: 'u-sept', cat: 'uebung', level: 2, title: 'Septakkorde',
    chords: ['G7', 'C7', 'D7', 'A7', 'E7'], note: 'Klingen bluesig und sind gute Vorbereitung aufs Barré.' },
  { id: 'u-barre', cat: 'uebung', level: 3, title: 'Barré behutsam',
    chords: ['F', 'C', 'F', 'G'], note: 'Nur kurz üben. Wenn der Unterarm zieht, aufhören – genau davon kommen die Schmerzen.' },

  // ---- Kinder- und Volkslieder (gemeinfrei) ----
  { id: 'k-bruder', cat: 'kinder', level: 1, title: 'Bruder Jakob',
    chords: ['C', 'C'], note: 'Kanon über einem einzigen Akkord. Ideal zum Einstieg.' },
  { id: 'k-haenschen', cat: 'kinder', level: 1, title: 'Hänschen klein',
    chords: ['C', 'G', 'C'], note: 'Zwei Griffe genügen.' },
  { id: 'k-alle-voegel', cat: 'kinder', level: 2, title: 'Alle Vögel sind schon da',
    chords: ['G', 'C', 'G', 'D', 'G'] },
  { id: 'k-kuckuck', cat: 'kinder', level: 1, title: 'Kuckuck, Kuckuck',
    chords: ['C', 'G', 'C'] },
  { id: 'k-mond', cat: 'kinder', level: 2, title: 'Der Mond ist aufgegangen',
    chords: ['G', 'D', 'Em', 'C', 'G', 'D', 'G'] },
  { id: 'k-muss-i', cat: 'kinder', level: 2, title: 'Muss i denn zum Städtele hinaus',
    chords: ['G', 'C', 'G', 'D', 'G'] },
  { id: 'k-horch', cat: 'kinder', level: 1, title: 'Horch, was kommt von draußen rein',
    chords: ['G', 'D', 'G'] },
  { id: 'k-wenn-ich', cat: 'kinder', level: 2, title: 'Die Gedanken sind frei',
    chords: ['G', 'C', 'G', 'D', 'G'] },
  { id: 'k-loreley', cat: 'kinder', level: 3, title: 'Ich weiß nicht, was soll es bedeuten',
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'C'], note: 'Die Loreley. Mit F – wenn das zu früh ist, nimm Dm statt F.' },
  { id: 'k-tanz', cat: 'kinder', level: 1, title: 'Tanz mit mir',
    chords: ['Am', 'E7', 'Am'], note: 'Einfacher Tanzrhythmus über zwei Griffen.' },

  // ---- Folk und Traditionals (gemeinfrei) ----
  { id: 'f-amazing', cat: 'folk', level: 2, title: 'Amazing Grace',
    chords: ['G', 'C', 'G', 'D', 'G'], note: 'Im Dreiertakt. Gut für ruhiges, lockeres Spielen.' },
  { id: 'f-rising', cat: 'folk', level: 3, title: 'House of the Rising Sun',
    chords: ['Am', 'C', 'D', 'F', 'Am', 'E7'], note: 'Traditional. Als Zupfmuster bekannt, zum Üben erst mal anschlagen.' },
  { id: 'f-scarborough', cat: 'folk', level: 2, title: 'Scarborough Fair',
    chords: ['Am', 'G', 'Am', 'C', 'Am'], note: 'Englisches Traditional im Dreiertakt.' },
  { id: 'f-greensleeves', cat: 'folk', level: 2, title: 'Greensleeves',
    chords: ['Am', 'G', 'Am', 'E7', 'Am'] },
  { id: 'f-danny', cat: 'folk', level: 2, title: 'Danny Boy',
    chords: ['G', 'C', 'G', 'D', 'G'], note: 'Irische Weise (Londonderry Air).' },
  { id: 'f-wild-rover', cat: 'folk', level: 2, title: 'The Wild Rover',
    chords: ['G', 'C', 'D', 'G'], note: 'Irischer Pub-Klassiker, treibender Dreier.' },
  { id: 'f-drunken', cat: 'folk', level: 1, title: 'Drunken Sailor',
    chords: ['Am', 'G', 'Am'], note: 'Shanty. Zwei Griffe, viel Schwung.' },
  { id: 'f-oh-susanna', cat: 'folk', level: 3, title: 'Oh Susanna',
    chords: ['C', 'G', 'C', 'F', 'C', 'G', 'C'] },
  { id: 'f-swing-low', cat: 'folk', level: 3, title: 'Swing Low, Sweet Chariot',
    chords: ['C', 'F', 'C', 'G', 'C'] },
  { id: 'f-shenandoah', cat: 'folk', level: 3, title: 'Shenandoah',
    chords: ['C', 'F', 'C', 'Am', 'F', 'G', 'C'] },
  { id: 'f-clementine', cat: 'folk', level: 1, title: 'Oh My Darling Clementine',
    chords: ['G', 'D', 'G'] },
  { id: 'f-auld', cat: 'folk', level: 2, title: 'Auld Lang Syne',
    chords: ['G', 'D', 'G', 'C', 'G', 'D', 'G'] },

  // ---- Blues ----
  { id: 'b-12-a', cat: 'blues', level: 2, title: '12-Takt-Blues in A',
    chords: ['A7', 'A7', 'A7', 'A7', 'D7', 'D7', 'A7', 'A7', 'E7', 'D7', 'A7', 'E7'],
    note: 'Das Grundgerüst fast aller Bluesstücke. Jeder Akkord einen Takt.' },
  { id: 'b-12-e', cat: 'blues', level: 2, title: '12-Takt-Blues in E',
    chords: ['E7', 'E7', 'E7', 'E7', 'A7', 'A7', 'E7', 'E7', 'H7', 'A7', 'E7', 'H7'],
    note: 'Dieselbe Form in E. H7 ist deutsch, englisch heißt der Griff B7.' },
  { id: 'b-kurz', cat: 'blues', level: 2, title: 'Blues-Grundwechsel',
    chords: ['A7', 'D7', 'A7', 'E7'], note: 'Die drei Bluesakkorde ohne das volle Schema.' },
  { id: 'b-rock', cat: 'blues', level: 3, title: 'Rock’n’Roll-Schema',
    chords: ['C', 'Am', 'F', 'G7'], note: 'Die Folge hinter unzähligen Fünfzigerjahre-Stücken.' },

  // ---- Weihnachtslieder (gemeinfrei) ----
  { id: 'w-stille', cat: 'weihnacht', level: 3, title: 'Stille Nacht',
    chords: ['C', 'G', 'C', 'F', 'C', 'G', 'C'], note: 'Im Dreiertakt, ruhig.' },
  { id: 'w-oh-tannenbaum', cat: 'weihnacht', level: 2, title: 'O Tannenbaum',
    chords: ['G', 'D', 'G', 'C', 'G', 'D', 'G'] },
  { id: 'w-kling', cat: 'weihnacht', level: 1, title: 'Kling, Glöckchen',
    chords: ['G', 'D', 'G'] },
  { id: 'w-ihr-kinderlein', cat: 'weihnacht', level: 2, title: 'Ihr Kinderlein, kommet',
    chords: ['G', 'C', 'G', 'D', 'G'] },
  { id: 'w-jingle', cat: 'weihnacht', level: 2, title: 'Jingle Bells',
    chords: ['G', 'C', 'D', 'G'] },
  { id: 'w-leise', cat: 'weihnacht', level: 3, title: 'Leise rieselt der Schnee',
    chords: ['C', 'G', 'C', 'F', 'C', 'G', 'C'] },
  { id: 'w-first-noel', cat: 'weihnacht', level: 2, title: 'The First Noel',
    chords: ['D', 'G', 'A', 'D'] },

  // ---- Bekannte Akkordfolgen ----
  { id: 'p-vier', cat: 'progression', level: 2, title: 'Vier-Akkord-Folge (I–V–vi–IV)',
    chords: ['G', 'D', 'Em', 'C'], note: 'Die Folge, auf die auffallend viele Popstücke passen.' },
  { id: 'p-vier-c', cat: 'progression', level: 3, title: 'Dieselbe Folge in C',
    chords: ['C', 'G', 'Am', 'F'], note: 'Mit F, also schon mit Barré oder dem kleinen F-Griff.' },
  { id: 'p-fifties', cat: 'progression', level: 3, title: 'Fünfzigerjahre-Folge (I–vi–IV–V)',
    chords: ['C', 'Am', 'F', 'G'] },
  { id: 'p-canon', cat: 'progression', level: 3, title: 'Kanonfolge nach Pachelbel',
    chords: ['D', 'A', 'Hm', 'Fis', 'G', 'D', 'G', 'A'], note: 'Anspruchsvoll, mit Hm und Fis.' },
  { id: 'p-andalusisch', cat: 'progression', level: 3, title: 'Andalusische Kadenz',
    chords: ['Am', 'G', 'F', 'E'], note: 'Klingt spanisch, braucht ein sauberes F.' },
  { id: 'p-doowop', cat: 'progression', level: 2, title: 'Doo-Wop in G',
    chords: ['G', 'Em', 'C', 'D'] },
  { id: 'p-blues-moll', cat: 'progression', level: 2, title: 'Mollblues-Folge',
    chords: ['Am', 'Dm', 'Am', 'E7'] },
];

export const LEVEL_LABEL = { 1: 'leicht', 2: 'mittel', 3: 'mit Barré' };

export function byCategory() {
  return CATEGORIES.map(c => ({ ...c, songs: SONGBOOK.filter(s => s.cat === c.key) }))
    .filter(c => c.songs.length);
}

export function findSong(id) {
  return SONGBOOK.find(s => s.id === id) || null;
}
