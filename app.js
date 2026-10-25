(function () {
  "use strict";

  var STORE = "meanwhile-mockup-v1";
  var screenEl = document.getElementById("screen");
  var tabbarEl = document.getElementById("tabbar");
  var toastEl = document.getElementById("toast");

  var tagKeys = Object.keys(TAGS);

  function zeroWeights() {
    var w = {};
    tagKeys.forEach(function (k) { w[k] = 0; });
    return w;
  }

  var state = {
    onboarded: false,
    step: 0,
    linked: null,
    picks: [],
    chrono: "morning",
    weights: zeroWeights(),
    tab: "today",
    view: null,
    rejected: [],
    liked: [],
    done: {},
    session: null
  };

  var timer = null;
  var toastTimer = null;

  // ---------- persistence (optional, never required) ----------

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORE));
      if (saved && saved.onboarded) {
        state.onboarded = true;
        state.chrono = saved.chrono || "morning";
        state.weights = Object.assign(zeroWeights(), saved.weights);
      }
    } catch (e) { /* storage blocked: fine */ }
  }

  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        onboarded: state.onboarded,
        chrono: state.chrono,
        weights: state.weights
      }));
    } catch (e) { /* storage blocked: fine */ }
  }

  // ---------- helpers ----------

  function pad(n) { return String(n).padStart(2, "0"); }
  function fmt(m) { return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }
  function len(m) {
    if (m < 60) return m + " min";
    var r = m % 60;
    return Math.floor(m / 60) + " h" + (r ? " " + r + " min" : "");
  }
  function byId(id) { return ACTIVITIES.filter(function (a) { return a.id === id; })[0]; }
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2400);
  }

  // ---------- "models" (stand-ins for the real thing) ----------

  // Predictive part: gaps start when the previous event is expected to end,
  // not when the timetable says it ends.
  function computeGaps() {
    var out = [];
    for (var i = 0; i < EVENTS.length - 1; i++) {
      var a = EVENTS[i], b = EVENTS[i + 1];
      var start = a.end + a.overrun;
      var end = b.start;
      if (end - start >= 20) out.push({ id: i, start: start, end: end, mins: end - start, after: a, before: b });
    }
    return out;
  }

  function gapStart(g) { return Math.max(g.start, NOW); }
  function gapAvail(g) { return g.end - gapStart(g); }
  function gapState(g) { return NOW >= g.end ? "past" : NOW >= g.start ? "now" : "later"; }

  // Predictive part: energy level at a given minute of the day.
  function energyAt(min) {
    var idx = clamp(Math.floor(min / 60) - 8, 0, 13);
    return ENERGY[state.chrono][idx];
  }
  function energyWord(e) { return e < 45 ? "low" : e < 65 ? "steady" : "high"; }

  // Recommender part: score one activity for one gap.
  function scoreAct(a, g) {
    var start = gapStart(g);
    var avail = gapAvail(g);
    var e = energyAt(start);

    var w = a.tags.reduce(function (s, t) { return s + state.weights[t]; }, 0) / a.tags.length;
    var taste = 1 / (1 + Math.exp(-w / 2));

    var need = DEMAND[a.demand];
    var fitE = need <= e ? 1 - (e - need) / 250 : Math.max(0, 1 - (need - e) / 35);

    var fitD = Math.min(1, 0.4 + (a.min / avail) * 1.2);

    var ctx = 0.5, ctxNote = null;
    if (a.tags.indexOf("outdoor") !== -1) {
      if (start + a.min <= 14 * 60) { ctx = 0.9; ctxNote = "dry"; }
      else { ctx = 0.15; ctxNote = "rain"; }
    }

    var total = 0.40 * taste + 0.25 * fitE + 0.15 * fitD + 0.20 * ctx + (a.urgent ? 0.12 : 0);
    return {
      act: a, total: total, w: w, e: e, avail: avail, fitE: fitE, ctxNote: ctxNote,
      pct: Math.min(99, Math.round(52 + total * 45))
    };
  }

  function recommend(g, n) {
    var avail = gapAvail(g);
    var doneId = state.done[g.id];
    return ACTIVITIES
      .filter(function (a) {
        return a.min <= avail - 5 && state.rejected.indexOf(a.id) === -1 && a.id !== doneId;
      })
      .map(function (a) { return scoreAct(a, g); })
      .sort(function (x, y) { return y.total - x.total; })
      .slice(0, n);
  }

  function why(r) {
    var a = r.act;
    if (a.urgent) return a.urgentNote;
    if (r.ctxNote === "dry") return "Dry until 14:00, so this is a good window to be outside";
    if (r.ctxNote === "rain") return "Rain is expected from 14:00, so this one may get wet";
    if (r.w >= 1.5) {
      var top = a.tags.slice().sort(function (x, y) { return state.weights[y] - state.weights[x]; })[0];
      return "Matches your interest in " + TAGS[top].label.toLowerCase();
    }
    if (a.note) return a.note;
    if (r.fitE >= 0.85) return "Fits your predicted energy (" + energyWord(r.e) + ", " + r.e + ")";
    return "Fits neatly into " + len(r.avail);
  }

  // ---------- small view pieces ----------

  function energyChart(gaps) {
    var W = 340, H = 96, top = 8, bottom = 20, plotH = H - top - bottom;
    function x(min) { return clamp((min / 60 - 8) / 13, 0, 1) * W; }
    function y(v) { return top + plotH - (v / 100) * plotH; }

    var arr = ENERGY[state.chrono];
    var pts = arr.map(function (v, i) { return [(i / 13) * W, y(v)]; });
    var d = "M" + pts[0][0] + " " + pts[0][1];
    for (var i = 1; i < pts.length; i++) {
      var mx = (pts[i - 1][0] + pts[i][0]) / 2;
      d += " C" + mx + " " + pts[i - 1][1] + " " + mx + " " + pts[i][1] + " " + pts[i][0] + " " + pts[i][1];
    }
    var area = d + " L" + W + " " + (H - bottom) + " L0 " + (H - bottom) + " Z";

    var shades = gaps.map(function (g) {
      return '<rect x="' + x(g.start).toFixed(1) + '" y="' + top + '" width="' + (x(g.end) - x(g.start)).toFixed(1) +
        '" height="' + plotH + '" rx="4" fill="#2f7d6b" opacity="0.16"/>';
    }).join("");

    var labels = [8, 11, 14, 17, 20].map(function (h) {
      return '<text x="' + x(h * 60) + '" y="' + (H - 4) + '" font-size="10" fill="#6b7773" text-anchor="middle">' + pad(h) + '</text>';
    }).join("");

    var nowX = x(NOW).toFixed(1);
    return '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Predicted energy through the day">' +
      shades +
      '<path d="' + area + '" fill="#2f7d6b" opacity="0.12"/>' +
      '<path d="' + d + '" fill="none" stroke="#2f7d6b" stroke-width="2.5" stroke-linecap="round"/>' +
      '<line x1="' + nowX + '" y1="' + top + '" x2="' + nowX + '" y2="' + (H - bottom) + '" stroke="#e8744f" stroke-width="2" stroke-dasharray="3 3"/>' +
      '<circle cx="' + nowX + '" cy="' + y(energyAt(NOW)).toFixed(1) + '" r="4.5" fill="#e8744f"/>' +
      labels + "</svg>";
  }

  function sugCard(r, g) {
    var a = r.act;
    var liked = state.liked.indexOf(a.id) !== -1;
    return '<article class="card sug">' +
      '<div class="head"><div class="e">' + a.emoji + '</div>' +
      '<div><h3>' + a.title + '</h3><div class="meta">' + len(a.min) + " · " + a.place + '</div></div>' +
      '<div class="match">' + r.pct + '%<small>match</small></div></div>' +
      '<div class="why">Why: ' + why(r) + '</div>' +
      '<div class="actions">' +
      '<button class="btn" data-a="start" data-id="' + a.id + '" data-gap="' + g.id + '">Start</button>' +
      '<button class="iconbtn' + (liked ? " on" : "") + '" data-a="like" data-id="' + a.id + '" aria-label="More like this">👍</button>' +
      '<button class="iconbtn" data-a="reject" data-id="' + a.id + '" aria-label="Not for me">👎</button>' +
      "</div></article>";
  }

  // ---------- screens ----------

  function renderOnboarding() {
    var s = state.step;
    var dots = '<div class="dots">' + [0, 1, 2, 3].map(function (i) { return '<i class="' + (i <= s ? "on" : "") + '"></i>'; }).join("") + "</div>";
    var body = "", foot = "";

    if (s === 0) {
      body = '<div class="logo">⏳</div><h1>Your day has more free time than you think.</h1>' +
        '<p class="muted">Meanwhile finds the gaps between your classes and plans, works out how long they really last, and suggests something that fits: a walk, a call, a nap, a bit of studying.</p>' +
        '<p class="muted">It learns what you like, and when you have the energy for it.</p>';
      foot = '<button class="btn block" data-a="next">Get started</button>';
    } else if (s === 1) {
      body = dots + "<h1>Where does your day live?</h1><p class=\"muted\">We read your timetable to find the gaps. We never edit it.</p>" +
        [["gcal", "📅", "Google Calendar", "Classes, work and plans"], ["uni", "🎓", "University timetable", "Import with your student login"], ["manual", "✋", "I'll add it myself", "You can connect one later"]]
          .map(function (o) {
            return '<button class="opt' + (state.linked === o[0] ? " on" : "") + '" data-a="link" data-v="' + o[0] + '"><span class="e">' + o[1] + "</span><span><b>" + o[2] + '</b><span class="muted small">' + o[3] + "</span></span></button>";
          }).join("");
      foot = '<button class="btn block" data-a="next"' + (state.linked ? "" : " disabled style=\"opacity:.45\"") + ">Continue</button>";
    } else if (s === 2) {
      body = dots + "<h1>What do you enjoy?</h1><p class=\"muted\">Pick a few. This is only a starting point; your taps teach it more.</p>" +
        '<div class="chips">' + tagKeys.map(function (k) {
          return '<button class="chip' + (state.picks.indexOf(k) !== -1 ? " on" : "") + '" data-a="pick" data-t="' + k + '">' + TAGS[k].emoji + " " + TAGS[k].label + "</button>";
        }).join("") + "</div>";
      foot = '<button class="btn block" data-a="next">Continue</button>';
    } else {
      body = dots + "<h1>When are you sharpest?</h1><p class=\"muted\">This sets your starting energy curve. It adjusts as we see how your days go.</p>" +
        [["morning", "🌅", "Morning", "Best before lunch"], ["afternoon", "☀️", "Afternoon", "Picks up after lunch"], ["evening", "🌙", "Evening", "Comes alive late"]]
          .map(function (o) {
            return '<button class="opt' + (state.chrono === o[0] ? " on" : "") + '" data-a="chrono" data-v="' + o[0] + '"><span class="e">' + o[1] + "</span><span><b>" + o[2] + '</b><span class="muted small">' + o[3] + "</span></span></button>";
          }).join("");
      foot = '<button class="btn block" data-a="finish-ob">Build my day</button>';
    }

    var back = s > 0 ? '<button class="back" data-a="back-ob">‹ Back</button>' : "";
    screenEl.innerHTML = '<div class="ob">' + back + '<div class="body">' + body + "</div>" + foot + "</div>";
  }

  function renderToday() {
    var gaps = computeGaps();
    var live = gaps.filter(function (g) { return gapState(g) === "now"; })[0];

    var hero = "";
    if (live) {
      var top = recommend(live, 1)[0];
      hero = '<section class="hero"><div class="eyebrow">Free right now</div>' +
        "<h1>" + len(gapAvail(live)) + " until " + live.before.title + "</h1>" +
        '<div class="small" style="opacity:.85">' + live.after.title + " ran about " + live.after.overrun + " min over, like it usually does.</div>" +
        (top ? '<div class="pick"><div class="e">' + top.act.emoji + '</div><div><b>' + top.act.title + '</b><div class="small" style="opacity:.85">' + len(top.act.min) + " · " + top.pct + "% match</div></div></div>" +
          '<div class="actions" style="margin-top:12px"><button class="btn" data-a="start" data-id="' + top.act.id + '" data-gap="' + live.id + '">Start</button>' +
          '<button class="btn ghost" data-a="open-gap" data-id="' + live.id + '">More ideas</button></div>' : "") +
        "</section>";
    }

    var rows = EVENTS.map(function (ev, i) {
      var past = ev.end + ev.overrun <= NOW;
      var out = '<div class="row' + (past ? " past" : "") + '"><div class="time">' + fmt(ev.start) + '</div><div class="event"><b>' + ev.title + '</b><div class="muted small">' + fmt(ev.start) + "–" + fmt(ev.end) + " · " + ev.place +
        (ev.overrun ? '</div><div style="margin-top:4px"><span class="pill coral">Likely ends ' + fmt(ev.end + ev.overrun) + "</span>" : "") + "</div></div></div>";
      var g = gaps.filter(function (x) { return x.id === i; })[0];
      if (g) {
        var st = gapState(g), doneAct = state.done[g.id] && byId(state.done[g.id]), r = recommend(g, 1)[0];
        var line = doneAct ? "✓ Done: " + doneAct.title :
          r ? r.act.emoji + " " + r.act.title + ' <span class="muted">· ' + r.pct + "%</span>" : '<span class="muted">No ideas fit this gap</span>';
        out += '<div class="row"><div class="time">' + fmt(gapStart(g)) + '</div><button class="gapcard' + (st === "now" ? " live" : "") + (doneAct ? " used" : "") + '" data-a="open-gap" data-id="' + g.id + '">' +
          '<div class="top"><b>' + len(gapAvail(g)) + " free</b>" + (st === "now" ? '<span class="pill">Now</span>' : '<span class="muted small">' + fmt(gapStart(g)) + "–" + fmt(g.end) + "</span>") + "</div>" +
          '<div class="pickline">' + line + "</div></button></div>";
      }
      return out;
    }).join("");

    var gapMins = gaps.reduce(function (s, g) { return s + g.mins; }, 0);

    screenEl.innerHTML = '<div class="eyebrow">Thursday, 22 October</div><h1>Hi, Alex</h1>' + hero +
      '<h2>Your energy today</h2><div class="card">' + energyChart(gaps) +
      '<div class="small muted">Predicted from your sleep and past days. Green bands are your free gaps; the dot is now.</div></div>' +
      "<h2>Today's timeline</h2>" + rows +
      '<p class="small muted" style="margin-top:8px">' + gaps.length + " gaps, " + len(gapMins) + " of free time in total.</p>";
  }

  function renderGap(id) {
    var g = computeGaps().filter(function (x) { return x.id === id; })[0];
    var e = energyAt(gapStart(g));
    var picks = recommend(g, 4);
    var wet = gapStart(g) >= 14 * 60;
    var cards = picks.length ? picks.map(function (r) { return sugCard(r, g); }).join("") :
      '<div class="card muted">Nothing left that fits this gap. Try bringing back hidden ideas in the Taste tab.</div>';

    screenEl.innerHTML = '<div class="topbar"><button class="back" data-a="back">‹ Today</button></div>' +
      '<div class="eyebrow">' + fmt(gapStart(g)) + "–" + fmt(g.end) + "</div>" +
      "<h1>" + len(gapAvail(g)) + " free</h1>" +
      '<p class="muted">Between ' + g.after.title + " and " + g.before.title + ".</p>" +
      '<div class="chips" style="margin:10px 0 4px"><span class="pill">Energy ' + energyWord(e) + " · " + e + '</span><span class="pill">' + (wet ? "🌧 Rain from 14:00" : "☀️ Dry until 14:00") + "</span></div>" +
      "<h2>Picked for you</h2>" + cards +
      '<p class="small muted" style="margin-top:14px">👍 tells us to show more like this. 👎 hides it and shows less of it.</p>';
  }

  function renderSession() {
    var s = state.session;
    screenEl.innerHTML = '<div class="topbar"><button class="back" data-a="swap">‹ Pick something else</button></div>' +
      '<div class="eyebrow">In progress</div><h1>' + s.act.emoji + " " + s.act.title + "</h1>" +
      '<p class="muted">' + s.act.place + '</p><div class="timer">' +
      '<svg width="220" height="220" viewBox="0 0 220 220"><circle cx="110" cy="110" r="98" fill="none" stroke="#e4e0d8" stroke-width="10"/>' +
      '<circle id="ring" cx="110" cy="110" r="98" fill="none" stroke="#2f7d6b" stroke-width="10" stroke-linecap="round" transform="rotate(-90 110 110)" stroke-dasharray="615.8" stroke-dashoffset="0"/></svg>' +
      '<div class="num"><b id="t-left"></b><span class="muted small">left</span></div></div>' +
      '<div class="card small muted">Your next commitment, ' + s.gap.before.title + ", starts at " + fmt(s.gap.end) + ". We'll nudge you in time.</div>" +
      '<div class="actions" style="margin-top:16px"><button class="btn ghost" data-a="swap">Swap</button><button class="btn" data-a="finish-early">I\'m done</button></div>';
    updateTimer();
  }

  function renderRate() {
    var a = state.session.act;
    screenEl.innerHTML = '<div style="padding-top:40px"><div class="logo" style="margin:0 0 16px">' + a.emoji + "</div>" +
      "<h1>How was it?</h1><p class=\"muted\">" + a.title + '. Your answer shapes what we suggest next.</p>' +
      [["great", "😄", "Loved it", "Show me more like this"], ["ok", "🙂", "It was fine", "Keep it in the mix"], ["meh", "😕", "Not really", "Show me less of this"]]
        .map(function (o) {
          return '<button class="opt" data-a="rate" data-v="' + o[0] + '"><span class="e">' + o[1] + "</span><span><b>" + o[2] + '</b><span class="muted small">' + o[3] + "</span></span></button>";
        }).join("") + "</div>";
  }

  function renderTaste() {
    var rows = tagKeys.slice().sort(function (a, b) { return state.weights[b] - state.weights[a]; }).map(function (k) {
      var w = state.weights[k];
      var pct = clamp(Math.abs(w) / 6, 0, 1) * 100;
      return '<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between"><span>' + TAGS[k].emoji + " " + TAGS[k].label +
        '</span><span class="muted small">' + (w > 0.4 ? "Likes" : w < -0.4 ? "Avoids" : "Neutral") + '</span></div><div class="bar"><i class="' + (w < 0 ? "neg" : "") + '" style="width:' + Math.max(pct, 3) + '%"></i></div></div>';
    }).join("");

    var chronos = [["morning", "Morning"], ["afternoon", "Afternoon"], ["evening", "Evening"]].map(function (o) {
      return '<button class="' + (state.chrono === o[0] ? "on" : "") + '" data-a="chrono" data-v="' + o[0] + '">' + o[1] + "</button>";
    }).join("");

    var hidden = state.rejected.length;

    screenEl.innerHTML = '<h1>Your taste</h1><p class="muted">What Meanwhile has learned from what you pick, finish and skip.</p>' +
      '<div class="card" style="margin-top:12px">' + rows + "</div>" +
      "<h2>Sharpest in the</h2><div class=\"seg\">" + chronos + "</div>" +
      '<p class="small muted" style="margin-top:8px">Changing this reshapes your energy curve on the Today tab.</p>' +
      '<h2>Hidden ideas</h2><div class="card" style="display:flex;align-items:center;justify-content:space-between"><span>' +
      (hidden ? hidden + " hidden with 👎" : "Nothing hidden") + "</span>" +
      (hidden ? '<button class="btn soft small" data-a="unhide">Bring back</button>' : "") + "</div>" +
      '<div class="actions" style="margin-top:22px"><button class="btn ghost small" data-a="reset-taste">Reset taste</button><button class="btn ghost small" data-a="replay">Replay intro</button></div>';
  }

  function renderInsights() {
    var days = [["M", 150, 95], ["T", 130, 60], ["W", 175, 120], ["T", 134, 76], ["F", 110, 40], ["S", 60, 20], ["S", 45, 10]];
    var max = 175;
    var free = days.reduce(function (s, d) { return s + d[1]; }, 0);
    var used = days.reduce(function (s, d) { return s + d[2]; }, 0);
    var week = days.map(function (d) {
      return '<div><span class="col" style="height:' + (d[1] / max * 82) + 'px"><i style="height:' + (d[2] / d[1] * 100) + '%"></i></span>' + d[0] + "</div>";
    }).join("");

    var preds = EVENTS.filter(function (e) { return e.overrun > 0; }).map(function (e) {
      return '<div class="pred"><div class="delta">+' + e.overrun + '<small>min</small></div><div><b>' + e.title + '</b><div class="small muted">' +
        "Timetable says " + fmt(e.end) + ", we expect " + fmt(e.end + e.overrun) + ". " + e.seen + " recently.</div></div></div>";
    }).join("");

    screenEl.innerHTML = '<h1>Insights</h1><p class="muted">How your time really behaves.</p>' +
      '<div class="card" style="margin-top:12px"><div class="eyebrow">Free time this week</div><div class="bigstat">' + len(free) + '</div>' +
      '<div class="muted small">You used ' + len(used) + ' of it (' + Math.round(used / free * 100) + '%).</div><div class="week">' + week + "</div></div>" +
      "<h2>Today's timing predictions</h2><div class=\"card\">" + preds + "</div>" +
      '<h2>Energy pattern</h2><div class="card"><p><b>You dip around 14:00.</b></p><p class="small muted">So demanding ideas, like the cover letter or a workout, rank lower then and higher in your sharper hours.</p></div>' +
      '<p class="small muted" style="margin-top:14px">Demo data. In the real app these numbers come from a model trained on your own history.</p>';
  }

  function renderTabbar() {
    tabbarEl.hidden = !!state.view;
    tabbarEl.innerHTML = [["today", "🗓", "Today"], ["taste", "💚", "Taste"], ["insights", "📊", "Insights"]].map(function (t) {
      return '<button class="tab' + (state.tab === t[0] ? " on" : "") + '" data-a="tab" data-v="' + t[0] + '"><span class="ico">' + t[1] + "</span>" + t[2] + "</button>";
    }).join("");
  }

  function render(keepScroll) {
    var y = screenEl.scrollTop;
    var v = state.view;
    if (!state.onboarded) {
      tabbarEl.hidden = true;
      renderOnboarding();
    } else {
      if (v && v.type === "gap") renderGap(v.id);
      else if (v && v.type === "session") renderSession();
      else if (v && v.type === "rate") renderRate();
      else if (state.tab === "taste") renderTaste();
      else if (state.tab === "insights") renderInsights();
      else renderToday();
      renderTabbar();
    }
    screenEl.scrollTop = keepScroll ? y : 0;
  }

  // ---------- session timer ----------

  function updateTimer() {
    var s = state.session;
    if (!s) return;
    var left = document.getElementById("t-left");
    var ring = document.getElementById("ring");
    if (left) left.textContent = pad(Math.floor(s.left / 60)) + ":" + pad(s.left % 60);
    if (ring) ring.setAttribute("stroke-dashoffset", String(615.8 * (1 - s.left / s.total)));
  }

  function stopTimer() { clearInterval(timer); timer = null; }

  function startTimer() {
    stopTimer();
    timer = setInterval(function () {
      var s = state.session;
      if (!s) return stopTimer();
      s.left = Math.max(0, s.left - 1);
      updateTimer();
      if (s.left === 0) {
        stopTimer();
        state.view = { type: "rate" };
        render(false);
      }
    }, 1000);
  }

  // ---------- actions ----------

  function shiftWeights(tags, delta) {
    tags.forEach(function (t) { state.weights[t] = clamp(state.weights[t] + delta, -6, 6); });
  }

  var actions = {
    "next": function () {
      if (state.step === 2 && !state.picks.length) return toast("Pick at least one so we have a starting point");
      state.step++; render(false);
    },
    "back-ob": function () { state.step = Math.max(0, state.step - 1); render(false); },
    "link": function (d) { state.linked = d.v; render(true); },
    "pick": function (d) {
      var i = state.picks.indexOf(d.t);
      if (i === -1) state.picks.push(d.t); else state.picks.splice(i, 1);
      render(true);
    },
    "chrono": function (d) {
      state.chrono = d.v; save(); render(true);
    },
    "finish-ob": function () {
      state.weights = zeroWeights();
      shiftWeights(state.picks, 2.5);
      state.onboarded = true; state.tab = "today"; state.view = null;
      save(); render(false);
    },
    "tab": function (d) { state.tab = d.v; render(false); },
    "open-gap": function (d) { state.view = { type: "gap", id: Number(d.id) }; render(false); },
    "back": function () { state.view = null; render(false); },
    "like": function (d) {
      var a = byId(d.id), i = state.liked.indexOf(a.id);
      if (i === -1) { state.liked.push(a.id); shiftWeights(a.tags, 0.6); toast("Noted. More like this."); }
      else { state.liked.splice(i, 1); shiftWeights(a.tags, -0.6); }
      save(); render(true);
    },
    "reject": function (d) {
      var a = byId(d.id);
      state.rejected.push(a.id);
      shiftWeights(a.tags, -1);
      save(); toast("Hidden. We'll suggest less like this.");
      render(true);
    },
    "start": function (d) {
      var a = byId(d.id);
      var g = computeGaps().filter(function (x) { return x.id === Number(d.gap); })[0];
      state.session = { act: a, gap: g, total: a.min * 60, left: a.min * 60 };
      state.view = { type: "session" };
      render(false); startTimer();
    },
    "swap": function () {
      stopTimer();
      var gid = state.session.gap.id;
      state.session = null;
      state.view = { type: "gap", id: gid };
      render(false);
    },
    "finish-early": function () { stopTimer(); state.view = { type: "rate" }; render(false); },
    "rate": function (d) {
      var s = state.session;
      shiftWeights(s.act.tags, d.v === "great" ? 1.5 : d.v === "ok" ? 0.3 : -1.2);
      state.done[s.gap.id] = s.act.id;
      state.session = null; state.view = null; state.tab = "today";
      save();
      toast(d.v === "meh" ? "Thanks. We'll try something different next time." : "Thanks. Your picks just got smarter.");
      render(false);
    },
    "unhide": function () { state.rejected = []; toast("Hidden ideas are back."); render(true); },
    "reset-taste": function () { state.weights = zeroWeights(); state.liked = []; save(); toast("Taste reset."); render(true); },
    "replay": function () {
      state.onboarded = false; state.step = 0; state.picks = []; state.linked = null; state.view = null;
      render(false);
    }
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
