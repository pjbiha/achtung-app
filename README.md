# Achtung!

Achtung! is a mobile app idea that trades a bit of mindless scrolling for a bit of German. This folder holds its interactive mockup for HW 1.

Every time you open a social app, Achtung! stops you with a short round: five German words on the left, five English meanings on the right, and you match them. Get all five and the app opens. Press any German word and a stern German teacher, Herr Donner, says it out loud so you hear how it's really pronounced.

The goal is simple: less brain rot, more vocabulary.

## What it does

- **Gates your social apps.** You choose which apps to guard. Opening one starts a 30-second word round first.
- **Picks the right five words (recommender).** It chooses words you are about to forget, mixes in new ones at your level, avoids repeats from the last round and keeps the topics varied. It tells you why it picked them.
- **Predicts what you will forget (predictive model).** Each word has a memory score based on a forgetting curve. Getting a word right first try makes the memory last longer. A miss makes it weaker. The Progress tab shows a seven-day memory forecast.
- **Shouts the words.** Tap a German word to hear it. A wrong match gets a "Nein!", and finishing a round gets a "Na endlich!".

## Screens to try

1. **Intro.** Pick the apps to guard, your German level (A1 to B1), and meet Herr Donner.
2. **Home.** A fake phone home screen. Tap an app with a 🔒 to see the gate.
3. **Gate.** Tap a German word, then its English meaning. Mistakes shake the card.
4. **Result and unlock.** See which words you got right first try, replay any word, then open the app.
5. **Progress.** Rounds done, strong words, memory forecast, and the words about to slip.
6. **Words.** All the words at your level, weakest first, with a button to hear each one.
7. **Settings.** Guarded apps, level, German mode on or off, replay the intro, reset progress.

A good first run: finish the intro, tap Scroll on the home screen, get one match wrong on purpose, finish the round, then look at Progress and Words.

## Running it

It is plain HTML, CSS and JavaScript, with no build step and no dependencies. Open `index.html` in a browser. Turn your sound on. On a desktop it shows inside a phone frame, and on a phone it fills the screen.

## What is real and what is faked

The three social apps (Scroll, Chirp and Reelz) are invented, and so are the posts. Your starting progress is seeded demo data. Nothing leaves the browser, and your settings are saved in `localStorage` only.

These parts do run:

- **Word picker.** Each word gets a score from how likely you are to have forgotten it (60%) and how well it fits your level (25%), minus a penalty if it was in the last round. At most two words per topic. This is a hand-made formula, not a trained model.
- **Forgetting curve.** The chance you remember a word is `exp(-days since review / stability)`. Stability doubles after a first-try success and shrinks to 60% after a miss.
- **The voice.** Herr Donner uses your browser's built-in German text-to-speech, preferring a male voice. German mode makes him faster, lower and louder. Which voices you hear depends on what is installed on your device, so a male voice is not guaranteed everywhere. Real acted voice recordings could replace it later.

## Where this could go

- Block real apps. This needs operating system support, such as app-usage access on Android and Screen Time or Shortcuts on iOS, which still has to be researched.
- Replace the formula with a proper spaced repetition model trained on real answers.
- Record real voice lines for Herr Donner, with different moods.
- Add sentences, listening rounds and a bigger word list.
- Let friends share streaks.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | Page shell and phone frame |
| `styles.css` | All styling |
| `data.js` | Word list, fake apps, fake posts |
| `app.js` | Screens, the gate, the word picker, the memory model and the voice |
