// Mock data for the Meanwhile prototype. Nothing here comes from a real
// calendar or a trained model; it is hand-written so the demo is predictable.

// "Now" in the demo, in minutes after midnight (10:12).
const NOW = 10 * 60 + 12;

// Today's timetable. `overrun` is what the (pretend) prediction model expects
// each event to run over, in minutes, based on past weeks.
const EVENTS = [
  { title: "Databases lecture", place: "Room B2", start: 8 * 60 + 30, end: 10 * 60, overrun: 7, seen: "12 of 14 lectures ran late" },
  { title: "Algorithms lab", place: "Lab 3", start: 11 * 60 + 30, end: 13 * 60, overrun: 4, seen: "9 of 14 labs ran late" },
  { title: "Statistics seminar", place: "Room A5", start: 14 * 60 + 15, end: 15 * 60 + 45, overrun: 3, seen: "6 of 10 seminars ran late" },
  { title: "Project meeting", place: "Library, floor 2", start: 16 * 60 + 30, end: 17 * 60 + 30, overrun: 10, seen: "7 of 8 meetings ran late" },
  { title: "Dinner with Maria", place: "Exarchia", start: 19 * 60, end: 20 * 60 + 30, overrun: 0, seen: "" }
];

// Predicted energy (0-100) for each hour from 08:00 to 21:00, per chronotype.
const ENERGY = {
  morning:   [72, 78, 80, 76, 66, 58, 50, 56, 62, 58, 52, 46, 40, 34],
  afternoon: [55, 64, 72, 78, 76, 68, 60, 70, 74, 70, 62, 54, 46, 40],
  evening:   [38, 46, 54, 60, 62, 58, 52, 60, 68, 74, 78, 76, 70, 62]
};

const TAGS = {
  outdoor:  { label: "Outdoors", emoji: "🌿" },
  move:     { label: "Movement", emoji: "🏃" },
  social:   { label: "People", emoji: "💬" },
  calm:     { label: "Calm", emoji: "🧘" },
  learn:    { label: "Study", emoji: "📖" },
  chore:    { label: "Errands", emoji: "✅" },
  food:     { label: "Food", emoji: "🍽️" },
  creative: { label: "Creative", emoji: "🎨" }
};

// How much energy each activity asks for.
const DEMAND = { low: 30, mid: 55, high: 75 };

const ACTIVITIES = [
  { id: "walk", emoji: "🚶", title: "Walk along the river path", min: 25, demand: "mid", tags: ["outdoor", "move"], place: "Riverside park, 6 min away" },
  { id: "call", emoji: "📞", title: "Call Nikos", min: 15, demand: "low", tags: ["social"], place: "Anywhere", note: "You last spoke 3 weeks ago" },
  { id: "notes", emoji: "📓", title: "Review your Databases notes", min: 30, demand: "mid", tags: ["learn"], place: "Anywhere", note: "Today's lecture is still fresh" },
  { id: "stretch", emoji: "🧘", title: "Stretch and breathe", min: 10, demand: "low", tags: ["calm", "move"], place: "Anywhere" },
  { id: "coffee", emoji: "☕", title: "Coffee at Kafeneio Polis", min: 35, demand: "low", tags: ["food", "social"], place: "4 min walk", note: "Usually quiet before noon" },
  { id: "book", emoji: "📚", title: "Return the library book", min: 20, demand: "low", tags: ["chore", "outdoor"], place: "Main library", urgent: true, urgentNote: "Due today, fines start tomorrow" },
  { id: "groceries", emoji: "🛒", title: "Pick up groceries", min: 40, demand: "mid", tags: ["chore", "outdoor", "food"], place: "Sklavenitis, 8 min away" },
  { id: "nap", emoji: "😴", title: "Power nap", min: 20, demand: "low", tags: ["calm"], place: "Home" },
  { id: "gym", emoji: "🏋️", title: "Upper-body workout", min: 45, demand: "high", tags: ["move"], place: "Campus gym" },
  { id: "cover", emoji: "✍️", title: "Draft the internship cover letter", min: 45, demand: "high", tags: ["learn", "chore"], place: "Anywhere" },
  { id: "sketch", emoji: "✏️", title: "Sketch something nearby", min: 20, demand: "low", tags: ["creative", "calm"], place: "Anywhere" },
  { id: "emails", emoji: "📬", title: "Clear the email backlog", min: 20, demand: "mid", tags: ["chore"], place: "Anywhere" },
  { id: "mealprep", emoji: "🥗", title: "Prep tomorrow's lunch", min: 35, demand: "mid", tags: ["food", "chore"], place: "Home" },
  { id: "textmum", emoji: "💌", title: "Text your mum", min: 5, demand: "low", tags: ["social"], place: "Anywhere" },
  { id: "playlist", emoji: "🎧", title: "Build a playlist for the weekend", min: 15, demand: "low", tags: ["creative"], place: "Anywhere" }
];
