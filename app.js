(function () {
  "use strict";

  var STORE = "achtung-mockup-v1";
  var phoneEl = document.getElementById("phone");
  var screenEl = document.getElementById("screen");
  var tabbarEl = document.getElementById("tabbar");
  var toastEl = document.getElementById("toast");

  var state = {
    onboarded: false,
    step: 0,
    guarded: ["scroll"],
    level: 0,
    germanMode: true,
    tab: "home",
    view: null, // null | {type:"gate"} | {type:"feed", app}
    gate: null,
    words: {},
    lastGate: [],
    stats: { gates: 6, firstTry: 21, total: 30, streak: 4 }
  };

  var toastTimer = null;

  // ---------- persistence (optional, never required) ----------

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE));
      if (s && s.onboarded && s.words) {
        state.onboarded = true;
        state.guarded = s.guarded;
        state.level = s.level;
        state.germanMode = s.germanMode !== undefined ? s.germanMode : s.angry !== false;
        state.words = s.words;
        state.stats = s.stats;
      }
    } catch (e) { /* storage blocked: fine */ }
  }

  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        onboarded: state.onboarded, guarded: state.guarded, level: state.level,
        germanMode: state.germanMode, words: state.words, stats: state.stats
      }));
    } catch (e) { /* storage blocked: fine */ }
  }

  // ---------- helpers ----------

  function byId(id) { return WORDS.filter(function (w) { return w.id === id; })[0]; }
  function appById(id) { return APPS.filter(function (a) { return a.id === id; })[0]; }
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function pct(x) { return Math.round(x * 100); }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2400);
  }

  function pulse(selector, cls) {
    var el = screenEl.querySelector(selector);
    if (!el) return;
    el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, 500);
  }

  // ---------- the German voice ----------

  var germanVoice = null;

  var MALE = /markus|martin|yannick|stefan|hans|jonas|eddy|reed|rocko|grandpa|\bmale\b|männlich/i;
  var FEMALE = /anna|petra|katja|marlene|vicki|flo |sandy|shelley|grandma|female|weiblich|google deutsch/i;

  // Prefer a male German voice. Which ones exist depends on the device.
  function loadVoices() {
    if (!("speechSynthesis" in window)) return;
    var list = window.speechSynthesis.getVoices().filter(function (v) { return /^de/i.test(v.lang); });
    germanVoice = list.filter(function (v) { return MALE.test(v.name) && !FEMALE.test(v.name); })[0] ||
      list.filter(function (v) { return !FEMALE.test(v.name); })[0] || list[0] || null;
  }
  if ("speechSynthesis" in window) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }

  // Herr Donner: a male German voice. German mode makes him faster, lower and louder.
  function speak(text) {
    if (!("speechSynthesis" in window)) {
      toast("This browser can't speak. Try Chrome or Safari.");
      return;
    }
    var u = new SpeechSynthesisUtterance(state.germanMode ? text + "!" : text);
    u.lang = "de-DE";
    if (germanVoice) u.voice = germanVoice;
    u.rate = state.germanMode ? 1.15 : 0.9;
    u.pitch = state.germanMode ? 0.5 : 0.8;
    u.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  // ---------- word memory (predictive part) ----------

  // Each word has: seen, daysAgo (since last review), stab (memory stability in days).
  function seedWords() {
    state.words = {};
    WORDS.forEach(function (w, i) {
      var seen = w.level <= state.level && i % 2 === 0;
      state.words[w.id] = { seen: seen, daysAgo: seen ? 1 + (i * 3) % 8 : 0, stab: seen ? 2 + (i % 5) : 0 };
    });
  }

  // Forgetting curve: chance you still remember a word after daysAgo days.
  function recall(id, extraDays) {
    var st = state.words[id];
    if (!st.seen) return null;
    return Math.exp(-(st.daysAgo + (extraDays || 0)) / st.stab);
  }

  // ---------- word picker (recommender part) ----------

  function pickWords() {
    var scored = WORDS.filter(function (w) { return w.level <= state.level; }).map(function (w) {
      var r = recall(w.id);
      var need = r === null ? 0.55 : 1 - r;
      var fit = w.level === state.level ? 1 : 0.5;
      var cooldown = state.lastGate.indexOf(w.id) !== -1 ? 0.3 : 0;
      return { w: w, need: need, isNew: r === null, score: 0.6 * need + 0.25 * fit - cooldown + Math.random() * 0.05 };
    }).sort(function (a, b) { return b.score - a.score; });

    var picked = [], topics = {};
    scored.forEach(function (s) {
      if (picked.length >= 5) return;
      if ((topics[s.w.topic] || 0) >= 2) return;
      topics[s.w.topic] = (topics[s.w.topic] || 0) + 1;
      picked.push(s);
    });

    var fading = picked.filter(function (s) { return !s.isNew && s.need >= 0.4; }).length;
    var fresh = picked.filter(function (s) { return s.isNew; }).length;
    var parts = [];
    if (fading) parts.push(fading + " fading from your memory");
    if (fresh) parts.push(fresh + " new at " + LEVELS[state.level]);
    var rest = 5 - fading - fresh;
    if (rest) parts.push(rest + " quick review");
    return { words: picked.map(function (s) { return s.w; }), why: parts.join(", ") };
  }

  // After a round: right first try makes a memory stronger, a miss makes it weaker.
  function updateMemory(g) {
    var firstTry = 0;
    g.words.forEach(function (w) {
      var ok = !g.mistakes[w.id];
      var st = state.words[w.id];
      if (ok) firstTry++;
      if (!st.seen) { st.seen = true; st.stab = ok ? 3 : 1.5; }
      else st.stab = ok ? st.stab * 2 : Math.max(1, st.stab * 0.6);
      st.daysAgo = 0;
    });
    state.lastGate = g.words.map(function (w) { return w.id; });
    state.stats.gates += 1;
    state.stats.firstTry += firstTry;
    state.stats.total += 5;
    g.firstTry = firstTry;
    save();
  }

  // ---------- gate flow ----------

  function startGate(app) {
    var pick = pickWords();
    var english = shuffle(pick.words.map(function (w) { return w.id; }));
    for (var tries = 0; tries < 5 && english.join() === pick.words.map(function (w) { return w.id; }).join(); tries++) {
      english = shuffle(english);
    }
    state.gate = { app: app, words: pick.words, why: pick.why, order: english, matched: {}, selected: null, mistakes: {}, done: false, firstTry: 0 };
    state.view = { type: "gate" };
  }

  function matchedCount(g) { return Object.keys(g.matched).length; }

  // ---------- screens ----------

  function renderOnboarding() {
    var s = state.step;
    var dots = '<div class="dots">' + [0, 1, 2, 3].map(function (i) { return '<i class="' + (i <= s ? "on" : "") + '"></i>'; }).join("") + "</div>";
    var body = "", foot = "";

    if (s === 0) {
      body = '<div class="logo">🛑</div><h1>Scroll less. Sprich mehr.</h1>' +
        '<p class="muted">Every time you open a social app, Achtung! stops you for 30 seconds. Match five German words to their English meaning, and then you can scroll.</p>' +
        '<p class="muted">Your brain gets a workout before the feed gets your brain. And Herr Donner will shout the words at you.</p>';
      foot = '<button class="btn block" data-a="next">Los geht\'s</button>';
    } else if (s === 1) {
      body = dots + "<h1>Which apps should we guard?</h1><p class=\"muted\">Pick at least one. You can change this later.</p>" +
        APPS.map(function (a) {
          var on = state.guarded.indexOf(a.id) !== -1;
          return '<button class="opt' + (on ? " on" : "") + '" data-a="toggle-app" data-id="' + a.id + '"><span class="e">' + a.emoji + "</span><span><b>" + a.name + '</b><span class="muted small">' + (on ? "Guarded" : "Not guarded") + "</span></span></button>";
        }).join("");
      foot = '<button class="btn block" data-a="next">Continue</button>';
    } else if (s === 2) {
      body = dots + "<h1>How good is your German?</h1><p class=\"muted\">We start here and adjust as you play.</p>" +
        [["0", "🌱", "A1 · Beginner", "Hello, thank you, dog, bread"], ["1", "🌿", "A2 · Elementary", "Train station, bill, by the way"], ["2", "🌳", "B1 · Intermediate", "Challenge, society, attention"]]
          .map(function (o) {
            return '<button class="opt' + (state.level === Number(o[0]) ? " on" : "") + '" data-a="level" data-v="' + o[0] + '"><span class="e">' + o[1] + "</span><span><b>" + o[2] + '</b><span class="muted small">' + o[3] + "</span></span></button>";
          }).join("");
      foot = '<button class="btn block" data-a="next">Continue</button>';
    } else {
      body = dots + "<h1>Meet Herr Donner</h1><p class=\"muted\">Press any German word and he pronounces it. He is not happy about it.</p>" +
        '<div class="card" style="text-align:center;margin-top:16px"><div style="font-size:48px">😠</div>' +
        '<button class="btn block" style="margin-top:12px" data-a="test-voice">🔊 Hear him</button>' +
        '<p class="small muted" style="margin:10px 0 0">The voice comes from your device. Turn your sound on.</p></div>';
      foot = '<button class="btn block" data-a="finish-ob">Start learning</button>';
    }

    var back = s > 0 ? '<button class="back" data-a="back-ob">‹ Back</button>' : "";
    screenEl.innerHTML = '<div class="ob">' + back + '<div class="body">' + body + "</div>" + foot + "</div>";
  }

  function renderHome() {
    var icons = APPS.map(function (a) {
      var locked = state.guarded.indexOf(a.id) !== -1;
      return '<button class="appicon" data-a="open-app" data-id="' + a.id + '"><span class="ic" style="background:' + a.color + '">' + a.emoji +
        (locked ? '<i class="lock">🔒</i>' : "") + "</span>" + a.name + "</button>";
    }).join("");
    var dummies = [["📞", "Phone"], ["🗺️", "Maps"], ["📝", "Notes"], ["📷", "Camera"], ["⚙️", "Settings"]].map(function (d) {
      return '<button class="appicon" data-a="dummy"><span class="ic">' + d[0] + "</span>" + d[1] + "</button>";
    }).join("");

    screenEl.innerHTML = '<div class="wall"><div class="clock">10:12</div><div class="grid">' + icons + dummies + "</div></div>" +
      '<h2>Try it</h2><div class="card"><p><b>Tap an app with a 🔒.</b></p><p class="small muted">That is what happens on your own phone every time you open a guarded app. Apps without a lock open normally.</p></div>' +
      '<div class="stats" style="margin-top:12px"><div class="stat"><b>' + state.stats.gates + "</b><span>rounds done</span></div>" +
      '<div class="stat"><b>' + pct(state.stats.firstTry / state.stats.total) + '%</b><span>right first try</span></div>' +
      '<div class="stat"><b>' + state.stats.streak + "</b><span>day streak</span></div></div>";
  }

  function renderGate() {
    var g = state.gate;
    if (g.done) return renderGateDone();

    var de = g.words.map(function (w) {
      var r = recall(w.id);
      var sub = g.matched[w.id] ? "✓ matched" : r === null ? "new word" : "memory " + pct(r) + "%";
      return '<button class="wbtn de' + (g.matched[w.id] ? " ok" : "") + (g.selected === w.id ? " sel" : "") + '" data-a="g-de" data-id="' + w.id + '">' +
        '<span class="w">🔊 ' + w.de + '</span><span class="sub">' + sub + "</span></button>";
    }).join("");

    var en = g.order.map(function (id) {
      var w = byId(id);
      return '<button class="wbtn en' + (g.matched[id] ? " ok" : "") + '" data-a="g-en" data-id="' + id + '"' + (g.matched[id] ? " disabled" : "") + ">" + w.en + "</button>";
    }).join("");

    var headline = g.app ? appById(g.app).name + " is locked" : "Practice round";
    var sub = g.app ? "Match all 5 words to open it. Tap a German word, then its English meaning." : "Tap a German word, then its English meaning.";

    screenEl.innerHTML = '<div class="gate"><div class="topbar"><button class="back" data-a="leave-gate" style="color:#a9a49a">‹ Not now</button></div>' +
      "<h1>Achtung!</h1><p><b>" + headline + "</b></p><p class=\"muted\">" + sub + "</p>" +
      '<div class="why">Picked for you: ' + g.why + ".</div>" +
      '<div class="progress"><i style="width:' + (matchedCount(g) / 5 * 100) + '%"></i></div>' +
      '<div class="cols"><div>' + de + "</div><div>" + en + "</div></div></div>";
  }

  function renderGateDone() {
    var g = state.gate;
    var lines = g.words.map(function (w) {
      var ok = !g.mistakes[w.id];
      return '<div class="line"><span>' + (ok ? "✅" : "⚠️") + '</span><span class="t"><b>' + w.de + '</b><br><span class="muted small">' + w.en + '</span></span>' +
        '<button class="spk" data-a="say" data-id="' + w.id + '" aria-label="Hear ' + w.de + '">🔊</button></div>';
    }).join("");
    var msg = g.firstTry === 5 ? "Perfekt! Herr Donner is almost proud." : g.firstTry >= 3 ? "Nicht schlecht." : "Das war schwach. The weak ones will come back sooner.";

    screenEl.innerHTML = '<div class="gate" style="padding-top:30px"><h1 style="color:#3fbf7f">Geschafft!</h1>' +
      "<p><b>" + g.firstTry + " of 5 right first try.</b></p><p class=\"muted\">" + msg + "</p>" +
      '<div class="result">' + lines + "</div>" +
      (g.app ? '<button class="btn gold block" data-a="unlock">Open ' + appById(g.app).name + "</button>" : "") +
      '<button class="btn ghost block" style="margin-top:10px" data-a="leave-gate">' + (g.app ? "Back to home screen" : "Done") + "</button></div>";
  }

  function renderFeed() {
    var a = appById(state.view.app);
    var posts = POSTS.map(function (p) {
      return '<div class="post"><b>@' + p.who + '</b><div class="img"></div><div>' + p.text + '</div><div class="small muted" style="margin-top:6px">♥ ' + p.likes + "</div></div>";
    }).join("");
    screenEl.innerHTML = '<div class="feedhead"><span class="ic" style="background:' + a.color + '">' + a.emoji + "</span><h1 style=\"margin:0\">" + a.name + "</h1></div>" +
      '<div class="banner">Unlocked. Viel Spaß, you earned it.</div>' + posts +
      '<button class="btn ghost block" data-a="close-app">Close ' + a.name + "</button>";
  }

  function recallChart() {
    var seen = WORDS.filter(function (w) { return state.words[w.id].seen; });
    if (!seen.length) return '<p class="muted small">Play a round and your memory forecast shows up here.</p>';
    var vals = [];
    for (var t = 0; t <= 7; t++) {
      vals.push(seen.reduce(function (s, w) { return s + recall(w.id, t); }, 0) / seen.length);
    }
    var W = 320, H = 100;
    var pts = vals.map(function (v, i) { return [(i / 7) * W, 8 + (1 - v) * (H - 28)]; });
    var d = pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" ");
    return '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Predicted memory over the next week">' +
      '<path d="' + d + " L" + W + " " + (H - 20) + " L0 " + (H - 20) + ' Z" fill="#d1342c" opacity="0.1"/>' +
      '<path d="' + d + '" fill="none" stroke="#d1342c" stroke-width="2.5" stroke-linecap="round"/>' +
      '<text x="0" y="' + (H - 4) + '" font-size="10" fill="#6e6a62">Today</text>' +
      '<text x="' + W + '" y="' + (H - 4) + '" font-size="10" fill="#6e6a62" text-anchor="end">In 7 days</text></svg>' +
      '<div class="small muted">You remember about <b>' + pct(vals[0]) + "%</b> of your words today. With no practice, about <b>" + pct(vals[7]) + "%</b> in a week.</div>";
  }

  function renderProgress() {
    var strong = WORDS.filter(function (w) { var s = state.words[w.id]; return s.seen && s.stab >= 6; }).length;
    var slipping = WORDS.filter(function (w) { return state.words[w.id].seen; })
      .sort(function (a, b) { return recall(a.id) - recall(b.id); }).slice(0, 4);

    var rows = slipping.map(function (w) {
      var r = recall(w.id);
      return '<div class="wrow"><div class="t"><b>' + w.de + '</b> <span class="muted small">· ' + w.en + '</span><div class="bar"><i class="' + (r < 0.4 ? "low" : r < 0.7 ? "mid" : "") + '" style="width:' + pct(r) + '%"></i></div></div>' +
        '<span class="small muted">' + pct(r) + '%</span><button class="spk" data-a="say" data-id="' + w.id + '" aria-label="Hear ' + w.de + '">🔊</button></div>';
    }).join("");

    screenEl.innerHTML = "<h1>Progress</h1><p class=\"muted\">Fewer mindless opens, more German.</p>" +
      '<div class="stats"><div class="stat"><b>' + state.stats.gates + "</b><span>rounds done</span></div>" +
      '<div class="stat"><b>' + strong + "</b><span>strong words</span></div>" +
      '<div class="stat"><b>' + state.stats.streak + "</b><span>day streak</span></div></div>" +
      '<h2>Memory forecast</h2><div class="card">' + recallChart() + "</div>" +
      '<h2>Words about to slip</h2><div class="card">' + (rows || '<span class="muted">Nothing yet. Play a round first.</span>') + "</div>" +
      '<button class="btn block" style="margin-top:16px" data-a="practice">Practice now</button>';
  }

  function renderWords() {
    var list = WORDS.filter(function (w) { return w.level <= state.level; }).sort(function (a, b) {
      var ra = recall(a.id), rb = recall(b.id);
      return (ra === null ? 2 : ra) - (rb === null ? 2 : rb);
    });
    var rows = list.map(function (w) {
      var r = recall(w.id);
      return '<div class="wrow"><div class="t"><b>' + w.de + '</b> <span class="pill gray">' + LEVELS[w.level] + '</span><div class="muted small">' + w.en + "</div>" +
        (r === null ? "" : '<div class="bar"><i class="' + (r < 0.4 ? "low" : r < 0.7 ? "mid" : "") + '" style="width:' + pct(r) + '%"></i></div>') + "</div>" +
        '<span class="small muted">' + (r === null ? "new" : pct(r) + "%") + '</span><button class="spk" data-a="say" data-id="' + w.id + '" aria-label="Hear ' + w.de + '">🔊</button></div>';
    }).join("");
    screenEl.innerHTML = "<h1>Your words</h1><p class=\"muted\">Weakest first. Tap 🔊 to be shouted at.</p><div class=\"card\" style=\"margin-top:12px\">" + rows + "</div>";
  }

  function renderSettings() {
    var apps = APPS.map(function (a) {
      var on = state.guarded.indexOf(a.id) !== -1;
      return '<div class="setrow"><span>' + a.emoji + " " + a.name + '</span><button class="switch' + (on ? " on" : "") + '" data-a="toggle-app" data-id="' + a.id + '" aria-label="Guard ' + a.name + '"></button></div>';
    }).join("");
    var levels = LEVELS.map(function (l, i) {
      return '<button class="' + (state.level === i ? "on" : "") + '" data-a="level" data-v="' + i + '">' + l + "</button>";
    }).join("");

    screenEl.innerHTML = "<h1>Settings</h1>" +
      "<h2>Guarded apps</h2><div class=\"card\">" + apps + "</div>" +
      "<h2>Your level</h2><div class=\"seg\">" + levels + "</div>" +
      "<h2>Herr Donner</h2><div class=\"card\"><div class=\"setrow\"><span><b>German mode</b><br><span class=\"small muted\">Stern, fast, very German</span></span>" +
      '<button class="switch' + (state.germanMode ? " on" : "") + '" data-a="german-mode" aria-label="German mode"></button></div>' +
      '<button class="btn soft block" style="margin-top:12px" data-a="test-voice">🔊 Hear him</button></div>' +
      '<div class="actions" style="margin-top:22px"><button class="btn ghost small" data-a="reset">Reset progress</button><button class="btn ghost small" data-a="replay">Replay intro</button></div>';
  }

  function renderTabbar() {
    tabbarEl.hidden = !!state.view;
    tabbarEl.innerHTML = [["home", "📱", "Home"], ["progress", "📈", "Progress"], ["words", "🔤", "Words"], ["settings", "⚙️", "Settings"]].map(function (t) {
      return '<button class="tab' + (state.tab === t[0] ? " on" : "") + '" data-a="tab" data-v="' + t[0] + '"><span class="ico">' + t[1] + "</span>" + t[2] + "</button>";
    }).join("");
  }

  function render(keepScroll) {
    var y = screenEl.scrollTop;
    var v = state.view;
    phoneEl.classList.toggle("dark", !!(v && v.type === "gate"));
    if (!state.onboarded) {
      tabbarEl.hidden = true;
      renderOnboarding();
    } else {
      if (v && v.type === "gate") renderGate();
      else if (v && v.type === "feed") renderFeed();
      else if (state.tab === "progress") renderProgress();
      else if (state.tab === "words") renderWords();
      else if (state.tab === "settings") renderSettings();
      else renderHome();
      renderTabbar();
    }
    screenEl.scrollTop = keepScroll ? y : 0;
  }

  // ---------- actions ----------

  function toggleApp(id) {
    var i = state.guarded.indexOf(id);
    if (i === -1) state.guarded.push(id);
    else if (state.guarded.length === 1) return toast("Keep at least one app guarded.");
    else state.guarded.splice(i, 1);
    save(); render(true);
  }

  var actions = {
    "next": function () { state.step++; render(false); },
    "back-ob": function () { state.step = Math.max(0, state.step - 1); render(false); },
    "toggle-app": function (d) { toggleApp(d.id); },
    "level": function (d) { state.level = Number(d.v); save(); render(true); },
    "test-voice": function () { speak("Hallo! Ich bin sehr sauer"); },
    "finish-ob": function () {
      seedWords();
      state.onboarded = true; state.tab = "home"; state.view = null;
      save(); render(false);
    },
    "tab": function (d) { state.tab = d.v; render(false); },
    "dummy": function () { toast("Only the three social apps work in this demo."); },
    "open-app": function (d) {
      if (state.guarded.indexOf(d.id) !== -1) { startGate(d.id); render(false); speak("Achtung"); }
      else { state.view = { type: "feed", app: d.id }; render(false); }
    },
    "practice": function () { startGate(null); render(false); },
    "leave-gate": function () { state.gate = null; state.view = null; render(false); },
    "g-de": function (d) {
      var g = state.gate, w = byId(d.id);
      speak(w.de);
      if (!g.matched[w.id]) g.selected = w.id;
      render(true);
      pulse('[data-a="g-de"][data-id="' + w.id + '"]', "shout");
    },
    "g-en": function (d) {
      var g = state.gate;
      if (!g.selected) return toast("Tap a German word first.");
      var picked = g.selected;
      if (picked === d.id) {
        g.matched[picked] = true;
        g.selected = null;
        if (matchedCount(g) === 5) {
          updateMemory(g);
          g.done = true;
          speak("Na endlich");
        }
        render(true);
      } else {
        g.mistakes[picked] = (g.mistakes[picked] || 0) + 1;
        g.selected = null;
        speak("Nein");
        render(true);
        pulse('[data-a="g-de"][data-id="' + picked + '"]', "shake");
        pulse('[data-a="g-en"][data-id="' + d.id + '"]', "shake");
      }
    },
    "say": function (d) { speak(byId(d.id).de); },
    "unlock": function () {
      var app = state.gate.app;
      state.gate = null;
      state.view = { type: "feed", app: app };
      render(false);
    },
    "close-app": function () { state.view = null; state.tab = "home"; render(false); },
    "german-mode": function () { state.germanMode = !state.germanMode; save(); render(true); toast(state.germanMode ? "German mode on. Herr Donner is not amused." : "German mode off. Herr Donner calmed down."); },
    "reset": function () {
      seedWords();
      state.stats = { gates: 6, firstTry: 21, total: 30, streak: 4 };
      state.lastGate = [];
      save(); toast("Progress reset."); render(true);
    },
    "replay": function () { state.onboarded = false; state.step = 0; state.view = null; state.gate = null; render(false); }
  };

  function onClick(e) {
    var t = e.target.closest("[data-a]");
    if (!t || t.disabled) return;
    var fn = actions[t.dataset.a];
    if (fn) fn(t.dataset);
  }

  screenEl.addEventListener("click", onClick);
  tabbarEl.addEventListener("click", onClick);

  load();
  render(false);
})();
