# Meanwhile

Meanwhile is a mobile app idea for students, and this folder holds its interactive mockup for HW 1.

The idea is simple. A student's day is full of small gaps: the 80 minutes between a lecture and a lab, the half hour before a meeting. Most of that time disappears into scrolling. Meanwhile finds those gaps, works out how long they will really be, and suggests something that fits. That could be a walk while it's still dry, a call to a friend you haven't spoken to in weeks, a nap, or some studying.

## What it does

- **Predicts your real gaps.** Lectures and meetings often run over. Meanwhile learns how late each of your recurring events usually ends and starts the gap then, not when the timetable says.
- **Predicts your energy.** A daily energy curve decides whether a hard task (a workout, a cover letter) or an easy one (a text to your mum) suits the gap.
- **Recommends what to do.** Each gap gets a short ranked list. Every suggestion says why it was picked.
- **Learns from you.** 👍, 👎 and a "how was it?" question after each activity change what you see next.

## Screens to try

1. **Intro.** Four steps: welcome, link a calendar, pick interests, pick your sharpest time of day.
2. **Today.** Shows the current free window, the energy curve, and a timeline of classes and gaps.
3. **Gap detail.** Tap any green gap to see ranked suggestions with match scores and reasons.
4. **Session.** Start an activity to get a countdown. Finish it and rate it.
5. **Taste.** See what the app thinks you like, change your chronotype, bring back hidden ideas.
6. **Insights.** Weekly free time, today's overrun predictions, and your energy pattern.

A good first run: finish the intro, tap **Start** on the green card, tap **I'm done**, rate it, and then watch the suggestions change on the Today tab.

## Running it

It is plain HTML, CSS and JavaScript, with no build step and no dependencies. Open `index.html` in a browser. On a desktop it shows inside a phone frame, and on a phone it fills the screen.

## What is real and what is faked

The demo day is fixed at Thursday, 10:12. The timetable, weather, overrun history and weekly stats are hard-coded in `data.js`. No calendar is read and nothing leaves the browser. Taste settings are saved in `localStorage` only.

The scoring itself does run, so the recommendations react to your clicks. It lives in `app.js`:

- **Recommender.** Each activity gets a score from four parts: how much you like its tags (40%), how well it matches predicted energy (25%), how well it fits the length of the gap (15%), and context such as weather and deadlines (20%). Activities that don't fit the gap are dropped.
- **Predictive model.** Overrun minutes and the energy curve are fixed numbers here. In the real app they would come from a model trained on each user's calendar history and check-ins.

## Where this could go

- Read a real calendar and learn overruns per event type.
- Replace the hand-made weights with a proper recommender (for example matrix factorisation or a contextual bandit) trained on accepted and skipped suggestions.
- Add real weather and walking-distance data.
- Let friends who share a gap find each other.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | Page shell and phone frame |
| `styles.css` | All styling |
| `data.js` | Demo timetable, energy curves, activity catalogue |
| `app.js` | Screens, interactions, and the stand-in recommender and predictor |
