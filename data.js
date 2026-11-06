// Mock data for the Achtung! prototype. The words are real German; the apps
// are made up so nothing here copies a real social network.

const LEVELS = ["A1", "A2", "B1"];

const APPS = [
  { id: "scroll", name: "Scroll", emoji: "📸", color: "#d946a8" },
  { id: "chirp", name: "Chirp", emoji: "🐦", color: "#2f80ed" },
  { id: "reelz", name: "Reelz", emoji: "🎬", color: "#f2711c" }
];

// level: 0 = A1, 1 = A2, 2 = B1. Topic is used to keep a round varied.
const WORDS = [
  // A1
  { id: "hund", de: "der Hund", en: "dog", level: 0, topic: "animals" },
  { id: "katze", de: "die Katze", en: "cat", level: 0, topic: "animals" },
  { id: "brot", de: "das Brot", en: "bread", level: 0, topic: "food" },
  { id: "wasser", de: "das Wasser", en: "water", level: 0, topic: "food" },
  { id: "milch", de: "die Milch", en: "milk", level: 0, topic: "food" },
  { id: "apfel", de: "der Apfel", en: "apple", level: 0, topic: "food" },
  { id: "haus", de: "das Haus", en: "house", level: 0, topic: "home" },
  { id: "tisch", de: "der Tisch", en: "table", level: 0, topic: "home" },
  { id: "schule", de: "die Schule", en: "school", level: 0, topic: "work" },
  { id: "freund", de: "der Freund", en: "friend", level: 0, topic: "people" },
  { id: "zeit", de: "die Zeit", en: "time", level: 0, topic: "time" },
  { id: "danke", de: "danke", en: "thank you", level: 0, topic: "talk" },
  { id: "bitte", de: "bitte", en: "please", level: 0, topic: "talk" },
  { id: "morgen", de: "Guten Morgen", en: "good morning", level: 0, topic: "talk" },
  { id: "buch", de: "das Buch", en: "book", level: 0, topic: "work" },
  { id: "strasse", de: "die Straße", en: "street", level: 0, topic: "travel" },
  { id: "sonne", de: "die Sonne", en: "sun", level: 0, topic: "nature" },
  // A2
  { id: "bahnhof", de: "der Bahnhof", en: "train station", level: 1, topic: "travel" },
  { id: "rechnung", de: "die Rechnung", en: "bill", level: 1, topic: "work" },
  { id: "wetter", de: "das Wetter", en: "weather", level: 1, topic: "nature" },
  { id: "wohnung", de: "die Wohnung", en: "apartment", level: 1, topic: "home" },
  { id: "urlaub", de: "der Urlaub", en: "vacation", level: 1, topic: "travel" },
  { id: "erkaeltung", de: "die Erkältung", en: "cold (illness)", level: 1, topic: "health" },
  { id: "schluessel", de: "der Schlüssel", en: "key", level: 1, topic: "home" },
  { id: "besprechung", de: "die Besprechung", en: "meeting", level: 1, topic: "work" },
  { id: "guenstig", de: "günstig", en: "cheap", level: 1, topic: "talk" },
  { id: "verspaetung", de: "die Verspätung", en: "delay", level: 1, topic: "travel" },
  { id: "uebrigens", de: "übrigens", en: "by the way", level: 1, topic: "talk" },
  { id: "trotzdem", de: "trotzdem", en: "nevertheless", level: 1, topic: "talk" },
  // B1
  { id: "herausforderung", de: "die Herausforderung", en: "challenge", level: 2, topic: "abstract" },
  { id: "erfahrung", de: "die Erfahrung", en: "experience", level: 2, topic: "abstract" },
  { id: "umwelt", de: "die Umwelt", en: "environment", level: 2, topic: "nature" },
  { id: "verantwortlich", de: "verantwortlich", en: "responsible", level: 2, topic: "abstract" },
  { id: "gesellschaft", de: "die Gesellschaft", en: "society", level: 2, topic: "abstract" },
  { id: "fortschritt", de: "der Fortschritt", en: "progress", level: 2, topic: "abstract" },
  { id: "entscheidung", de: "die Entscheidung", en: "decision", level: 2, topic: "abstract" },
  { id: "gewohnheit", de: "die Gewohnheit", en: "habit", level: 2, topic: "abstract" },
  { id: "ablenkung", de: "die Ablenkung", en: "distraction", level: 2, topic: "work" },
  { id: "aufmerksamkeit", de: "die Aufmerksamkeit", en: "attention", level: 2, topic: "people" },
  { id: "sucht", de: "die Sucht", en: "addiction", level: 2, topic: "health" }
];

// Fake posts shown after an app is "unlocked".
const POSTS = [
  { who: "mr.sigma.fish", text: "day 41 of staring at a wall until it blinks first", likes: "12.4k" },
  { who: "toastbot", text: "pov: you said 'one more video' three hours ago", likes: "8.1k" },
  { who: "dave_from_accounts", text: "my cat knocked a glass off the table again. no regrets.", likes: "3.3k" }
];
