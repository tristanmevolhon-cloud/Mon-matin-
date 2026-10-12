(() => {
  const $ = (id) => document.getElementById(id), esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]), ls = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v == null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {
      }
    }
  }, N = window.Native || null, SETUP_KEYS = ["token", "aiKey", "aiModel", "planning", "newsThemes", "newsUne", "layout6", "themeMode", "styleMode", "animOn", "favs", "lists", "webWall"];
  let setupImported = 0;
  (function() {
    const m = String(location.hash || "").match(/[#&]setup=([^&]+)/);
    if (m) {
      try {
        const json = decodeURIComponent(escape(atob(m[1].replace(/-/g, "+").replace(/_/g, "/")))), data = JSON.parse(json);
        SETUP_KEYS.forEach((k) => {
          data[k] !== void 0 && (ls.set(k, data[k]), setupImported++);
        });
      } catch (e) {
        setupImported = -1;
      }
      try {
        history.replaceState(null, "", location.pathname + location.search);
      } catch (e) {
        location.hash = "";
      }
    }
  })();
  N || document.documentElement.classList.add("web");
  !N && "serviceWorker" in navigator && location.protocol === "https:" && window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
    });
  });
  const pad = (n) => String(n).padStart(2, "0"), todayISO = () => {
    const d = /* @__PURE__ */ new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }, nowMin = () => {
    const d = /* @__PURE__ */ new Date();
    return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  }, cap = (s) => s.charAt(0).toUpperCase() + s.slice(1), longDate = (d) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }), hm = (m) => pad(Math.floor(m / 60) % 24) + ":" + pad(Math.round(m) % 60), toMin = (t) => {
    const m = String(t).match(/(\d{1,2})\D?(\d{2})/);
    return m ? +m[1] * 60 + +m[2] : null;
  }, durTxt = (min) => Math.floor(min / 60) + "h" + pad(min % 60), isoOf = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()), dateOf = (iso) => /* @__PURE__ */ new Date(iso + "T12:00:00"), addDays = (iso, n) => {
    const d = dateOf(iso);
    return d.setDate(d.getDate() + n), isoOf(d);
  }, tomorrowISO = () => addDays(todayISO(), 1), dayWord = (iso) => iso === todayISO() ? "aujourd\u2019hui" : iso === tomorrowISO() ? "demain" : longDate(dateOf(iso)), log = [];
  function note(msg) {
    log.unshift((/* @__PURE__ */ new Date()).toLocaleTimeString("fr-FR") + " " + msg), log.length = Math.min(log.length, 12);
  }
  function showError(msg) {
    note("ERREUR " + msg), $("errbar").textContent = msg, $("errbar").hidden = !1;
  }
  const pending = {};
  window.__nativeDone = (id, status, body) => {
    const p = pending[id];
    p && (delete pending[id], p({ status, body }));
  };
  function viaNative(url, auth) {
    return new Promise((resolve) => {
      const id = Math.random().toString(36).slice(2);
      pending[id] = resolve, setTimeout(() => {
        pending[id] && (delete pending[id], resolve({ status: 0, body: "d\xE9lai d\xE9pass\xE9" }));
      }, 2e4), N.get(id, url, auth || "");
    });
  }
  function viaFetch(url, auth) {
    const ctrl = typeof AbortController < "u" ? new AbortController() : null, t = setTimeout(() => ctrl && ctrl.abort(), 2e4);
    return fetch(url, { headers: auth ? { Authorization: auth } : {}, signal: ctrl ? ctrl.signal : void 0 }).then((r) => r.text().then((body) => ({ status: r.status, body }))).catch((e) => ({ status: 0, body: String(e && e.message || e) })).then((r) => (clearTimeout(t), r));
  }
  async function httpGet(url, auth, preferNative) {
    const order = preferNative && N ? [viaNative, viaFetch] : N ? [viaFetch, viaNative] : [viaFetch];
    let last = null;
    for (const fn of order) {
      if (last = await fn(url, auth), last.status !== 0) return last;
      note((fn === viaNative ? "Android" : "fetch") + " \xE9chec : " + last.body);
    }
    return last;
  }
  let view = ls.get("view", "home"), token = String(ls.get("token", "") || "").replace(/[^A-Za-z0-9-]/g, ""), weather = ls.get("weather", null), live = ls.get("live2", null), trainErr = "", dir = ls.get("dir", (/* @__PURE__ */ new Date()).getHours() >= 13 ? "retour" : "aller"), favs = ls.get("favs", []), planning = ls.get("planning", { pattern: [!1, !0, !0, !0, !0, !0, !1], overrides: {} });
  const isTrainDay = (iso) => Object.prototype.hasOwnProperty.call(planning.overrides, iso) ? planning.overrides[iso] : !!planning.pattern[dateOf(iso).getDay()], plannedDates = (n) => {
    const out = [];
    for (let k = 0; k < n; k++) {
      const iso = addDays(todayISO(), k);
      isTrainDay(iso) && out.push(iso);
    }
    return out;
  };
  function savePlanning() {
    const today = todayISO();
    Object.keys(planning.overrides).forEach((k) => {
      k < today && delete planning.overrides[k];
    }), ls.set("planning", planning), syncNative();
  }
  let trainDay = "today";
  const shownISO = () => trainDay === "today" ? todayISO() : tomorrowISO();
  let alertOn = ls.get("alertOn", !0), lists = ls.get("lists", null) || [{ id: "afaire", name: "\xC0 faire", items: [] }, { id: "courses", name: "Courses", items: [] }], current = ls.get("list", lists[0] && lists[0].id), editing = null, confirmDel = !1;
  const PAGES = ["meteo", "home", "trains", "news", "lists"];
  function pageEl(v) {
    return document.querySelector('.page[data-view="' + v + '"]');
  }
  function markDots(v) {
    document.querySelectorAll("#dots button").forEach((b) => b.classList.toggle("on", b.dataset.view === v));
  }
  function show(v, instant) {
    PAGES.indexOf(v) < 0 && (v = "home"), view = v;
    const pg = $("pager"), el = pageEl(v);
    if (pg && el) {
      const left = PAGES.indexOf(v) * pg.clientWidth;
      try {
        pg.scrollTo({ left, behavior: instant || typeof animOn < "u" && !animOn ? "auto" : "smooth" });
      } catch (e) {
        pg.scrollLeft = left;
      }
    }
    markDots(v);
  }
  document.querySelectorAll("#dots button").forEach((b) => b.addEventListener("click", () => show(b.dataset.view)));
  (function() {
    const pg = $("pager");
    let t = null;
    pg.addEventListener("scroll", () => {
      clearTimeout(t), t = setTimeout(() => {
        const i = Math.round(pg.scrollLeft / Math.max(1, pg.clientWidth)), v = PAGES[Math.min(PAGES.length - 1, Math.max(0, i))];
        v !== view && (view = v, markDots(v));
      }, 80);
    }, { passive: !0 }), window.addEventListener("resize", () => show(view, !0));
  })();
  window.onAppBack = () => $("detail").hidden ? $("settings").hidden ? editing ? (editing = null, renderLists(), !0) : view !== "home" ? (show("home"), !0) : !1 : ($("settings").hidden = !0, !0) : (closeDetail(), !0);
  const WMO = {
    0: "Ciel d\xE9gag\xE9",
    1: "Plut\xF4t d\xE9gag\xE9",
    2: "Partiellement nuageux",
    3: "Couvert",
    45: "Brouillard",
    48: "Brouillard givrant",
    51: "Bruine l\xE9g\xE8re",
    53: "Bruine",
    55: "Bruine forte",
    56: "Bruine vergla\xE7ante",
    57: "Bruine vergla\xE7ante",
    61: "Pluie faible",
    63: "Pluie",
    65: "Forte pluie",
    66: "Pluie vergla\xE7ante",
    67: "Pluie vergla\xE7ante",
    71: "Neige faible",
    73: "Neige",
    75: "Forte neige",
    77: "Grains de neige",
    80: "Averses",
    81: "Averses",
    82: "Fortes averses",
    85: "Averses de neige",
    86: "Averses de neige",
    95: "Orage",
    96: "Orage et gr\xEAle",
    99: "Orage et gr\xEAle"
  }, sky = (c) => WMO[c] || "\u2014";
  async function loadWeather() {
    const r = await httpGet("https://api.open-meteo.com/v1/forecast?latitude=47.322&longitude=5.041&timezone=Europe%2FParis&forecast_days=5&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code,wind_speed_10m_max,sunrise,sunset,uv_index_max", "", !1);
    if (r.status !== 200) throw new Error("m\xE9t\xE9o indisponible (" + (r.status || r.body) + ")");
    const j = JSON.parse(r.body), at = (h) => {
      const i = j.hourly.time.findIndex((t) => t.slice(-5) === pad(h) + ":00");
      return i < 0 ? {} : { temp: Math.round(j.hourly.temperature_2m[i]), sky: sky(j.hourly.weather_code[i]), rain: j.hourly.precipitation_probability[i] };
    };
    weather = {
      date: todayISO(),
      at: Date.now(),
      now: Math.round(j.current.temperature_2m),
      nowSky: sky(j.current.weather_code),
      code: j.current.weather_code,
      tmax: Math.round(j.daily.temperature_2m_max[0]),
      tmin: Math.round(j.daily.temperature_2m_min[0]),
      rain: j.daily.precipitation_probability_max[0],
      wind: Math.round(j.daily.wind_speed_10m_max[0]),
      periods: [["Matin", 8], ["Midi", 13], ["Soir", 18]].map((p) => Object.assign({ label: p[0] }, at(p[1]))),
      feels: Math.round(j.current.apparent_temperature),
      humidity: j.current.relative_humidity_2m,
      windNow: Math.round(j.current.wind_speed_10m),
      gusts: Math.round(j.current.wind_gusts_10m),
      hourly: j.hourly.time.map((t, i) => ({
        t,
        temp: j.hourly.temperature_2m[i],
        feels: j.hourly.apparent_temperature[i],
        rain: j.hourly.precipitation_probability[i],
        mm: j.hourly.precipitation[i],
        code: j.hourly.weather_code[i],
        wind: j.hourly.wind_speed_10m[i]
      })),
      days: j.daily.time.map((t, i) => ({
        t,
        max: Math.round(j.daily.temperature_2m_max[i]),
        min: Math.round(j.daily.temperature_2m_min[i]),
        rain: j.daily.precipitation_probability_max[i],
        mm: j.daily.precipitation_sum[i],
        code: j.daily.weather_code[i],
        wind: Math.round(j.daily.wind_speed_10m_max[i]),
        sunrise: j.daily.sunrise[i],
        sunset: j.daily.sunset[i],
        uv: j.daily.uv_index_max[i]
      }))
    }, ls.set("weather", weather), note("m\xE9t\xE9o OK");
  }
  function advice(w) {
    const morning = w.periods[0] && w.periods[0].temp != null ? w.periods[0].temp : w.tmin, tips = [];
    return w.rain >= 50 ? tips.push("Prends un parapluie.") : w.rain >= 30 && tips.push("Risque d\u2019averse, un parapluie peut servir."), morning <= 3 ? tips.push("Il fait presque 0\xB0 au d\xE9part, couvre-toi bien.") : morning <= 10 && tips.push("Frais le matin, prends une veste."), tips.join(" ");
  }
  function renderWeather() {
    const box = $("wx");
    if (!box) return;
    if (!weather) {
      box.innerHTML = '<span class="label">M\xE9t\xE9o \xB7 Dijon</span><p class="hint">M\xE9t\xE9o indisponible. V\xE9rifie ta connexion puis touche \u21BB.</p>';
      return;
    }
    const per = weather.periods.filter((p) => p.temp != null).map((p) => `<div class="period"><span class="label">${esc(p.label)}</span><b class="num">${p.temp}\xB0</b><span>${esc(p.sky)}${p.rain ? " \xB7 " + p.rain + " %" : ""}</span></div>`).join(""), tip = advice(weather);
    box.classList.toggle("tap", !!weather.hourly), box.onclick = weather.hourly ? () => show("meteo") : null, box.innerHTML = `<div class="bhead"><span class="label">M\xE9t\xE9o \xB7 Dijon</span><span class="${weather.date !== todayISO() ? "s" : "more"}">${weather.date !== todayISO() ? "d\u2019hier, actualise" : weather.hourly ? "D\xE9tails" : ""}</span></div>
    <div class="wx"><span class="big num">${weather.now}\xB0</span>
      <div class="side"><strong>${esc(weather.nowSky)}</strong><span class="muted num">${weather.tmin}\xB0 / ${weather.tmax}\xB0 \xB7 pluie ${weather.rain || 0} % \xB7 vent ${weather.wind} km/h</span></div></div>
    ${tip ? `<p class="hint">${esc(tip)}</p>` : ""}
    ${per ? `<div class="periods">${per}</div>` : ""}`;
  }
  const STATIC = {
    aller: [
      ["06:12", "07:05", "893003"],
      ["07:12", "08:05", "893007"],
      ["08:12", "09:05", "893009"],
      ["09:47", "10:42", "893011"],
      ["12:12", "13:05", "893013"],
      ["14:12", "15:05", "893017"],
      ["15:47", "16:41", "893019"],
      ["17:12", "18:05", "893021"],
      ["18:12", "19:05", "893025"],
      ["19:12", "20:05", "893027"]
    ],
    retour: [
      ["06:56", "07:48", "893150"],
      ["07:56", "08:48", "893152"],
      ["08:56", "09:48", "893156"],
      ["10:57", "11:48", "893158"],
      ["14:56", "15:48", "893164"],
      ["16:56", "17:49", "893166"],
      ["18:56", "19:49", "893168"],
      ["20:56", "21:48", "893176"]
    ]
  }, NAMES = { aller: ["Dijon Ville", "Le Creusot Ville"], retour: ["Le Creusot Ville", "Dijon Ville"] }, staticTrains = (d) => STATIC[d].map((x) => {
    const dm = toMin(x[0]), am = toMin(x[1]);
    return {
      sched: dm,
      dep: dm,
      arr: am,
      arrBase: am,
      dur: am - dm,
      changes: 0,
      type: "TER",
      number: x[2],
      delay: 0,
      status: "",
      messages: [],
      legs: [{ from: NAMES[d][0], to: NAMES[d][1], mode: "TER", number: x[2], direction: "", dep: dm, depBase: dm, arr: am, arrBase: am, stops: [] }],
      waits: []
    };
  }), API = "https://api.sncf.com/v1/coverage/sncf";
  function sncfError(status, msg, id) {
    const e = new Error(msg);
    return e.status = status, e.id = id || "", e;
  }
  async function sncf(path) {
    const r = await httpGet(API + path, token, !0);
    if (r.status === 200) return JSON.parse(r.body);
    let detail = "", id = "";
    try {
      const j = JSON.parse(r.body);
      id = j.error && j.error.id || "", detail = j.error && j.error.message || j.message || "";
    } catch (e) {
    }
    throw r.status === 401 ? sncfError(401, "cl\xE9 SNCF refus\xE9e (401) : v\xE9rifie qu\u2019elle est compl\xE8te, sans espace ni guillemet.", id) : r.status === 403 ? sncfError(403, "acc\xE8s refus\xE9 par la SNCF (403)" + (detail ? " : " + detail : ""), id) : r.status === 429 ? sncfError(429, "quota de la cl\xE9 SNCF d\xE9pass\xE9 (429), r\xE9essaie plus tard.", id) : r.status === 0 ? sncfError(0, "pas de connexion \xE0 l\u2019API SNCF (" + r.body + ")", id) : sncfError(r.status, "SNCF HTTP " + r.status + (detail ? " : " + detail : ""), id);
  }
  const isNoSolution = (e) => e && (e.status === 404 || /no_solution|date_out_of_bounds|no_origin|no_destination/.test(e.id || ""));
  async function stopArea(q, good, bad) {
    const key = "stop4:" + q, cached = ls.get(key, null);
    if (cached && cached.id) return cached;
    const ok = ((await sncf("/places?type%5B%5D=stop_area&count=10&q=" + encodeURIComponent(q))).places || []).filter((p) => p.embedded_type === "stop_area").filter((p) => !bad.test(p.name)), pick = ok.find((p) => good.test(p.name)) || ok[0];
    if (!pick) throw new Error("gare \xAB " + q + " \xBB introuvable");
    const st = { id: pick.id, name: pick.name };
    return ls.set(key, st), st;
  }
  const parseNav = (s) => {
    const m = String(s || "").match(/T(\d{2})(\d{2})/);
    return m ? +m[1] * 60 + +m[2] : null;
  };
  async function journeys(from, to, iso) {
    const ymd = iso.replace(/-/g, ""), out = [], seen = {}, windows = await Promise.all(["050000", "100000", "150000"].map((start) => sncf("/journeys?from=" + encodeURIComponent(from) + "&to=" + encodeURIComponent(to) + "&datetime=" + ymd + "T" + start + "&count=6&max_nb_transfers=0&direct_path=none&data_freshness=realtime").catch((e) => {
      if (isNoSolution(e)) return { journeys: [] };
      throw e;
    })));
    for (const j of windows)
      (j.journeys || []).forEach((jr) => {
        if (String(jr.departure_date_time).indexOf(ymd) !== 0) return;
        const pt = (jr.sections || []).filter((s) => s.type === "public_transport");
        if (pt.length !== 1 || jr.nb_transfers > 0 || jr.duration > 90 * 60 || (jr.sections || []).filter((s) => s.type === "street_network" || s.type === "transfer").reduce((a, s) => a + (s.duration || 0), 0) > 10 * 60) return;
        const first = pt[0], last = pt[pt.length - 1], dep = parseNav(first.departure_date_time), sched = parseNav(first.base_departure_date_time || first.departure_date_time), arr = parseNav(last.arrival_date_time), key = sched + "-" + parseNav(last.base_arrival_date_time || last.arrival_date_time);
        if (seen[key]) return;
        seen[key] = 1;
        const modes = [];
        pt.forEach((s) => {
          const m = s.display_informations && s.display_informations.commercial_mode;
          m && modes.indexOf(m) < 0 && modes.push(m);
        });
        const legs = pt.map((s) => {
          const di = s.display_informations || {};
          return {
            from: s.from && s.from.name || "",
            to: s.to && s.to.name || "",
            mode: di.commercial_mode || di.physical_mode || "Train",
            number: di.headsign || di.trip_short_name || "",
            direction: di.direction || "",
            dep: parseNav(s.departure_date_time),
            depBase: parseNav(s.base_departure_date_time || s.departure_date_time),
            arr: parseNav(s.arrival_date_time),
            arrBase: parseNav(s.base_arrival_date_time || s.arrival_date_time),
            stops: (s.stop_date_times || []).map((st) => ({
              name: st.stop_point && st.stop_point.name || "",
              t: parseNav(st.departure_date_time || st.arrival_date_time),
              base: parseNav(st.base_departure_date_time || st.base_arrival_date_time || st.departure_date_time)
            })),
            links: (di.links || []).filter((l) => l.type === "disruption").map((l) => l.id)
          };
        }), waits = [];
        for (let k = 1; k < legs.length; k++) waits.push({ at: legs[k].from, min: legs[k].dep - legs[k - 1].arr });
        const ids = [];
        legs.forEach((l) => l.links.forEach((id) => {
          ids.indexOf(id) < 0 && ids.push(id);
        }));
        const messages = [];
        (j.disruptions || []).forEach((d) => {
          ids.indexOf(d.id) < 0 && ids.indexOf(d.disruption_id) < 0 || (d.messages || []).forEach((m) => {
            const t = String(m.text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/ ([.,;:!?])/g, "$1").trim();
            t && messages.indexOf(t) < 0 && messages.push(t);
          });
        }), out.push({
          sched,
          dep,
          arr,
          arrBase: parseNav(last.base_arrival_date_time || last.arrival_date_time),
          dur: Math.round(jr.duration / 60),
          changes: jr.nb_transfers,
          type: modes.join(" + ") || "Train",
          number: legs.map((l) => l.number).filter(Boolean).join(" / "),
          delay: dep - sched,
          status: jr.status || "",
          legs,
          waits,
          messages
        });
      });
    return out.sort((a, b) => a.sched - b.sched);
  }
  let stations = ls.get("stations", null);
  async function loadTrains() {
    if (trainErr = "", !!token) {
      try {
        const dijon = await stopArea("Dijon Ville", /^dijon( ville)?$/i, /porte|perrigny|longvic/i), creusot = await stopArea("Le Creusot", /^le creusot( ville)?$/i, /TGV|montchanin|montceau/i);
        stations = { dijon, creusot }, ls.set("stations", stations);
        const days = {};
        for (const iso of [todayISO(), tomorrowISO()])
          try {
            const both = await Promise.all([journeys(dijon.id, creusot.id, iso), journeys(creusot.id, dijon.id, iso)]);
            days[iso] = { aller: both[0], retour: both[1] };
          } catch (e) {
            if (iso === todayISO() || [401, 403, 429, 0].indexOf(e.status) >= 0) throw e;
            note("demain indisponible : " + e.message);
          }
        live = { at: Date.now(), days }, ls.set("live2", live), note("trains OK : aujourd\u2019hui " + days[todayISO()].aller.length + "/" + days[todayISO()].retour.length + ", demain " + days[tomorrowISO()].aller.length + "/" + days[tomorrowISO()].retour.length);
      } catch (e) {
        trainErr = e.message, note("trains : " + e.message);
      }
      syncNative();
    }
  }
  const liveDay = (iso) => token && live && live.days && live.days[iso] || null, isLive = (iso) => {
    const L = liveDay(iso || todayISO());
    return !!(L && (L.aller.length || L.retour.length));
  }, trainsFor = (d, iso) => {
    const L = liveDay(iso || todayISO());
    return L && L[d] && L[d].length ? L[d] : staticTrains(d);
  }, cancelled = (t) => /NO_SERVICE/.test(t.status);
  function chipFor(t, iso) {
    return cancelled(t) ? '<span class="chip bad">Supprim\xE9</span>' : t.delay > 0 ? `<span class="chip late">+${t.delay} min</span>` : isLive(iso) ? '<span class="chip ok">\xC0 l\u2019heure</span>' : "";
  }
  const isFav = (d, t) => favs.some((f) => f.dir === d && f.dep === hm(t.sched));
  function renderTrains() {
    const iso = shownISO(), isToday = iso === todayISO();
    document.querySelectorAll("#dirseg button").forEach((b) => b.classList.toggle("on", b.dataset.dir === dir)), document.querySelectorAll("#daychips button").forEach((b) => b.classList.toggle("on", b.dataset.day === trainDay)), $("dayinfo").innerHTML = `<span class="chip ${isTrainDay(iso) ? "next" : ""}">${isTrainDay(iso) ? "Jour au Creusot" : "Jour \xE0 Dijon"}</span> <span class="s">${cap(longDate(dateOf(iso)))}</span>`, $("tr-link").href = "https://www.sncf-connect.com/train/horaires/" + (dir === "aller" ? "dijon/le-creusot" : "le-creusot/dijon"), $("tr-src").textContent = trainErr ? "Temps r\xE9el indisponible : " + trainErr : isLive(iso) ? "Temps r\xE9el SNCF \xB7 " + new Date(live.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) + (stations ? " \xB7 " + stations.dijon.name + " \u21C4 " + stations.creusot.name : "") : "Horaires indicatifs de semaine, sans retards. Ajoute ta cl\xE9 SNCF dans les r\xE9glages.";
    const list = trainsFor(dir, iso), now = isToday ? nowMin() : -1;
    let marked = !1;
    $("rows").innerHTML = list.map((t, i) => {
      let cls = "";
      t.dep < now - 0.5 ? cls = "past" : !marked && !cancelled(t) && (cls = "isnext", marked = !0);
      const ch = t.changes === 0 ? "direct" : t.changes + " corresp.", fav = isFav(dir, t), chip = chipFor(t, iso) || (cls === "isnext" ? `<span class="chip next">${isToday ? "Prochain" : "Premier"}</span>` : "");
      return `<div class="train tap ${cls}" data-open="${i}">
      <span class="dep num">${hm(t.sched)}</span>
      <div class="mid"><span class="num">\u2192 ${hm(t.arr)} \xB7 ${durTxt(t.dur)}</span><span class="s">${esc(t.type)}${t.number ? " " + esc(t.number) : ""} \xB7 ${ch}</span>${chip ? `<span>${chip}</span>` : ""}</div>
      <button class="star ${fav ? "on" : ""}" data-i="${i}" aria-label="${fav ? "Retirer des favoris" : "Ajouter aux favoris"}"><svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8z"/></svg></button>
    </div>`;
    }).join("") || `<div class="bubble"><p class="hint">Aucun train direct trouv\xE9 ${dayWord(iso)}.</p></div>`, $("rows").querySelectorAll(".star").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation(), toggleFav(dir, list[+b.dataset.i]);
    })), $("rows").querySelectorAll("[data-open]").forEach((el) => el.addEventListener("click", () => openTrain(dir, list[+el.dataset.open], iso)));
  }
  document.querySelectorAll("#daychips button").forEach((b) => b.addEventListener("click", () => {
    trainDay = b.dataset.day, renderTrains();
  }));
  function toggleFav(d, t) {
    const dep = hm(t.sched);
    isFav(d, t) ? favs = favs.filter((f) => !(f.dir === d && f.dep === dep)) : favs.push({ dir: d, dep }), ls.set("favs", favs), syncNative(), renderAll();
  }
  document.querySelectorAll("#dirseg button").forEach((b) => b.addEventListener("click", () => {
    dir = b.dataset.dir, ls.set("dir", dir), renderTrains();
  }));
  let lastFirst = "";
  function renderNext() {
    const today = todayISO(), now = nowMin(), box = $("next");
    if (!box) {
      renderTomorrow();
      return;
    }
    const tag = isLive(today) ? "temps r\xE9el" : "horaires indicatifs";
    if (!isTrainDay(today)) {
      const f = trainsFor("aller", tomorrowISO()).find((t) => !cancelled(t));
      box.innerHTML = `<div class="bhead"><span class="label">Dijon \u2192 Le Creusot</span><span class="s">planning</span></div>
      <strong style="font-size:1.3rem">Journ\xE9e \xE0 Dijon</strong>
      <span class="s">${isTrainDay(tomorrowISO()) && f ? "Demain, premier direct \xE0 " + hm(f.sched) : "Pas de train pr\xE9vu"}</span>
      <span class="more">Voir les horaires quand m\xEAme</span>`, box.classList.add("tap"), box.onclick = () => {
        trainDay = "today", dir = "aller", renderTrains(), show("trains");
      }, renderTomorrow();
      return;
    }
    box.classList.remove("tap"), box.onclick = null;
    const list = trainsFor("aller", today).filter((t) => t.dep >= now - 0.5).slice(0, 3), first = list[0] ? hm(list[0].sched) + (list[0].delay || 0) + list[0].status : "";
    box.innerHTML = `<div class="bhead"><span class="label">Dijon \u2192 Le Creusot</span><span class="s">${tag}</span></div>
    ${list.length ? list.map((t, i) => `<div class="trow ${i === 0 ? "first" : ""}" data-sched="${t.sched}">
        <span class="h num ${i === 0 && first !== lastFirst ? "pop" : ""}">${hm(t.sched)}</span><span class="a num">arriv\xE9e ${hm(t.arr)} \xB7 ${durTxt(t.dur)}</span>${chipFor(t, today)}</div>`).join("") : '<strong>Plus de direct aujourd\u2019hui</strong><span class="s">Regarde la carte Demain.</span>'}`, lastFirst = first, box.querySelectorAll("[data-sched]").forEach((el) => el.addEventListener("click", () => {
      const t = trainsFor("aller", today).find((x) => x.sched === +el.dataset.sched);
      t && openTrain("aller", t, today);
    })), renderTomorrow();
  }
  function renderTomorrow() {
    if (!$("tomorrow")) return;
    const iso = tomorrowISO(), plan = isTrainDay(iso), first = trainsFor("aller", iso).find((t) => !cancelled(t)), back = trainsFor("retour", iso).filter((t) => !cancelled(t)), lastBack = back[back.length - 1], wd = weather && weather.days && weather.days.find((x) => x.t === iso);
    $("tomorrow").innerHTML = `<div class="bhead"><span class="label">Demain \xB7 ${esc(dateOf(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" }))}</span><span class="chip ${plan ? "next" : ""}">${plan ? "Jour au Creusot" : "Jour \xE0 Dijon"}</span></div>
    <div class="kv">
      ${plan && first ? `<div><span class="s">Premier direct</span><b class="num">${hm(first.sched)} \u2192 ${hm(first.arr)}</b></div>` : `<div><span class="s">Trains</span><b>${plan ? "Aucun direct" : "Pas de trajet"}</b></div>`}
      ${plan && lastBack ? `<div><span class="s">Dernier retour</span><b class="num">${hm(lastBack.sched)}</b></div>` : ""}
      ${wd ? `<div><span class="s">M\xE9t\xE9o</span><b class="num">${wd.min}\xB0 / ${wd.max}\xB0</b><span class="s">${esc(sky(wd.code))}${wd.rain ? " \xB7 pluie " + wd.rain + " %" : ""}</span></div>` : ""}
    </div>
    <span class="more">Voir les trains de demain</span>`, $("tomorrow").onclick = () => {
      trainDay = "tomorrow", show("trains"), renderTrains();
    };
  }
  let detailRefresh = null;
  function openDetail(kicker, title, render) {
    $("dt-kicker").textContent = kicker, $("dt-title").textContent = title, detailRefresh = render, render(), $("detail").hidden = !1, $("detail").scrollTop = 0;
  }
  function closeDetail() {
    $("detail").hidden = !0, detailRefresh = null;
  }
  $("closedetail").addEventListener("click", closeDetail);
  function timeCell(real, base) {
    return real != null && base != null && real !== base ? `${hm(real)}<s>${hm(base)}</s>` : hm(base != null ? base : real);
  }
  function openTrain(d, t0, iso) {
    iso = iso || todayISO();
    const where = (d === "aller" ? "Dijon \u2192 Le Creusot" : "Le Creusot \u2192 Dijon") + (iso === todayISO() ? "" : " \xB7 " + dayWord(iso));
    openDetail(where, "Train de " + hm(t0.sched), () => {
      const t = trainsFor(d, iso).find((x) => x.sched === t0.sched && x.arrBase === t0.arrBase) || t0, fav = isFav(d, t), cls = cancelled(t) ? "alert" : t.delay > 0 ? "warn" : "accent", legHTML = (t.legs || []).map((l, k) => {
        const stops = l.stops.length ? l.stops : [{ name: l.from, t: l.dep, base: l.depBase }, { name: l.to, t: l.arr, base: l.arrBase }];
        return `${k > 0 && t.waits[k - 1] ? `<div class="bubble"><span class="label">Correspondance</span><strong>${esc(t.waits[k - 1].at)} \xB7 ${t.waits[k - 1].min} min</strong></div>` : ""}
      <div class="bubble">
        <div class="bhead"><span class="label">${esc(l.mode)}${l.number ? " " + esc(l.number) : ""}</span><span class="s">${l.direction ? "direction " + esc(l.direction) : ""}</span></div>
        <ul class="timeline">${stops.map((st, i) => `<li class="${i === 0 || i === stops.length - 1 ? "end" : ""}"><span class="tm num">${timeCell(st.t, st.base)}</span><span class="dot"></span><span class="nm">${esc(st.name)}</span></li>`).join("")}</ul>
        ${l.stops.length ? "" : `<p class="hint">${isLive(iso) ? "Arr\xEAts interm\xE9diaires non fournis pour ce train." : "Les arr\xEAts interm\xE9diaires et les retards s\u2019affichent avec la cl\xE9 SNCF."}</p>`}
      </div>`;
      }).join("");
      $("dt-body").innerHTML = `
      <div class="bubble ${cls}">
        <span class="hero-t num">${hm(t.sched)} \u2192 ${hm(t.arrBase != null ? t.arrBase : t.arr)}</span>
        <span class="${cls === "accent" ? "muted" : "s"}">${esc(t.type)}${t.number ? " " + esc(t.number) : ""} \xB7 ${t.changes === 0 ? "direct" : t.changes + " correspondance" + (t.changes > 1 ? "s" : "")} \xB7 ${durTxt(t.dur)}</span>
        ${cancelled(t) ? "<strong>Train supprim\xE9</strong>" : t.delay > 0 ? `<strong>Retard de ${t.delay} min \xB7 d\xE9part ${hm(t.dep)}, arriv\xE9e ${hm(t.arr)}</strong>` : isLive(iso) ? "<strong>\xC0 l\u2019heure</strong>" : '<span class="muted">Horaire indicatif, retards non connus sans cl\xE9 SNCF</span>'}
      </div>
      ${t.messages && t.messages.length ? `<div class="bubble"><span class="label">Info trafic</span>${t.messages.map((m) => `<div class="msg">${esc(m)}</div>`).join("")}</div>` : ""}
      <div class="bubble">
        <span class="label">Mes trains</span>
        <span class="s">${fav ? "Ce train est dans tes trains : tu re\xE7ois une alerte s\u2019il est en retard ou supprim\xE9." : "Ajoute ce train pour \xEAtre alert\xE9 en cas de retard ou de suppression (cl\xE9 SNCF n\xE9cessaire)."}</span>
        <button class="btn ${fav ? "ghost" : ""}" id="dt-fav">${fav ? "Retirer de mes trains" : "Ajouter \xE0 mes trains"}</button>
      </div>
      ${legHTML}
      <a class="btn ghost" style="text-align:center" href="https://www.sncf-connect.com/train/horaires/${d === "aller" ? "dijon/le-creusot" : "le-creusot/dijon"}">Ouvrir dans SNCF Connect</a>`, $("dt-fav").addEventListener("click", () => {
        toggleFav(d, t), detailRefresh && detailRefresh();
      });
    });
  }
  function shortSky(c) {
    return { 0: "D\xE9gag\xE9", 1: "D\xE9gag\xE9", 2: "Nuageux", 3: "Couvert", 45: "Brouillard", 48: "Brouillard" }[c] || (c >= 51 && c <= 57 ? "Bruine" : c >= 61 && c <= 67 ? "Pluie" : c >= 71 && c <= 77 ? "Neige" : c >= 80 && c <= 82 ? "Averses" : c >= 85 && c <= 86 ? "Neige" : c >= 95 ? "Orage" : "\u2014");
  }
  function tempChart(hours) {
    const temps = hours.map((h) => h.temp), lo = Math.floor(Math.min.apply(null, temps)) - 1, hi = Math.ceil(Math.max.apply(null, temps)) + 1, x = (i) => 8 + i * 324 / (hours.length - 1), y = (v) => 22 + (hi - v) * 102 / (hi - lo || 1), pts = hours.map((h, i) => x(i).toFixed(1) + "," + y(h.temp).toFixed(1)), area = "M" + x(0) + ",124 L" + pts.join(" L") + " L" + x(hours.length - 1) + ",124 Z", bw = 324 / hours.length * 0.6, rain = hours.map((h, i) => {
      const bh = (h.rain || 0) / 100 * 30;
      return bh > 0 ? `<rect class="rb" x="${(x(i) - bw / 2).toFixed(1)}" y="${(124 - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="2"/>` : "";
    }).join(""), imax = temps.indexOf(Math.max.apply(null, temps)), labels = [temps.indexOf(Math.min.apply(null, temps)), imax].map((i) => `<text class="lbl" x="${x(i).toFixed(1)}" y="${(y(hours[i].temp) - 8).toFixed(1)}" text-anchor="middle">${Math.round(hours[i].temp)}\xB0</text>`).join(""), ticks = hours.map((h, i) => i % 3 === 0 ? `<text x="${x(i).toFixed(1)}" y="142" text-anchor="middle">${h.t.slice(11, 13)}h</text>` : "").join(""), nowH = (/* @__PURE__ */ new Date()).getHours(), ni = hours.findIndex((h) => +h.t.slice(11, 13) === nowH && h.t.slice(0, 10) === todayISO()), nowLine = ni >= 0 ? `<line class="nowl" x1="${x(ni).toFixed(1)}" x2="${x(ni).toFixed(1)}" y1="16" y2="124"/>` : "";
    return `<svg class="chart" viewBox="0 0 340 150" role="img" aria-label="Temp\xE9rature heure par heure">${rain}<path class="ar" d="${area}" opacity="0.6"/><polyline class="ln" points="${pts.join(" ")}"/>${nowLine}${labels}${ticks}</svg>`;
  }
  let wxDay = "today";
  function renderWeatherPage() {
    const page = $("wxpage");
    if (!weather || !weather.hourly) {
      page.innerHTML = '<div class="page-title">M\xE9t\xE9o \xB7 Dijon</div><div class="bubble"><p class="hint">M\xE9t\xE9o en chargement\u2026</p></div>';
      return;
    }
    (() => {
      const today = wxDay === "today" ? todayISO() : tomorrowISO(), isToday = wxDay === "today", hours = weather.hourly.filter((h) => h.t.slice(0, 10) === today && +h.t.slice(11, 13) >= 6), nowH = isToday ? (/* @__PURE__ */ new Date()).getHours() : -1, d0 = weather.days.find((x) => x.t === today) || weather.days[0], hm2 = (iso) => iso ? iso.slice(11, 16) : "\u2014", uvTxt = (u) => u == null ? "\u2014" : Math.round(u) + (u < 3 ? " faible" : u < 6 ? " mod\xE9r\xE9" : u < 8 ? " \xE9lev\xE9" : " tr\xE8s \xE9lev\xE9"), dayName = (iso, i) => i === 0 ? "Aujourd\u2019hui" : i === 1 ? "Demain" : cap((/* @__PURE__ */ new Date(iso + "T12:00:00")).toLocaleDateString("fr-FR", { weekday: "long" })), morning = hours.find((h) => +h.t.slice(11, 13) == 8), tip = advice(isToday ? weather : { rain: d0.rain, tmin: d0.min, periods: [{ temp: morning ? Math.round(morning.temp) : d0.min }] });
      page.innerHTML = `
      <div class="page-title">M\xE9t\xE9o \xB7 Dijon</div>
      <div class="chips" id="wxdays"><button data-d="today" class="${isToday ? "on" : ""}">Aujourd\u2019hui</button><button data-d="tomorrow" class="${isToday ? "" : "on"}">Demain</button></div>
      <div class="bubble">
        ${isToday ? `<div class="wx"><span class="big num">${weather.now}\xB0</span>
          <div class="side"><strong>${esc(weather.nowSky)}</strong><span class="muted num">Ressenti ${weather.feels}\xB0 \xB7 ${weather.tmin}\xB0 / ${weather.tmax}\xB0</span></div></div>` : `<div class="wx"><span class="big num">${d0.max}\xB0</span>
          <div class="side"><strong>${esc(sky(d0.code))}</strong><span class="muted num">${cap(longDate(dateOf(today)))} \xB7 min ${d0.min}\xB0</span></div></div>`}
        ${tip ? `<p class="hint">${esc(tip)}</p>` : ""}
        <div class="kv">
          <div><span class="s">Pluie</span><b class="num">${d0.rain || 0} % \xB7 ${d0.mm || 0} mm</b></div>
          ${isToday ? `<div><span class="s">Vent</span><b class="num">${weather.windNow} km/h</b><span class="s num">rafales ${weather.gusts} km/h</span></div>
          <div><span class="s">Humidit\xE9</span><b class="num">${weather.humidity} %</b></div>` : `<div><span class="s">Vent max</span><b class="num">${d0.wind} km/h</b></div>`}
          <div><span class="s">UV max</span><b class="num">${uvTxt(d0.uv)}</b></div>
          <div><span class="s">Lever</span><b class="num">${hm2(d0.sunrise)}</b></div>
          <div><span class="s">Coucher</span><b class="num">${hm2(d0.sunset)}</b></div>
        </div>
      </div>
      <div class="bubble">
        <span class="label">Temp\xE9rature et pluie</span>
        ${hours.length > 2 ? tempChart(hours) : ""}
        <div class="hours">${hours.map((h) => {
        const H = +h.t.slice(11, 13);
        return `<div class="hour ${H === nowH ? "now" : ""}"><span>${H === nowH ? "Maint." : H + "h"}</span><b class="num">${Math.round(h.temp)}\xB0</b><span>${shortSky(h.code)}</span><span class="num">${h.rain || 0} %</span><span class="num">${Math.round(h.wind)} km/h</span></div>`;
      }).join("")}</div>
      </div>
      <div class="bubble">
        <span class="label">Prochains jours</span>
        <div class="days">${weather.days.map((dd, i) => `<div class="day"><span>${dayName(dd.t, i)}</span><span class="s">${esc(sky(dd.code))}${dd.rain ? " \xB7 pluie " + dd.rain + " %" : ""}</span><span class="rng num">${dd.min}\xB0 / ${dd.max}\xB0</span></div>`).join("")}</div>
      </div>
      <p class="hint" style="padding:0 6px">Pr\xE9visions Open-Meteo, mises \xE0 jour ${new Date(weather.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.</p>`, $("wxdays").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
        wxDay = b.dataset.d, renderWeatherPage();
      }));
    })();
  }
  const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)], toHex = (a) => "#" + a.map((v) => pad(Math.max(0, Math.min(255, Math.round(v))).toString(16))).join(""), mix = (a, b, t) => {
    const A = hex(a), B = hex(b);
    return toHex(A.map((v, i) => v + (B[i] - v) * t));
  };
  function greyed(c, f) {
    const A = hex(c), L = 0.3 * A[0] + 0.59 * A[1] + 0.11 * A[2];
    return toHex(A.map((v, i) => v + (L + (i === 2 ? 8 : 0) - v) * f));
  }
  const SKY = { night: ["#0a1028", "#1b2a4c"], dawn: ["#33407e", "#e79a6e"], morning: ["#4f8fd6", "#f2c79e"], day: ["#2f7fd0", "#8fc4ee"], golden: ["#4473b4", "#f0a86a"], dusk: ["#2a2c63", "#c96a7c"] };
  function skyNow() {
    const d0 = weather && weather.days && weather.days.find((x) => x.t === todayISO()), sr = d0 && d0.sunrise ? toMin(d0.sunrise.slice(11, 16)) : 7 * 60 + 50, ss = d0 && d0.sunset ? toMin(d0.sunset.slice(11, 16)) : 19 * 60, pts = [[0, "night"], [sr - 70, "night"], [sr - 20, "dawn"], [sr + 35, "morning"], [sr + 120, "day"], [ss - 110, "day"], [ss - 30, "golden"], [ss + 20, "dusk"], [ss + 70, "night"], [1440, "night"]], m = nowMin();
    let k = 0;
    for (; k < pts.length - 2 && m >= pts[k + 1][0]; ) k++;
    const p0 = pts[k], p1 = pts[k + 1], t = p1[0] > p0[0] ? Math.min(1, Math.max(0, (m - p0[0]) / (p1[0] - p0[0]))) : 0;
    let top = mix(SKY[p0[1]][0], SKY[p1[1]][0], t), bot = mix(SKY[p0[1]][1], SKY[p1[1]][1], t);
    const code = weather && weather.code != null ? weather.code : 1, rainy = code >= 51 && code <= 67 || code >= 80 && code <= 82 || code >= 95, cloudy = code === 3 || code === 45 || code === 48 || rainy;
    cloudy && (top = greyed(top, rainy ? 0.7 : 0.55), bot = greyed(bot, rainy ? 0.7 : 0.55));
    const isNight = m < sr - 30 || m > ss + 40;
    return { top, bot, isNight, rainy, cloudy, partly: code === 2, sunX: Math.min(90, Math.max(10, (m - sr) / Math.max(1, ss - sr) * 80 + 10)) };
  }
  let starsMade = !1;
  function renderSky() {
    const k = skyNow();
    if (typeof styleMode < "u" && styleMode === "sobre") {
      const dark = effectiveMode() === "dark";
      $("sky").style.background = dark ? "linear-gradient(180deg, #111417 0%, #181c20 100%)" : "linear-gradient(180deg, #f3f1ed 0%, #e6e3dd 100%)", ["sky-clouds", "sky-rain", "sky-sun", "sky-stars"].forEach((id) => $(id).classList.remove("on"));
      return;
    }
    if (effectiveMode() === "dark" && (k.top = mix(k.top, "#04060d", k.isNight ? 0.25 : 0.62), k.bot = mix(k.bot, "#04060d", k.isNight ? 0.3 : 0.66)), $("sky").style.background = `linear-gradient(180deg, ${k.top} 0%, ${k.bot} 100%)`, $("sky").classList.toggle("overcast", k.cloudy), $("sky-clouds").classList.toggle("on", k.cloudy || k.partly), $("sky-rain").classList.toggle("on", k.rainy), $("sky-sun").classList.toggle("on", !k.isNight && !k.cloudy), $("sky-sun").style.setProperty("--sx", k.sunX + "%"), $("sky-stars").classList.toggle("on", k.isNight && !k.cloudy), k.isNight && !starsMade) {
      starsMade = !0;
      let html = "";
      for (let i = 0; i < 70; i++) html += `<span class="star" style="left:${(Math.random() * 100).toFixed(1)}%;top:${(Math.random() * 70).toFixed(1)}%;animation-delay:${(Math.random() * 4).toFixed(1)}s"></span>`;
      $("sky-stars").innerHTML = html;
    }
  }
  function rainSoon() {
    if (!weather || !weather.hourly) return null;
    const H = (/* @__PURE__ */ new Date()).getHours(), hit = weather.hourly.find((h) => h.t.slice(0, 10) === todayISO() && +h.t.slice(11, 13) > H && +h.t.slice(11, 13) <= H + 3 && (h.rain || 0) >= 50);
    return hit ? +hit.t.slice(11, 13) : null;
  }
  function priority() {
    const today = todayISO(), now = nowMin(), H = (/* @__PURE__ */ new Date()).getHours(), trainDayToday = isTrainDay(today), upcoming = trainDayToday ? trainsFor("aller", today).filter((t) => t.dep >= now - 0.5) : [], problem = upcoming.filter((t) => t.dep - now <= 180).slice(0, 2).find((t) => cancelled(t) || t.delay >= 5), rain = rainSoon();
    let alert = null, page = "home", order = ["wx", "next", "tomorrow", "peek"];
    return problem ? (alert = { cls: cancelled(problem) ? "bad" : "warn", text: cancelled(problem) ? `Le direct de ${hm(problem.sched)} est supprim\xE9` : `Le direct de ${hm(problem.sched)} a ${problem.delay} min de retard`, go: "trains" }, page = "trains", order = ["next", "wx", "tomorrow", "peek"]) : H >= 18 || trainDayToday && !upcoming.length ? order = ["tomorrow", "wx", "next", "peek"] : trainDayToday && upcoming.length && upcoming[0].dep - now <= 120 && (order = ["next", "wx", "tomorrow", "peek"]), !alert && rain != null && (alert = { cls: "info", text: `Pluie probable vers ${rain}h, prends un parapluie`, go: "meteo" }, order[0] !== "next" && (order = ["wx"].concat(order.filter((x) => x !== "wx")))), { alert, page, order };
  }
  function applyPriority() {
    const p = priority(), top = { wx: "weather", next: "next", tomorrow: "tomorrow", peek: "list" }[p.order[0]];
    return layout.forEach((b, i) => {
      const el = bEl(b);
      el && (el.style.order = String(autoOrder && !homeEdit && b.type === top ? 0 : i + 1));
    }), $("alertbar").style.order = "0", p.alert ? ($("alertbar").innerHTML = `<div class="alertbar ${p.alert.cls}"><span>${esc(p.alert.text)}</span><span class="more">Voir</span></div>`, $("alertbar").firstChild.addEventListener("click", () => show(p.alert.go))) : $("alertbar").innerHTML = "", p;
  }
  let lastTouch = Date.now();
  ["touchstart", "mousedown", "keydown", "wheel"].forEach((ev) => document.addEventListener(ev, () => {
    lastTouch = Date.now();
  }, { passive: !0, capture: !0 }));
  setInterval(() => {
    if (Date.now() - lastTouch < 90 * 1e3 || !$("settings").hidden || !$("detail").hidden || !$("door").hidden) return;
    const p = applyPriority();
    view !== p.page && show(p.page);
  }, 15e3);
  function tickHeaderClock() {
    const d = /* @__PURE__ */ new Date();
    document.querySelectorAll("[data-clock]").forEach((el) => {
      el.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes());
    });
  }
  setInterval(() => {
    tickHeaderClock(), renderSky(), applyAppearance();
  }, 2e4);
  const WD = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  function openPlanning() {
    openDetail("Mon Matin", "Planning", () => {
      const today = todayISO(), start = dateOf(today);
      start.setDate(start.getDate() - (start.getDay() + 6) % 7);
      const cells = [];
      for (let k = 0; k < 42; k++) {
        const d = new Date(start);
        d.setDate(start.getDate() + k), cells.push(isoOf(d));
      }
      const nOver = Object.keys(planning.overrides).filter((k) => k >= today).length;
      $("dt-body").innerHTML = `
      <div class="bubble">
        <span class="label">Jours habituels au Creusot</span>
        <p class="hint">Les trains, la bulle Demain et les alertes retard ne s\u2019activent que ces jours-l\xE0.</p>
        <div class="wdays">${[1, 2, 3, 4, 5, 6, 0].map((i) => `<button data-wd="${i}" class="${planning.pattern[i] ? "on" : ""}">${WD[i]}</button>`).join("")}</div>
      </div>
      <div class="bubble">
        <div class="bhead"><span class="label">Calendrier</span>${nOver ? `<button class="link" id="pl-reset">Effacer les exceptions (${nOver})</button>` : ""}</div>
        <p class="hint">Touche un jour pour l\u2019inverser (semaine en entreprise, vacances, examen\u2026).</p>
        <div class="cal">
          ${["L", "M", "M", "J", "V", "S", "D"].map((x) => `<span class="cal-h">${x}</span>`).join("")}
          ${cells.map((iso) => {
        const past = iso < today, on = isTrainDay(iso), ex = Object.prototype.hasOwnProperty.call(planning.overrides, iso), d = dateOf(iso);
        return `<button data-iso="${iso}" class="${on ? "on" : ""} ${ex ? "ex" : ""} ${iso === today ? "today" : ""}" ${past ? "disabled" : ""}>${d.getDate() === 1 || iso === cells[0] ? `<small>${d.toLocaleDateString("fr-FR", { month: "short" })}</small>` : ""}${d.getDate()}</button>`;
      }).join("")}
        </div>
        <div class="legend"><span><i class="lg on"></i>Au Creusot</span><span><i class="lg"></i>\xC0 Dijon</span><span><i class="lg ex"></i>Exception</span></div>
      </div>`, $("dt-body").querySelectorAll("[data-wd]").forEach((b) => b.addEventListener("click", () => {
        const i = +b.dataset.wd;
        planning.pattern[i] = !planning.pattern[i], savePlanning(), detailRefresh(), renderAll();
      })), $("dt-body").querySelectorAll("[data-iso]").forEach((b) => b.addEventListener("click", () => {
        const iso = b.dataset.iso, base = !!planning.pattern[dateOf(iso).getDay()];
        Object.prototype.hasOwnProperty.call(planning.overrides, iso) ? delete planning.overrides[iso] : planning.overrides[iso] = !base, savePlanning(), detailRefresh(), renderAll();
      })), $("pl-reset") && $("pl-reset").addEventListener("click", () => {
        planning.overrides = {}, savePlanning(), detailRefresh(), renderAll();
      });
    });
  }
  $("openplanning").addEventListener("click", openPlanning);
  const uid = () => Math.random().toString(36).slice(2, 10), persist = () => ls.set("lists", lists), fmtWhen = (ts) => {
    const d = new Date(ts), today = /* @__PURE__ */ new Date(), sameDay = d.toDateString() === today.toDateString(), tmr = new Date(today.getTime() + 864e5).toDateString() === d.toDateString(), h = pad(d.getHours()) + ":" + pad(d.getMinutes());
    return (sameDay ? "Aujourd\u2019hui " : tmr ? "Demain " : d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) + " ") + h;
  };
  function setReminder(item, ts) {
    item.remind = ts || 0, N && N.setTaskReminder && N.setTaskReminder(item.id, String(item.remind), item.text);
  }
  function itemHTML(i, peek) {
    const bell = i.remind ? `<span class="bell ${i.remind < Date.now() ? "past" : ""}">Rappel ${fmtWhen(i.remind)}</span>` : "";
    return `<div class="item ${i.done ? "done" : ""}">
    <input type="checkbox" data-id="${esc(i.id)}" ${i.done ? "checked" : ""} aria-label="Cocher">
    <button class="txt" data-edit="${esc(i.id)}"><span>${esc(i.text)}</span>${bell}</button>
    ${peek ? "<span></span>" : `<button class="star" data-del="${esc(i.id)}" aria-label="Supprimer"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`}
  </div>`;
  }
  function bindItems(root, l) {
    root.querySelectorAll("input[data-id]").forEach((c) => c.addEventListener("change", () => {
      const it = l.items.find((x) => x.id === c.dataset.id);
      it.done = c.checked, it.done && it.remind > Date.now() && setReminder(it, 0), persist(), renderAll();
    })), root.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => {
      current = l.id, ls.set("list", current), editing = b.dataset.edit, show("lists"), renderLists();
    })), root.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
      const it = l.items.find((x) => x.id === b.dataset.del);
      it && it.remind && setReminder(it, 0), l.items = l.items.filter((x) => x.id !== b.dataset.del), persist(), renderAll();
    }));
  }
  function renderPeek() {
    renderHome();
  }
  const toLocalInput = (ts) => {
    const d = new Date(ts);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  };
  function renderLists() {
    lists.find((l2) => l2.id === current) || (current = lists[0] && lists[0].id), $("chips").innerHTML = lists.map((l2) => {
      const n = l2.items.filter((i) => !i.done).length;
      return `<button data-id="${esc(l2.id)}" class="${l2.id === current ? "on" : ""}">${esc(l2.name)}${n ? " \xB7 " + n : ""}</button>`;
    }).join("") + '<button class="add" id="addlist">+ Nouvelle</button>', $("chips").querySelectorAll("button[data-id]").forEach((b) => b.addEventListener("click", () => {
      current = b.dataset.id, editing = null, confirmDel = !1, ls.set("list", current), renderLists();
    })), $("addlist").addEventListener("click", newListForm);
    const l = lists.find((x) => x.id === current), body = $("lbody");
    if (!l) {
      body.innerHTML = '<div class="bubble"><p class="hint">Aucune liste. Cr\xE9e-en une avec \xAB + Nouvelle \xBB.</p></div>';
      return;
    }
    const it = editing && l.items.find((x) => x.id === editing);
    if (it) {
      body.innerHTML = `<div class="bubble edit">
      <span class="label">Modifier</span>
      <input type="text" id="ed-text" value="${esc(it.text)}">
      <div class="field"><span class="label">Rappel</span><input type="datetime-local" id="ed-when" value="${it.remind ? toLocalInput(it.remind) : ""}"></div>
      <div class="row-btns">
        <button class="btn ghost" data-quick="60">Dans 1 h</button>
        <button class="btn ghost" data-quick="tonight">Ce soir 18:00</button>
        <button class="btn ghost" data-quick="tomorrow">Demain 7:30</button>
      </div>
      <div class="row-btns"><button class="btn" id="ed-save">Enregistrer</button>${it.remind ? '<button class="btn ghost" id="ed-clear">Sans rappel</button>' : ""}<button class="btn ghost" id="ed-cancel">Annuler</button></div>
      ${N ? "" : '<p class="hint">Les notifications de rappel ne marchent que dans l\u2019app Android.</p>'}
    </div>`, body.querySelectorAll("[data-quick]").forEach((b) => b.addEventListener("click", () => {
        const d = /* @__PURE__ */ new Date();
        b.dataset.quick === "60" ? d.setTime(d.getTime() + 36e5) : b.dataset.quick === "tonight" ? (d.setHours(18, 0, 0, 0), d < /* @__PURE__ */ new Date() && d.setDate(d.getDate() + 1)) : (d.setDate(d.getDate() + 1), d.setHours(7, 30, 0, 0)), $("ed-when").value = toLocalInput(d.getTime());
      })), $("ed-save").addEventListener("click", () => {
        const txt = $("ed-text").value.trim();
        txt && (it.text = txt);
        const v = $("ed-when").value, ts = v ? new Date(v).getTime() : 0;
        if (ts && ts < Date.now()) {
          $("ed-when").focus(), showError("Le rappel est dans le pass\xE9, choisis une heure \xE0 venir.");
          return;
        }
        $("errbar").hidden = !0, setReminder(it, ts), ts && N && N.requestNotif && N.requestNotif(), editing = null, persist(), renderAll();
      }), $("ed-clear") && $("ed-clear").addEventListener("click", () => {
        setReminder(it, 0), editing = null, persist(), renderAll();
      }), $("ed-cancel").addEventListener("click", () => {
        editing = null, renderLists();
      });
      return;
    }
    const done = l.items.filter((i) => i.done).length;
    body.innerHTML = `<form class="add bubble" id="additem" style="flex-direction:row;padding:8px"><input type="text" id="newitem" placeholder="Ajouter \xE0 ${esc(l.name)}\u2026" autocomplete="off" enterkeyhint="done"><button class="btn" type="submit">Ajouter</button></form>
    ${l.items.length ? l.items.map((i) => itemHTML(i, !1)).join("") : '<div class="bubble"><p class="hint">Liste vide. Touche un \xE9l\xE9ment pour le modifier ou lui ajouter un rappel.</p></div>'}
    <div class="tools">${done ? `<button class="link" id="cleardone">Retirer les coch\xE9s (${done})</button>` : "<span></span>"}
      ${confirmDel ? '<span>Supprimer la liste ? <button class="link danger" id="delyes">Oui</button> \xB7 <button class="link" id="delno">Non</button></span>' : '<button class="link danger" id="dellist">Supprimer la liste</button>'}</div>`, $("additem").addEventListener("submit", (e) => {
      e.preventDefault();
      const v = $("newitem").value.trim();
      v && (l.items.push({ id: uid(), text: v, done: !1, remind: 0 }), persist(), renderAll(), $("newitem").focus());
    }), bindItems(body, l), $("cleardone") && $("cleardone").addEventListener("click", () => {
      l.items = l.items.filter((i) => !i.done), persist(), renderAll();
    }), $("dellist") && $("dellist").addEventListener("click", () => {
      confirmDel = !0, renderLists();
    }), $("delno") && $("delno").addEventListener("click", () => {
      confirmDel = !1, renderLists();
    }), $("delyes") && $("delyes").addEventListener("click", () => {
      confirmDel = !1, l.items.forEach((i) => {
        i.remind && setReminder(i, 0);
      }), lists = lists.filter((x) => x.id !== l.id), persist(), renderAll();
    });
  }
  function newListForm() {
    $("lbody").innerHTML = '<form class="add bubble" id="newlist" style="flex-direction:row;padding:8px"><input type="text" id="listname" placeholder="Nom de la liste" autocomplete="off"><button class="btn" type="submit">Cr\xE9er</button></form><button class="link" id="cancelnew" style="align-self:flex-start;padding:0 6px">Annuler</button>', $("listname").focus(), $("cancelnew").addEventListener("click", renderLists), $("newlist").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("listname").value.trim();
      if (!name) return;
      const id = uid();
      lists.push({ id, name, items: [] }), current = id, ls.set("list", id), persist(), renderAll();
    });
  }
  function syncNative() {
    !N || !N.setTrainConfig || N.setTrainConfig(JSON.stringify({ token: alertOn ? token : "", stations: stations ? { dijon: stations.dijon.id, creusot: stations.creusot.id } : null, favs, days: plannedDates(60) }));
  }
  function syncWidget() {
    if (!N || !N.setWidgetData) return;
    const pack = (d, iso) => trainsFor(d, iso).map((t) => [t.sched, t.arr, t.delay || 0, cancelled(t) ? 1 : 0]), days = {};
    [todayISO(), tomorrowISO()].forEach((iso) => {
      days[iso] = { plan: isTrainDay(iso), aller: pack("aller", iso), retour: pack("retour", iso) };
    }), N.setWidgetData(JSON.stringify({
      at: Date.now(),
      weather: weather ? { now: weather.now, sky: weather.nowSky, tmin: weather.tmin, tmax: weather.tmax, rain: weather.rain || 0, date: weather.date } : null,
      days
    }));
  }
  function renderDiag() {
    const ua = navigator.userAgent.match(/Chrome\/[\d.]+/);
    $("diag").textContent = [
      "Version app : 4.5" + (N ? "" : " (web)"),
      "WebView : " + (ua ? ua[0] : navigator.userAgent),
      "Pont Android : " + (N ? "oui" : "non"),
      "IA : " + (aiKey ? aiModel + (aiErr ? " \u2014 " + aiErr : "") : "sans cl\xE9"),
      "Actus : " + (news ? news.items.length + " articles" : "aucune") + (newsErr ? " \u2014 " + newsErr : ""),
      "M\xE9t\xE9o : " + (weather ? "re\xE7ue " + new Date(weather.at).toLocaleString("fr-FR") : "aucune"),
      "Trains : " + (isLive() ? "temps r\xE9el" : "indicatifs") + " \xB7 planning " + plannedDates(14).length + " jours au Creusot sur 14" + (trainErr ? " \u2014 " + trainErr : "")
    ].concat(window.__errors.map((e) => "JS " + e)).concat(log).join(`
`);
  }
  function openSettings() {
    renderSetup(), renderAiSettings(), renderNewsSettings(), readWall(), renderWallSettings(), renderStyleSeg(), $("token").value = token, $("alert-on").checked = alertOn;
    try {
      const r = JSON.parse(N ? N.getReminder() : '{"on":true,"h":6,"m":45}');
      $("rem-on").checked = r.on, $("rem-time").value = pad(r.h) + ":" + pad(r.m);
    } catch (e) {
    }
    $("token-status").textContent = token ? isLive() ? "Cl\xE9 valide, temps r\xE9el actif." : trainErr || "Cl\xE9 enregistr\xE9e." : "Aucune cl\xE9 : horaires indicatifs.", renderDiag(), $("settings").hidden = !1;
  }
  function saveReminder() {
    const p = ($("rem-time").value || "06:45").split(":");
    N && N.setReminder($("rem-on").checked, +p[0], +p[1]);
  }
  $("opensettings").addEventListener("click", openSettings);
  $("closesettings").addEventListener("click", () => {
    $("settings").hidden = !0, renderAll();
  });
  $("rem-on").addEventListener("change", saveReminder);
  $("rem-time").addEventListener("change", saveReminder);
  $("alert-on").addEventListener("change", () => {
    alertOn = $("alert-on").checked, ls.set("alertOn", alertOn), syncNative(), alertOn && N && N.requestNotif && N.requestNotif();
  });
  $("savetoken").addEventListener("click", async () => {
    if (token = $("token").value.replace(/[^A-Za-z0-9-]/g, ""), $("token").value = token, ls.set("token", token), live = null, ls.set("live2", null), !token) {
      $("token-status").textContent = "Cl\xE9 retir\xE9e : horaires indicatifs.", syncNative(), renderAll();
      return;
    }
    $("token-status").textContent = "Test de la cl\xE9\u2026";
    try {
      await sncf("/places?type%5B%5D=stop_area&count=1&q=Dijon");
    } catch (e) {
      $("token-status").textContent = "Cl\xE9 non valide : " + e.message, note("test cl\xE9 : " + e.message), renderDiag();
      return;
    }
    $("token-status").textContent = "Cl\xE9 valide, chargement des horaires\u2026", await loadTrains(), renderAll(), renderDiag(), $("token-status").textContent = isLive() ? "Cl\xE9 valide, temps r\xE9el actif." : trainErr ? "Cl\xE9 valide, mais horaires non charg\xE9s : " + trainErr : "Cl\xE9 valide, aucun direct trouv\xE9 aujourd\u2019hui (horaires indicatifs affich\xE9s).";
  });
  let wall = { on: !1, start: 390, end: 1350, days: "1111111", overlay: !0, exact: !0 };
  function readWall() {
    try {
      N && N.getWallInfo ? wall = JSON.parse(N.getWallInfo()) : wall = Object.assign({ on: !1, start: 390, end: 1350, days: "1111111" }, ls.get("webWall", {}));
    } catch (e) {
    }
  }
  function sendWall() {
    N && N.setWallConfig ? N.setWallConfig(JSON.stringify({ on: wall.on, start: wall.start, end: wall.end, days: wall.days })) : (ls.set("webWall", { on: wall.on, start: wall.start, end: wall.end, days: wall.days }), webWallTick(!0)), readWall(), renderWallSettings();
  }
  let wakeLock = null, webPeekUntil = 0, webWallState = null;
  function webActive() {
    const d = /* @__PURE__ */ new Date(), m = d.getHours() * 60 + d.getMinutes(), dayOn = (dd) => wall.days.charAt(dd.getDay()) === "1";
    if (wall.start === wall.end) return dayOn(d);
    if (wall.start < wall.end) return dayOn(d) && m >= wall.start && m < wall.end;
    if (m >= wall.start) return dayOn(d);
    const y = new Date(d.getTime() - 864e5);
    return m < wall.end && dayOn(y);
  }
  async function setWake(on) {
    try {
      on && !wakeLock && navigator.wakeLock && !document.hidden ? (wakeLock = await navigator.wakeLock.request("screen"), wakeLock.addEventListener("release", () => {
        wakeLock = null;
      })) : !on && wakeLock && (await wakeLock.release(), wakeLock = null);
    } catch (e) {
      note("\xE9cran allum\xE9 : " + (e.message || e));
    }
  }
  function webWallTick(force) {
    if (N) return;
    readWall();
    const active = wall.on && (webActive() || Date.now() < webPeekUntil);
    setWake(wall.on && active);
    const key = wall.on + ":" + active;
    (force || key !== webWallState) && (webWallState = key, window.onWallState(wall.on, active));
  }
  document.addEventListener("visibilitychange", () => {
    document.hidden || (wakeLock = null, webWallTick(!0));
  });
  function renderWallSettings() {
    $("wall-on").checked = !!wall.on, $("wall-start").value = hm(wall.start), $("wall-end").value = hm(wall.end), $("wall-days").innerHTML = [1, 2, 3, 4, 5, 6, 0].map((i) => `<button data-i="${i}" class="${wall.days.charAt(i) === "1" ? "on" : ""}">${WD[i]}</button>`).join(""), $("wall-days").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      const i = +b.dataset.i, arr = wall.days.split("");
      arr[i] = arr[i] === "1" ? "0" : "1", wall.days = arr.join(""), sendWall();
    }));
    const perms = [];
    N ? wall.on && (perms.push(wall.overlay ? '<div class="perm ok">Rallumage automatique autoris\xE9</div>' : '<div class="perm"><span>Autorise \xAB Afficher par-dessus les autres applis \xBB pour que l\u2019app se rouvre seule.</span><button class="btn" id="perm-ov">Autoriser</button></div>'), wall.exact || perms.push('<div class="perm"><span>Autorise les \xAB alarmes et rappels \xBB pour un allumage \xE0 l\u2019heure pile.</span><button class="btn" id="perm-al">Autoriser</button></div>'), perms.push('<div class="perm"><span>R\xE8gle la mise en veille de l\u2019\xE9cran sur 30 s ou 1 min : c\u2019est elle qui \xE9teint l\u2019\xE9cran le soir.</span><button class="btn ghost" id="perm-disp">R\xE9glages</button></div>')) : (perms.push(navigator.wakeLock ? '<div class="perm ok">\xC9cran gard\xE9 allum\xE9 pendant la plage choisie</div>' : '<div class="perm">Ce navigateur ne sait pas garder l\u2019\xE9cran allum\xE9 : r\xE8gle Verrouillage auto sur \xAB Jamais \xBB dans les r\xE9glages de l\u2019iPad.</div>'), perms.push('<div class="perm"><span>Sur iPad : ajoute la page \xE0 l\u2019\xE9cran d\u2019accueil, puis active Acc\xE8s guid\xE9 (R\xE9glages \u2192 Accessibilit\xE9) pour rester dans l\u2019app. Le soir, l\u2019\xE9cran passe au noir et l\u2019iPad se verrouille ; touche-le le matin pour le rallumer.</span></div>')), $("wall-perms").innerHTML = perms.join(""), $("perm-ov") && $("perm-ov").addEventListener("click", () => N.openOverlaySettings()), $("perm-al") && $("perm-al").addEventListener("click", () => N.openAlarmSettings()), $("perm-disp") && $("perm-disp").addEventListener("click", () => N.openDisplaySettings());
  }
  $("wall-on").addEventListener("change", () => {
    wall.on = $("wall-on").checked, sendWall();
  });
  $("wall-start").addEventListener("change", () => {
    const m = toMin($("wall-start").value);
    m != null && (wall.start = m, sendWall());
  });
  $("wall-end").addEventListener("change", () => {
    const m = toMin($("wall-end").value);
    m != null && (wall.end = m, sendWall());
  });
  $("night").addEventListener("click", () => {
    N && N.peek ? N.peek() : (webPeekUntil = Date.now() + 5 * 60 * 1e3, webWallTick(!0)), $("night").hidden = !0;
  });
  N || (setTimeout(() => webWallTick(!0), 0), setInterval(() => webWallTick(!1), 3e4));
  window.onWallState = (isWall, on) => {
    document.body.classList.toggle("wall", !!isWall), $("clock").hidden = !isWall, $("night").hidden = !isWall || on, isWall && on && ($("settings").hidden = !0, closeDetail(), show("home"), refresh()), tickClock();
  };
  function tickClock() {
    if ($("clock").hidden) return;
    const d = /* @__PURE__ */ new Date();
    $("clock").textContent = pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  setInterval(tickClock, 1e4);
  setInterval(() => {
    !document.hidden && $("night").hidden && refresh();
  }, 5 * 60 * 1e3);
  let screenStyle = ls.get("screenStyle", "bubbles"), doorAway = 0;
  const DOOR_LIST = "partir";
  function doorList() {
    let l = lists.find((x) => x.id === DOOR_LIST);
    return l || (l = { id: DOOR_LIST, name: "Avant de partir", daily: !0, items: ["Cl\xE9s", "Portefeuille", "T\xE9l\xE9phone", "Abonnement TER"].map((t) => ({ id: uid(), text: t, done: !1, remind: 0 })) }, lists.push(l), persist()), l.daily && l.resetOn !== todayISO() && (l.items.forEach((i) => {
      i.done = !1;
    }), l.resetOn = todayISO(), persist()), l;
  }
  function whatToTake() {
    if (!weather) return [];
    const d0 = weather.days && weather.days.find((x) => x.t === todayISO()) || {}, morning = weather.periods && weather.periods[0] && weather.periods[0].temp != null ? weather.periods[0].temp : weather.tmin, tags = [];
    return (weather.rain || 0) >= 40 && tags.push("Parapluie"), morning <= 3 && tags.push("Bonnet et gants"), morning <= 10 ? tags.push("Veste chaude") : morning <= 15 && tags.push("Petite veste"), d0.uv >= 6 && tags.push("Lunettes de soleil"), (weather.gusts || 0) >= 50 && tags.push("Coupe-vent"), tags;
  }
  function doorVisible() {
    return screenStyle === "door" && Date.now() > doorAway;
  }
  function renderDoor() {
    const on = doorVisible();
    if ($("door").hidden = !on, !on) return;
    const now = /* @__PURE__ */ new Date();
    if ($("d-clock").textContent = pad(now.getHours()) + ":" + pad(now.getMinutes()), $("d-date").textContent = longDate(now), weather) {
      $("d-wx").innerHTML = `<span class="t num">${weather.now}\xB0</span><span class="d"><b>${esc(weather.nowSky)}</b><span class="num">${weather.tmin}\xB0 / ${weather.tmax}\xB0 \xB7 pluie ${weather.rain || 0} %</span></span>`;
      const tags = whatToTake();
      $("d-take").innerHTML = tags.length ? tags.map((t) => `<span>${esc(t)}</span>`).join("") : '<span class="none">Rien de sp\xE9cial \xE0 prendre</span>';
    } else
      $("d-wx").innerHTML = '<span class="d">M\xE9t\xE9o en chargement\u2026</span>', $("d-take").innerHTML = "";
    const today = todayISO();
    let html;
    if (isTrainDay(today)) {
      const nm = nowMin(), list = trainsFor("aller", today).filter((t) => t.dep >= nm - 0.5).slice(0, 3);
      html = `<h3>Vers Le Creusot<span>${isLive(today) ? "temps r\xE9el" : "horaires indicatifs"}</span></h3>` + (list.length ? list.map((t, i) => {
        const st = cancelled(t) ? '<span class="st bad">Supprim\xE9</span>' : t.delay > 0 ? `<span class="st late">+${t.delay} min</span>` : isLive(today) ? '<span class="st ok">\xC0 l\u2019heure</span>' : '<span class="st na">pr\xE9vu</span>';
        return `<div class="d-train ${i === 0 ? "first" : ""}"><span class="h num">${hm(t.sched)}</span><span class="a num">arriv\xE9e ${hm(t.arr)}</span>${st}</div>`;
      }).join("") : `<span class="d-off">Plus de direct aujourd\u2019hui</span>${tomorrowLine()}`);
    } else
      html = `<h3>Trains<span>planning</span></h3><span class="d-off">Journ\xE9e \xE0 Dijon</span>${tomorrowLine()}`;
    $("d-trains").innerHTML = html;
    const l = doorList(), left = l.items.filter((i) => !i.done).length;
    $("d-check").innerHTML = `<h3>${esc(l.name)}<span>${l.items.length && left ? left + " \xE0 faire" : ""}</span></h3>
    ${l.items.length ? `<div class="d-checks">${l.items.map((i) => `<button class="d-check ${i.done ? "on" : ""}" data-id="${esc(i.id)}"><i></i><span>${esc(i.text)}</span></button>`).join("")}</div>` : '<span class="d-sub">Ajoute des \xE9l\xE9ments dans l\u2019onglet Listes.</span>'}
    ${l.items.length && !left ? '<span class="d-done">Tout est pr\xEAt, bonne journ\xE9e !</span>' : ""}`, $("d-check").querySelectorAll(".d-check").forEach((b) => b.addEventListener("click", () => {
      const it = l.items.find((x) => x.id === b.dataset.id);
      it && (it.done = !it.done, persist(), renderDoor(), renderLists());
    })), $("d-status").textContent = weather && weather.at ? "Mis \xE0 jour " + new Date(weather.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) + (trainErr ? " \xB7 trains : " + trainErr : "") : "";
  }
  function tomorrowLine() {
    const iso = tomorrowISO();
    if (!isTrainDay(iso)) return '<span class="d-sub">Demain : journ\xE9e \xE0 Dijon</span>';
    const f = trainsFor("aller", iso).find((t) => !cancelled(t));
    return f ? `<span class="d-sub num">Demain : premier direct \xE0 ${hm(f.sched)}</span>` : "";
  }
  document.querySelectorAll(".door-bar [data-go]").forEach((b) => b.addEventListener("click", () => {
    doorAway = Date.now() + 2 * 60 * 1e3, $("door").hidden = !0, b.dataset.go === "settings" ? openSettings() : show(b.dataset.go);
  }));
  ["click", "touchstart", "keydown"].forEach((ev) => document.addEventListener(ev, () => {
    screenStyle === "door" && $("door").hidden && (doorAway = Date.now() + 2 * 60 * 1e3);
  }, !0));
  function renderStyleSeg() {
    document.querySelectorAll("#style-seg button").forEach((b) => b.classList.toggle("on", b.dataset.style === screenStyle));
  }
  document.querySelectorAll("#style-seg button").forEach((b) => b.addEventListener("click", () => {
    screenStyle = b.dataset.style, ls.set("screenStyle", screenStyle), renderStyleSeg(), screenStyle === "door" && doorList();
  }));
  setInterval(() => {
    doorVisible() && !$("door").hidden ? renderDoor() : doorVisible() && ($("settings").hidden = !0, closeDetail(), renderDoor());
  }, 1e4);
  function httpPost(url, body, headers) {
    return N && N.post ? new Promise((resolve) => {
      const id = Math.random().toString(36).slice(2);
      pending[id] = resolve, setTimeout(() => {
        pending[id] && (delete pending[id], resolve({ status: 0, body: "d\xE9lai d\xE9pass\xE9" }));
      }, 45e3), N.post(id, url, body, JSON.stringify(headers || {}));
    }) : fetch(url, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, headers || {}), body }).then((r) => r.text().then((t) => ({ status: r.status, body: t }))).catch((e) => ({ status: 0, body: String(e && e.message || e) }));
  }
  const DEFAULT_THEMES = [
    { name: "Robotique", q: "robotique OR cobotique OR robot industriel" },
    { name: "IA et tech", q: "intelligence artificielle" },
    { name: "Trains", q: "SNCF TER Bourgogne" },
    { name: "Dijon", q: "Dijon" },
    { name: "Industrie", q: "industrie usine France" }
  ];
  let newsThemes = ls.get("newsThemes", null) || DEFAULT_THEMES.map((t) => Object.assign({}, t)), newsUne = ls.get("newsUne", !0), newsWeights = ls.get("newsWeights", {}), newsHidden = ls.get("newsHidden", []), news = ls.get("news", null), newsErr = "", newsFilter = "all";
  const weightOf = (t) => newsWeights[t] != null ? newsWeights[t] : 1, gnews = (q) => "https://news.google.com/rss/search?q=" + encodeURIComponent(q + " when:2d") + "&hl=fr&gl=FR&ceid=FR:fr";
  function parseRss(xml, theme) {
    let doc;
    try {
      doc = new DOMParser().parseFromString(xml, "text/xml");
    } catch (e) {
      return [];
    }
    return Array.prototype.slice.call(doc.querySelectorAll("item")).slice(0, 12).map((it) => {
      const get = (sel) => {
        const n = it.querySelector(sel);
        return n ? n.textContent.trim() : "";
      };
      let title = get("title"), source = get("source");
      if (source && title.endsWith(" - " + source) && (title = title.slice(0, -(source.length + 3))), !source) {
        const m = title.match(/ - ([^-]{2,40})$/);
        m && (source = m[1], title = title.slice(0, -m[0].length));
      }
      const date = Date.parse(get("pubDate")) || Date.now();
      return { title, link: get("link"), source: source || (theme === "\xC0 la une" ? "franceinfo" : ""), date, theme };
    }).filter((x) => x.title);
  }
  async function getRss(url) {
    if (N) return httpGet(url, "", !0);
    const relays = [(u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u), (u) => "https://corsproxy.io/?url=" + encodeURIComponent(u)];
    let last = { status: 0, body: "" };
    for (const r of relays)
      if (last = await viaFetch(r(url), ""), last.status === 200 && /<rss|<feed|<item/i.test(last.body)) return last;
    return last;
  }
  async function loadNews(force) {
    if (!force && news && Date.now() - news.at < 30 * 60 * 1e3) return;
    newsErr = "";
    const jobs = [];
    newsUne && jobs.push(getRss("https://www.francetvinfo.fr/titres.rss").then((r) => r.status === 200 ? parseRss(r.body, "\xC0 la une") : [])), newsThemes.forEach((t) => jobs.push(getRss(gnews(t.q)).then((r) => r.status === 200 ? parseRss(r.body, t.name) : [])));
    const res = await Promise.all(jobs.map((p) => p.catch(() => []))), seen = {}, items = [];
    if (res.forEach((list) => list.forEach((it) => {
      const k = it.title.toLowerCase().replace(/[^a-z0-9àâçéèêëîïôûùüÿœ]+/g, " ").slice(0, 70);
      seen[k] || (seen[k] = 1, items.push(it));
    })), !items.length) {
      newsErr = "actualit\xE9s indisponibles", note("actus : aucune r\xE9ponse");
      return;
    }
    news = { at: Date.now(), items }, ls.set("news", news), note("actus OK : " + items.length);
  }
  function rankedNews(theme) {
    if (!news) return [];
    const now = Date.now();
    return news.items.filter((it) => newsHidden.indexOf(it.title) < 0 && (!theme || theme === "all" || it.theme === theme)).map((it) => ({ it, score: weightOf(it.theme) * (it.theme === "\xC0 la une" ? 1.15 : 1) / (1 + (now - it.date) / 36e5 / 6) })).sort((a, b) => b.score - a.score).map((x) => x.it);
  }
  const ago = (d) => {
    const m = Math.round((Date.now() - d) / 6e4);
    return m < 60 ? m + " min" : m < 1440 ? Math.round(m / 60) + " h" : Math.round(m / 1440) + " j";
  };
  function newsRow(it, withVotes) {
    return `<div class="nrow">
    <a class="ntitle" href="${esc(it.link)}">${esc(it.title)}</a>
    <div class="nmeta"><span>${esc(it.theme)}${it.source ? " \xB7 " + esc(it.source) : ""} \xB7 ${ago(it.date)}</span>
    ${withVotes ? `<span class="votes"><button data-up="${esc(it.title)}" aria-label="Plus de ce th\xE8me">\u{1F44D}</button><button data-down="${esc(it.title)}" aria-label="Moins de ce th\xE8me">\u{1F44E}</button></span>` : ""}</div>
  </div>`;
  }
  function vote(title, up) {
    const it = news && news.items.find((x) => x.title === title);
    it && (newsWeights[it.theme] = Math.max(0.2, Math.min(3, weightOf(it.theme) + (up ? 0.4 : -0.4))), ls.set("newsWeights", newsWeights), up || (newsHidden.push(title), newsHidden = newsHidden.slice(-300), ls.set("newsHidden", newsHidden)), renderNewsPage(), renderHome());
  }
  function bindVotes(root) {
    root.querySelectorAll("[data-up]").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation(), vote(b.dataset.up, !0);
    })), root.querySelectorAll("[data-down]").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation(), vote(b.dataset.down, !1);
    }));
  }
  function renderNewsPage() {
    const page = $("newspage");
    if (!page) return;
    const themes = (newsUne ? ["\xC0 la une"] : []).concat(newsThemes.map((t) => t.name)), list = rankedNews(newsFilter).slice(0, 40), brief = aiBrief && aiBrief.data && aiBrief.data.actus;
    page.innerHTML = `<div class="page-title">Actualit\xE9s</div>
    ${brief ? `<div class="bubble"><span class="label">R\xE9sum\xE9 par l\u2019IA</span><p class="note">${esc(brief)}</p></div>` : ""}
    <div class="chips" id="nfilter"><button data-f="all" class="${newsFilter === "all" ? "on" : ""}">Pour toi</button>${themes.map((t) => `<button data-f="${esc(t)}" class="${newsFilter === t ? "on" : ""}">${esc(t)}</button>`).join("")}</div>
    <div class="bubble news-list">${list.length ? list.map((it) => newsRow(it, !0)).join("") : `<p class="hint">${news ? "Aucun article pour ce th\xE8me." : "Chargement des actualit\xE9s\u2026"}</p>`}</div>
    <p class="hint" style="padding:0 6px">\u{1F44D} / \u{1F44E} ajustent la place de chaque th\xE8me. Th\xE8mes modifiables dans les r\xE9glages.${news ? " Mis \xE0 jour il y a " + ago(news.at) + "." : ""}</p>`, page.querySelectorAll("#nfilter button").forEach((b) => b.addEventListener("click", () => {
      newsFilter = b.dataset.f, renderNewsPage();
    })), bindVotes(page);
  }
  function renderNewsSettings() {
    $("news-une").checked = newsUne, $("news-themes").innerHTML = newsThemes.map((t, i) => `<span class="chip themechip">${esc(t.name)}<button data-del="${i}" aria-label="Retirer ${esc(t.name)}">\xD7</button></span>`).join(""), $("news-themes").querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
      newsThemes.splice(+b.dataset.del, 1), ls.set("newsThemes", newsThemes), renderNewsSettings(), loadNews(!0).then(() => {
        renderNewsPage(), renderHome();
      });
    }));
  }
  $("news-une").addEventListener("change", () => {
    newsUne = $("news-une").checked, ls.set("newsUne", newsUne), loadNews(!0).then(() => {
      renderNewsPage(), renderHome();
    });
  });
  $("news-add").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("news-q").value.trim();
    v && (newsThemes.push({ name: v.length > 18 ? v.slice(0, 18) + "\u2026" : v, q: v }), ls.set("newsThemes", newsThemes), $("news-q").value = "", renderNewsSettings(), loadNews(!0).then(() => {
      renderNewsPage(), renderHome();
    }));
  });
  let aiKey = String(ls.get("aiKey", "") || "").trim(), aiModel = ls.get("aiModel", "gemini-3.1-flash-lite") || "gemini-3.1-flash-lite", aiBrief = ls.get("aiBrief", null), aiErr = "", aiBusy = !1;
  const FALLBACK_MODELS = ["gemini-3.1-flash-lite", "gemini-3-flash-preview", "gemini-2.5-flash"], aiPeriod = () => {
    const h = (/* @__PURE__ */ new Date()).getHours();
    return h < 11 ? "matin" : h < 17 ? "journ\xE9e" : "soir";
  };
  async function gemini(prompt, json) {
    const models = [aiModel].concat(FALLBACK_MODELS.filter((m) => m !== aiModel));
    let last = "";
    for (const model of models) {
      const body = JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: Object.assign({ temperature: 0.6, maxOutputTokens: 900 }, json ? { responseMimeType: "application/json" } : {})
      }), r = await httpPost("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", body, { "x-goog-api-key": aiKey, "Content-Type": "application/json" });
      if (r.status === 200) {
        const j = JSON.parse(r.body), parts = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts, text = parts ? parts.map((p) => p.text || "").join("") : "";
        if (!text) throw new Error("r\xE9ponse vide de Gemini");
        return model !== aiModel && (aiModel = model, ls.set("aiModel", model)), text;
      }
      let msg = "";
      try {
        const e = JSON.parse(r.body);
        msg = e.error && e.error.message || "";
      } catch (e) {
      }
      if (r.status === 400 && /API key/i.test(msg)) throw new Error("cl\xE9 Gemini non valide");
      if (r.status === 401 || r.status === 403) throw new Error("cl\xE9 Gemini refus\xE9e (" + r.status + ")");
      if (r.status === 429) throw new Error("quota Gemini atteint, r\xE9essaie plus tard");
      if (r.status === 0) throw new Error("pas de connexion \xE0 Gemini");
      if (last = "Gemini " + r.status + (msg ? " : " + msg.slice(0, 120) : ""), r.status !== 404) throw new Error(last);
    }
    throw new Error(last || "aucun mod\xE8le Gemini disponible");
  }
  function aiContext() {
    const today = todayISO(), now = nowMin(), H = (/* @__PURE__ */ new Date()).getHours(), hours = weather && weather.hourly ? weather.hourly.filter((h) => {
      const d = h.t.slice(0, 10), hh = +h.t.slice(11, 13);
      return d === today && hh >= H || d === tomorrowISO() && hh <= 9;
    }).filter((_, i) => i % 2 === 0).slice(0, 12).map((h) => h.t.slice(5, 16).replace("T", " ") + " " + Math.round(h.temp) + "\xB0C " + shortSky(h.code) + " pluie " + (h.rain || 0) + "%") : [], tr = (d, iso) => trainsFor(d, iso).filter((t) => iso !== today || t.dep >= now).slice(0, 4).map((t) => hm(t.sched) + "\u2192" + hm(t.arr) + (cancelled(t) ? " SUPPRIM\xC9" : t.delay > 0 ? " +" + t.delay + "min" : "")), left = lists.map((l) => ({ liste: l.name, a_faire: l.items.filter((i) => !i.done).slice(0, 8).map((i) => i.text + (i.remind ? " (rappel " + fmtWhen(i.remind) + ")" : "")) })).filter((x) => x.a_faire.length);
    return {
      maintenant: (/* @__PURE__ */ new Date()).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }),
      moment: aiPeriod(),
      lieu: "Dijon (domicile) ; trajets en TER direct Dijon Ville \u21C4 Le Creusot Ville (environ 53 min)",
      planning: { aujourdhui: isTrainDay(today) ? "jour au Creusot (train)" : "jour \xE0 Dijon (pas de train)", demain: isTrainDay(tomorrowISO()) ? "jour au Creusot (train)" : "jour \xE0 Dijon" },
      meteo: weather ? { maintenant: weather.now + "\xB0C " + weather.nowSky, min: weather.tmin, max: weather.tmax, pluie_max: (weather.rain || 0) + "%", vent_rafales: (weather.gusts || 0) + " km/h", heures: hours } : "indisponible",
      trains: isTrainDay(today) ? { vers_le_creusot: tr("aller", today), vers_dijon: tr("retour", today), source: isLive(today) ? "temps r\xE9el SNCF" : "horaires indicatifs" } : { demain_premier_direct: tr("aller", tomorrowISO()).slice(0, 1) },
      listes: left,
      titres_actualite: rankedNews("all").slice(0, 10).map((it) => it.title + " (" + it.theme + ")")
    };
  }
  async function loadBrief(force) {
    if (!aiKey || aiBusy) return;
    const p = aiPeriod(), d = todayISO();
    if (!force && aiBrief && aiBrief.date === d && aiBrief.period === p) return;
    aiBusy = !0, aiErr = "", renderHome();
    const prompt = `Tu es l\u2019assistant personnel du matin de Tristan, apprenti ing\xE9nieur (robotique) qui vit \xE0 Dijon et va parfois au Creusot en train.
\xC0 partir des donn\xE9es JSON ci-dessous, r\xE9dige en fran\xE7ais un brief court et concret pour le moment \xAB ${p} \xBB.
R\xE8gles : tutoie-le, phrases courtes, pas de formules creuses, n\u2019invente aucune donn\xE9e absente du JSON, cite les heures exactes quand elles comptent (pluie, trains).
R\xE9ponds UNIQUEMENT avec un objet JSON de cette forme :
{"titre": "une phrase d\u2019accroche de 8 mots max",
 "prendre": ["2 \xE0 5 objets ou v\xEAtements \xE0 prendre, 1 \xE0 3 mots chacun"],
 "conseils": ["3 ou 4 conseils pratiques pour la journ\xE9e (trains, m\xE9t\xE9o, t\xE2ches des listes), 20 mots max chacun"],
 "actus": "r\xE9sum\xE9 neutre des titres d\u2019actualit\xE9 en 2 ou 3 phrases, ou cha\xEEne vide s\u2019il n\u2019y en a pas"}
Donn\xE9es : ${JSON.stringify(aiContext())}`;
    try {
      const clean = (await gemini(prompt, !0)).replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, ""), data = JSON.parse(clean);
      aiBrief = { date: d, period: p, at: Date.now(), data: { titre: String(data.titre || ""), prendre: (data.prendre || []).map(String).slice(0, 6), conseils: (data.conseils || []).map(String).slice(0, 5), actus: String(data.actus || "") } }, ls.set("aiBrief", aiBrief), note("brief IA OK (" + aiModel + ")");
    } catch (e) {
      aiErr = e.message, note("IA : " + e.message);
    }
    aiBusy = !1, renderHome(), renderNewsPage();
  }
  function renderAiSettings() {
    $("ai-key").value = aiKey, $("ai-model").value = aiModel, $("ai-status").textContent = aiKey ? aiErr ? "Erreur : " + aiErr : aiBrief ? "Cl\xE9 active \xB7 dernier brief " + new Date(aiBrief.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "Cl\xE9 enregistr\xE9e" : "Aucune cl\xE9 : conseils simples sans IA.";
  }
  $("ai-save").addEventListener("click", async () => {
    if (aiKey = $("ai-key").value.replace(/\s+/g, ""), $("ai-key").value = aiKey, aiModel = $("ai-model").value.trim() || "gemini-3.1-flash-lite", ls.set("aiKey", aiKey), ls.set("aiModel", aiModel), !aiKey) {
      aiBrief = null, ls.set("aiBrief", null), renderAiSettings(), renderHome();
      return;
    }
    $("ai-status").textContent = "Test de la cl\xE9\u2026";
    try {
      await gemini("R\xE9ponds seulement : OK", !1), $("ai-status").textContent = "Cl\xE9 valide (" + aiModel + "), pr\xE9paration du brief\u2026", await loadBrief(!0), renderAiSettings();
    } catch (e) {
      aiErr = e.message, $("ai-status").textContent = "\xC9chec : " + e.message;
    }
  });
  let themeMode = ls.get("themeMode", "auto"), animOn = ls.get("animOn", !0), styleMode = ls.get("styleMode", "sobre");
  function effectiveMode() {
    return themeMode !== "auto" ? themeMode : skyNow().isNight ? "dark" : "light";
  }
  function applyAppearance() {
    const m = effectiveMode();
    document.documentElement.setAttribute("data-mode", m), document.documentElement.setAttribute("data-style", styleMode), document.querySelectorAll("#style2-seg button").forEach((b) => b.classList.toggle("on", b.dataset.st === styleMode)), document.documentElement.classList.toggle("no-anim", !animOn), document.querySelectorAll("#theme-seg button").forEach((b) => b.classList.toggle("on", b.dataset.mode === themeMode)), $("anim-on") && ($("anim-on").checked = animOn);
  }
  document.querySelectorAll("#theme-seg button").forEach((b) => b.addEventListener("click", () => {
    themeMode = b.dataset.mode, ls.set("themeMode", themeMode), applyAppearance(), renderSky();
  }));
  document.querySelectorAll("#style2-seg button").forEach((b) => b.addEventListener("click", () => {
    styleMode = b.dataset.st, ls.set("styleMode", styleMode), applyAppearance(), renderSky();
  }));
  $("anim-on").addEventListener("change", () => {
    animOn = $("anim-on").checked, ls.set("animOn", animOn), applyAppearance();
  });
  const DEFAULT_LAYOUT = [
    { id: "w-clock", type: "clock", size: "m" },
    { id: "w-memo", type: "memo", size: "l" },
    { id: "w-ai", type: "ai", size: "l" },
    { id: "w-next", type: "next", size: "l" },
    { id: "w-wx", type: "weather", size: "m" },
    { id: "w-news", type: "news", size: "l" },
    { id: "w-rain", type: "rain", size: "s" },
    { id: "w-week", type: "week", size: "s" },
    { id: "w-tomorrow", type: "tomorrow", size: "m" },
    { id: "w-back", type: "back", size: "m" },
    { id: "w-depart", type: "depart", size: "m" },
    { id: "w-list", type: "list", size: "m", list: "afaire" }
  ];
  let layout = ls.get("layout6", null) || DEFAULT_LAYOUT.map((b) => Object.assign({}, b)), autoOrder = ls.get("autoOrder", !0), homeEdit = !1;
  const saveLayout = () => ls.set("layout6", layout), SIZES = ["s", "m", "l"], SIZE_NAME = { s: "Petit", m: "Large", l: "Grand" }, BTYPES = {
    memo: { name: "M\xE9mo", desc: "Ton dernier m\xE9mo \xE9crit au doigt, toujours visible", single: !0 },
    ai: { name: "Brief IA", desc: "Gemini te dit quoi prendre et te conseille pour la journ\xE9e", single: !0 },
    news: { name: "Actualit\xE9s", desc: "La une et tes th\xE8mes (robotique, IA, trains, Dijon\u2026)", single: !0, go: "news" },
    clock: { name: "Horloge", desc: "Heure, date, lever et coucher du soleil", single: !0 },
    weather: { name: "M\xE9t\xE9o", desc: "Temp\xE9rature, ciel, conseils, matin/midi/soir", single: !0, go: "meteo" },
    next: { name: "Directs vers Le Creusot", desc: "Les prochains directs depuis Dijon", single: !0 },
    back: { name: "Retours vers Dijon", desc: "Les prochains directs depuis Le Creusot", single: !0 },
    tomorrow: { name: "Demain", desc: "Planning, premier direct, dernier retour, m\xE9t\xE9o", single: !0 },
    take: { name: "Quoi prendre", desc: "Parapluie, veste, lunettes\u2026 selon la m\xE9t\xE9o", single: !0 },
    depart: { name: "Avant de partir", desc: "Checklist remise \xE0 z\xE9ro chaque jour", single: !0 },
    rain: { name: "Pluie \xE0 venir", desc: "Probabilit\xE9 de pluie heure par heure", single: !0, go: "meteo" },
    favs: { name: "Mes trains", desc: "Tes trains \xE9toil\xE9s et leur \xE9tat", single: !0 },
    week: { name: "Ma semaine", desc: "Tes jours au Creusot et \xE0 Dijon", single: !0 },
    list: { name: "Liste", desc: "Une de tes listes, \xE0 cocher", single: !1 },
    note: { name: "Note", desc: "Un texte libre \xE0 garder sous les yeux", single: !1 }
  }, bEl = (b) => document.querySelector('#home [data-bid="' + b.id + '"]');
  function gridCols() {
    const w = $("home").clientWidth || window.innerWidth;
    return w < 600 ? 2 : w < 900 ? 4 : w < 1300 ? 6 : 8;
  }
  function sizeGrid() {
    const home = $("home"), cols = gridCols(), gap = parseFloat(getComputedStyle(home).columnGap) || 10, w = home.clientWidth || window.innerWidth - 28, cell = Math.max(110, Math.floor((w - gap * (cols - 1)) / cols));
    home.style.setProperty("--cols", cols), home.style.setProperty("--cell", cell + "px");
    const units = layout.reduce((n, b) => n + (b.size === "l" ? 4 : b.size === "m" ? 2 : 1), 0), rows = Math.max(1, Math.ceil(units / cols)), page = $("p-main"), used = ($("alertbar").offsetHeight || 0) + ($("home-tools").offsetHeight || 0) + 110, avail = (page && page.clientHeight ? page.clientHeight : window.innerHeight) - used, fit = Math.floor((avail - gap * (rows - 1)) / rows), h = Math.max(Math.round(cell * 0.72), Math.min(Math.round(cell * 1.35), fit || cell));
    home.style.setProperty("--cellh", h + "px");
  }
  window.addEventListener("resize", () => {
    sizeGrid();
  });
  function buildHome() {
    const home = $("home");
    layout = layout.filter((b) => BTYPES[b.type]), layout.forEach((b) => {
      SIZES.indexOf(b.size) < 0 && (b.size = "m");
    }), home.innerHTML = layout.map((b) => `<div class="bubble w w-${b.size} w-type-${b.type}" data-bid="${esc(b.id)}"></div>`).join(""), home.classList.toggle("is-edit", homeEdit), sizeGrid(), renderHomeTools();
  }
  function renderHome() {
    layout.forEach((b) => {
      const el = bEl(b);
      if (!el) return;
      const fn = W[b.type];
      el.onclick = null, el.classList.remove("tap");
      try {
        fn(el, b, b.size);
      } catch (e) {
        el.innerHTML = '<span class="label">' + esc(BTYPES[b.type].name) + '</span><span class="s">Erreur d\u2019affichage</span>', note("widget " + b.type + " : " + e.message);
      }
      const go = BTYPES[b.type].go;
      go && (el.onclick = homeEdit ? null : () => show(go), el.classList.toggle("tap", !homeEdit));
    }), homeEdit && decorateEditing();
  }
  const W = {
    memo(el, b, size) {
      const m = latestMemo();
      if (!m) {
        el.innerHTML = '<span class="label">M\xE9mo</span><div class="memo-empty"><span class="memo-pen">\u270E</span><span class="s">Touche ici pour \xE9crire un m\xE9mo au doigt.</span></div>', el.onclick = homeEdit ? null : () => openMemoEditor(null), el.classList.toggle("tap", !homeEdit);
        return;
      }
      el.innerHTML = `<div class="w-head"><span class="label">M\xE9mo</span><span class="s">${esc(new Date(m.at).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" }))}${memos.length > 1 ? " \xB7 " + memos.length + " m\xE9mos" : ""}</span></div><div class="memo-frame"><canvas></canvas></div>`;
      const cv = el.querySelector("canvas");
      requestAnimationFrame(() => paintMemo(cv, m)), el.onclick = homeEdit ? null : () => openMemoEditor(m.id), el.classList.toggle("tap", !homeEdit);
    },
    ai(el, b, size) {
      const tags = aiBrief && aiBrief.date === todayISO() && aiBrief.data.prendre.length ? aiBrief.data.prendre : whatToTake(), fresh = aiBrief && aiBrief.date === todayISO() ? aiBrief : null, tips = fresh ? fresh.data.conseils : localTips(), head = `<div class="w-head"><span class="label">${aiKey ? "Brief IA \xB7 " + aiPeriod() : "Conseils du jour"}</span>${aiKey ? `<button class="link" data-ai="1" aria-label="R\xE9g\xE9n\xE9rer">${aiBusy ? "\u2026" : "\u21BB"}</button>` : ""}</div>`, status = aiBusy ? '<span class="s">Gemini pr\xE9pare ton brief\u2026</span>' : aiErr ? `<span class="s">IA indisponible : ${esc(aiErr)}</span>` : aiKey ? "" : '<span class="s">Ajoute ta cl\xE9 Gemini dans \u2699\uFE0F pour des conseils r\xE9dig\xE9s par l\u2019IA.</span>';
      size === "s" ? el.innerHTML = head + `<p class="ai-tip">${esc(fresh && fresh.data.titre || tips[0] || "")}</p>` : el.innerHTML = head + (fresh && fresh.data.titre && size === "l" ? `<strong class="ai-title">${esc(fresh.data.titre)}</strong>` : "") + (tags.length ? `<div class="tags">${tags.slice(0, size === "m" ? 3 : 6).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : "") + `<ul class="ai-tips">${tips.slice(0, size === "m" ? 1 : 4).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` + status;
      const btn = el.querySelector("[data-ai]");
      btn && btn.addEventListener("click", (e) => {
        e.stopPropagation(), homeEdit || loadBrief(!0);
      });
    },
    news(el, b, size) {
      const list = rankedNews("all").slice(0, size === "s" ? 1 : size === "m" ? 3 : 6);
      el.innerHTML = `<div class="w-head"><span class="label">Actualit\xE9s</span><span class="s">${news ? ago(news.at) : ""}</span></div>
      ${list.length ? `<div class="w-news">${list.map((it) => `<div class="w-nrow"><span class="w-ntitle">${esc(it.title)}</span>${size !== "s" ? `<span class="s">${esc(it.theme)}${it.source ? " \xB7 " + esc(it.source) : ""}</span>` : ""}</div>`).join("")}</div>` : `<span class="s">${newsErr || "Chargement\u2026"}</span>`}`;
    },
    clock(el, b, size) {
      const d = /* @__PURE__ */ new Date(), d0 = weather && weather.days && weather.days.find((x) => x.t === todayISO());
      el.innerHTML = `<span class="w-clock num" data-clock>${pad(d.getHours())}:${pad(d.getMinutes())}</span>
      ${size !== "s" ? `<span class="w-sub">${esc(cap(longDate(d)))}</span>` : `<span class="w-sub">${esc(d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }))}</span>`}
      ${size === "l" && d0 ? `<div class="w-kv"><div><span class="s">Lever</span><b class="num">${d0.sunrise.slice(11, 16)}</b></div><div><span class="s">Coucher</span><b class="num">${d0.sunset.slice(11, 16)}</b></div></div>` : ""}`;
    },
    weather(el, b, size) {
      if (!weather) {
        el.innerHTML = '<span class="label">M\xE9t\xE9o</span><span class="s">Chargement\u2026</span>';
        return;
      }
      const tip = advice(weather), per = weather.periods.filter((p) => p.temp != null);
      el.innerHTML = `<div class="w-head"><span class="label">M\xE9t\xE9o \xB7 Dijon</span></div>
      <div class="w-big num">${weather.now}\xB0</div>
      <span class="w-sub">${esc(size === "s" ? shortSky(weather.code) : weather.nowSky)} \xB7 ${weather.tmin}\xB0/${weather.tmax}\xB0</span>
      ${size !== "s" && tip ? `<span class="s">${esc(tip)}</span>` : ""}
      ${size === "l" && per.length ? `<div class="w-periods">${per.map((p) => `<div><span class="s">${esc(p.label)}</span><b class="num">${p.temp}\xB0</b><span class="s">${esc(p.sky || "")}</span></div>`).join("")}</div>` : ""}`;
    },
    next(el, b, size) {
      trainWidget(el, size, "aller", "Vers Le Creusot");
    },
    back(el, b, size) {
      trainWidget(el, size, "retour", "Vers Dijon");
    },
    tomorrow(el, b, size) {
      const iso = tomorrowISO(), plan = isTrainDay(iso), first = trainsFor("aller", iso).find((t) => !cancelled(t)), back = trainsFor("retour", iso).filter((t) => !cancelled(t)), lastBack = back[back.length - 1], wd = weather && weather.days && weather.days.find((x) => x.t === iso);
      el.innerHTML = `<div class="w-head"><span class="label">Demain</span><span class="chip ${plan ? "next" : ""}">${plan ? "Le Creusot" : "Dijon"}</span></div>
      ${size === "s" ? `<div class="w-big num" style="font-size:2rem">${plan && first ? hm(first.sched) : "\u2014"}</div><span class="w-sub">${plan ? "premier direct" : "pas de train"}</span>` : `<div class="w-kv">
          <div><span class="s">Premier direct</span><b class="num">${plan && first ? hm(first.sched) + " \u2192 " + hm(first.arr) : "\u2014"}</b></div>
          ${plan && lastBack ? `<div><span class="s">Dernier retour</span><b class="num">${hm(lastBack.sched)}</b></div>` : ""}
          ${wd ? `<div><span class="s">M\xE9t\xE9o</span><b class="num">${wd.min}\xB0 / ${wd.max}\xB0</b>${size === "l" ? `<span class="s">${esc(sky(wd.code))}</span>` : ""}</div>` : ""}
        </div>`}`, el.onclick = homeEdit ? null : () => {
        trainDay = "tomorrow", renderTrains(), show("trains");
      }, el.classList.toggle("tap", !homeEdit);
    },
    take(el, b, size) {
      const tags = whatToTake(), shown = size === "s" ? tags.slice(0, 2) : tags;
      el.innerHTML = `<span class="label">Quoi prendre</span>
      <div class="tags">${weather ? shown.length ? shown.map((t) => `<span class="tag">${esc(t)}</span>`).join("") + (tags.length > shown.length ? `<span class="s">+${tags.length - shown.length}</span>` : "") : '<span class="s">Rien de sp\xE9cial</span>' : '<span class="s">Chargement\u2026</span>'}</div>`;
    },
    depart(el, b, size) {
      const l = doorList(), left = l.items.filter((i) => !i.done).length;
      if (size === "s") {
        el.innerHTML = `<span class="label">${esc(l.name)}</span><div class="w-big num" style="font-size:2.2rem">${l.items.length - left}/${l.items.length}</div><span class="w-sub">${left ? "\xE0 cocher" : "tout est pr\xEAt"}</span>`, el.onclick = homeEdit ? null : () => {
          current = l.id, ls.set("list", current), renderLists(), show("lists");
        }, el.classList.toggle("tap", !homeEdit);
        return;
      }
      const items = size === "m" ? l.items.slice(0, 4) : l.items;
      el.innerHTML = `<div class="w-head"><span class="label">${esc(l.name)}</span><span class="s">${left ? left + " \xE0 faire" : "pr\xEAt"}</span></div>
      <div class="checks">${items.map((i) => `<button class="check ${i.done ? "on" : ""}" data-id="${esc(i.id)}"><i></i><span>${esc(i.text)}</span></button>`).join("")}</div>`, el.querySelectorAll(".check").forEach((btn) => btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const it = l.items.find((x) => x.id === btn.dataset.id);
        it && (it.done = !it.done, persist(), renderHome(), renderLists());
      }));
    },
    rain(el, b, size) {
      if (!weather || !weather.hourly) {
        el.innerHTML = '<span class="label">Pluie</span><span class="s">Chargement\u2026</span>';
        return;
      }
      const H = (/* @__PURE__ */ new Date()).getHours(), n = size === "l" ? 12 : 6, hrs = weather.hourly.filter((h) => {
        const d = h.t.slice(0, 10), hh = +h.t.slice(11, 13);
        return d === todayISO() && hh >= H || d === tomorrowISO();
      }).slice(0, n), max = hrs.reduce((m, h) => Math.max(m, h.rain || 0), 0);
      if (size === "s") {
        el.innerHTML = `<span class="label">Pluie \xB7 6 h</span><div class="w-big num" style="font-size:2.4rem">${max}%</div><span class="w-sub">${max >= 50 ? "parapluie !" : max >= 25 ? "possible" : "peu probable"}</span>`;
        return;
      }
      el.innerHTML = `<span class="label">Pluie \xB7 ${n} prochaines heures</span>
      <div class="rainbars" style="grid-template-columns:repeat(${hrs.length},1fr)">${hrs.map((h) => `<div class="rb-col"><span class="rb-pct num">${h.rain || 0}</span><div class="rb-bar"><i style="height:${Math.max(4, h.rain || 0)}%"></i></div><span class="rb-h num">${+h.t.slice(11, 13)}h</span></div>`).join("")}</div>`;
    },
    favs(el, b, size) {
      const today = todayISO();
      if (!favs.length) {
        el.innerHTML = '<span class="label">Mes trains</span><span class="s">\xC9toile un train dans la page Trains.</span>';
        return;
      }
      const rows = favs.slice().sort((a, c) => toMin(a.dep) - toMin(c.dep)).map((f) => ({ f, t: trainsFor(f.dir, today).find((x) => hm(x.sched) === f.dep) })), shown = size === "s" ? rows.filter((r) => toMin(r.f.dep) >= nowMin()).slice(0, 1) : rows.slice(0, size === "m" ? 2 : 6);
      el.innerHTML = `<span class="label">Mes trains</span>${(shown.length ? shown : rows.slice(0, 1)).map((r) => `<div class="trow" data-dir="${r.f.dir}" data-dep="${r.f.dep}"><span class="h num">${r.f.dep}</span>${size !== "s" ? `<span class="a">${r.f.dir === "aller" ? "\u2192 Le Creusot" : "\u2192 Dijon"}</span>` : ""}${isTrainDay(today) ? r.t ? chipFor(r.t, today) : "" : '<span class="s">pas aujourd\u2019hui</span>'}</div>`).join("")}`, el.querySelectorAll("[data-dep]").forEach((row) => row.addEventListener("click", () => {
        const t = trainsFor(row.dataset.dir, today).find((x) => hm(x.sched) === row.dataset.dep);
        t && !homeEdit && openTrain(row.dataset.dir, t, today);
      }));
    },
    week(el, b, size) {
      const n = size === "s" ? 2 : size === "m" ? 7 : 14, start = dateOf(todayISO()), days = [];
      for (let k = 0; k < n; k++) {
        const d = new Date(start);
        d.setDate(start.getDate() + k), days.push(isoOf(d));
      }
      size === "s" ? el.innerHTML = `<span class="label">Planning</span>${days.map((iso, i) => `<div class="w-line"><span>${i ? "Demain" : "Aujourd\u2019hui"}</span><b class="${isTrainDay(iso) ? "acc" : ""}">${isTrainDay(iso) ? "Creusot" : "Dijon"}</b></div>`).join("")}` : el.innerHTML = `<div class="w-head"><span class="label">Ma semaine</span><span class="s">touche pour modifier</span></div>
        <div class="weekrow" style="grid-template-columns:repeat(7,1fr)">${days.map((iso) => {
        const d = dateOf(iso), on = isTrainDay(iso);
        return `<div class="wd ${on ? "on" : ""} ${iso === todayISO() ? "today" : ""}"><span>${WD[d.getDay()].slice(0, 1)}</span><b class="num">${d.getDate()}</b><small>${on ? "LC" : "DJ"}</small></div>`;
      }).join("")}</div>`, el.onclick = homeEdit ? null : openPlanning, el.classList.toggle("tap", !homeEdit);
    },
    list(el, b, size) {
      const l = lists.find((x) => x.id === b.list) || lists[0];
      if (!l) {
        el.innerHTML = '<span class="label">Liste</span><span class="s">Aucune liste.</span>';
        return;
      }
      const left = l.items.filter((i) => !i.done);
      if (size === "s") {
        el.innerHTML = `<span class="label">${esc(l.name)}</span><div class="w-big num" style="font-size:2.4rem">${left.length}</div><span class="w-sub">${left.length ? "\xE0 faire" : "rien en attente"}</span>`, el.onclick = homeEdit ? null : () => {
          current = l.id, ls.set("list", current), renderLists(), show("lists");
        }, el.classList.toggle("tap", !homeEdit);
        return;
      }
      el.innerHTML = `<div class="w-head"><span class="label">${esc(l.name)}</span><button class="link" data-see="1">${left.length ? "Tout voir" : "Ajouter"}</button></div>
      ${left.length ? `<div class="stack w-items">${left.slice(0, size === "m" ? 2 : 6).map((i) => itemHTML(i, !0)).join("")}</div>` : '<span class="s">Rien en attente.</span>'}`, bindItems(el, l), el.querySelector("[data-see]").addEventListener("click", (e) => {
        e.stopPropagation(), current = l.id, ls.set("list", current), renderLists(), show("lists");
      });
    },
    note(el, b, size) {
      el.innerHTML = `<span class="label">Note</span><p class="note">${esc(b.text || "Touche pour \xE9crire ta note.")}</p>`, el.onclick = homeEdit ? null : () => editNote(b), el.classList.toggle("tap", !homeEdit);
    }
  };
  function localTips() {
    const tips = [], today = todayISO(), now = nowMin(), rain = rainSoon();
    if (rain != null && tips.push("Pluie probable vers " + rain + " h : pr\xE9vois un parapluie."), isTrainDay(today)) {
      const n = trainsFor("aller", today).find((t) => t.dep >= now && !cancelled(t));
      n && tips.push("Prochain direct vers Le Creusot \xE0 " + hm(n.sched) + (n.delay > 0 ? " (+" + n.delay + " min)" : "") + ".");
    } else tips.push("Journ\xE9e \xE0 Dijon, pas de train aujourd\u2019hui.");
    if (isTrainDay(tomorrowISO())) {
      const f = trainsFor("aller", tomorrowISO()).find((t) => !cancelled(t));
      f && (/* @__PURE__ */ new Date()).getHours() >= 17 && tips.push("Demain, premier direct \xE0 " + hm(f.sched) + " : pr\xE9pare ton sac ce soir.");
    }
    const todo = lists.reduce((n, l) => n + (l.daily ? 0 : l.items.filter((i) => !i.done).length), 0);
    return todo && tips.push(todo + " \xE9l\xE9ment" + (todo > 1 ? "s" : "") + " en attente dans tes listes."), tips;
  }
  function trainWidget(el, size, d, title) {
    const today = todayISO(), now = nowMin();
    if (!isTrainDay(today)) {
      const f = trainsFor(d, tomorrowISO()).find((t) => !cancelled(t));
      el.innerHTML = `<span class="label">${title}</span><b class="w-sub">Journ\xE9e \xE0 Dijon</b>${size !== "s" && isTrainDay(tomorrowISO()) && f ? `<span class="s">Demain : ${hm(f.sched)}</span>` : ""}`, el.onclick = homeEdit ? null : () => {
        trainDay = "today", dir = d, renderTrains(), show("trains");
      };
      return;
    }
    const n = size === "s" ? 1 : size === "m" ? 2 : 4, list = trainsFor(d, today).filter((t) => t.dep >= now - 0.5).slice(0, n), first = list[0] ? hm(list[0].sched) + (list[0].delay || 0) + list[0].status : "", popped = first !== (trainWidget.last || {})[d];
    trainWidget.last = Object.assign(trainWidget.last || {}, { [d]: first }), el.innerHTML = `<div class="w-head"><span class="label">${title}</span>${size !== "s" ? `<span class="s">${isLive(today) ? "temps r\xE9el" : "indicatif"}</span>` : ""}</div>
    ${list.length ? list.map((t, i) => `<div class="trow ${i === 0 ? "first" : ""}" data-sched="${t.sched}">
        <span class="h num ${i === 0 && popped && animOn ? "pop" : ""}">${hm(t.sched)}</span>${size !== "s" ? `<span class="a num">\u2192 ${hm(t.arr)}</span>` : ""}${chipFor(t, today)}</div>`).join("") : '<b class="w-sub">Plus de direct</b>'}`, el.querySelectorAll("[data-sched]").forEach((row) => row.addEventListener("click", () => {
      if (homeEdit) return;
      const t = trainsFor(d, today).find((x) => x.sched === +row.dataset.sched);
      t && openTrain(d, t, today);
    }));
  }
  function editNote(b) {
    openDetail("Accueil", "Note", () => {
      $("dt-body").innerHTML = `<div class="bubble"><textarea id="note-text" rows="6" placeholder="Ta note\u2026">${esc(b.text || "")}</textarea>
      <div class="row-btns"><button class="btn" id="note-save">Enregistrer</button></div></div>`, $("note-save").addEventListener("click", () => {
        b.text = $("note-text").value.trim(), saveLayout(), closeDetail(), renderAll();
      });
    });
  }
  function renderHomeTools() {
    $("home-tools").innerHTML = homeEdit ? `<div class="bubble edit-bar">
        <div class="switch"><div><strong>Ordre automatique</strong><span class="hint">Met en t\xEAte le widget utile selon le moment</span></div><input type="checkbox" id="auto-order" ${autoOrder ? "checked" : ""} aria-label="Ordre automatique"></div>
        <div class="row-btns"><button class="btn" id="add-bubble">+ Ajouter un widget</button><button class="btn ghost" id="reset-home">Par d\xE9faut</button><button class="btn ghost" id="done-edit">Termin\xE9</button></div>
        <span class="hint">\u283F pour glisser \xB7 \u25C0 \u25B6 pour d\xE9placer \xB7 \u2922 pour changer la taille</span>
      </div>` : '<button class="edit-link" id="start-edit">Modifier l\u2019accueil</button>', homeEdit ? ($("auto-order").addEventListener("change", () => {
      autoOrder = $("auto-order").checked, ls.set("autoOrder", autoOrder), applyPriority();
    }), $("add-bubble").addEventListener("click", openCatalog), $("reset-home").addEventListener("click", () => {
      layout = DEFAULT_LAYOUT.map((b) => Object.assign({}, b)), saveLayout(), buildHome(), renderAll();
    }), $("done-edit").addEventListener("click", () => setEditing(!1))) : $("start-edit").addEventListener("click", () => setEditing(!0));
  }
  function setEditing(on) {
    homeEdit = on, buildHome(), renderAll();
  }
  function decorateEditing() {
    layout.forEach((b, i) => {
      const el = bEl(b);
      if (!el) return;
      el.style.order = String(i + 1);
      const bar = document.createElement("div");
      bar.className = "btools", bar.innerHTML = `<span class="grip" aria-label="Glisser">\u283F</span><button data-act="up" aria-label="Avant">\u25C0</button><button data-act="down" aria-label="Apr\xE8s">\u25B6</button>
      <span class="sp"></span><button data-act="size" aria-label="Taille : ${SIZE_NAME[b.size]}">\u2922</button><button data-act="del" aria-label="Supprimer">\xD7</button>`, el.appendChild(bar);
      const badge = document.createElement("span");
      badge.className = "size-badge", badge.textContent = SIZE_NAME[b.size], el.appendChild(badge), bar.querySelector('[data-act="up"]').addEventListener("click", () => moveBubble(b.id, -1)), bar.querySelector('[data-act="down"]').addEventListener("click", () => moveBubble(b.id, 1)), bar.querySelector('[data-act="size"]').addEventListener("click", () => {
        b.size = SIZES[(SIZES.indexOf(b.size) + 1) % 3], saveLayout(), buildHome(), renderAll();
      }), bar.querySelector('[data-act="del"]').addEventListener("click", () => {
        layout = layout.filter((x) => x.id !== b.id), saveLayout(), buildHome(), renderAll();
      }), startDrag(bar.querySelector(".grip"), b.id);
    });
  }
  function moveBubble(id, delta) {
    const i = layout.findIndex((b) => b.id === id), j = i + delta;
    if (i < 0 || j < 0 || j >= layout.length) return;
    const tmp = layout[i];
    layout[i] = layout[j], layout[j] = tmp, saveLayout(), buildHome(), renderAll();
  }
  function startDrag(grip, id) {
    grip.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const el = bEl(layout.find((b) => b.id === id));
      el.classList.add("dragging");
      try {
        grip.setPointerCapture(e.pointerId);
      } catch (err) {
      }
      const move = (ev) => {
        el.style.pointerEvents = "none";
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        el.style.pointerEvents = "";
        const target = under && under.closest && under.closest("#home .w");
        if (!target || target === el) return;
        const from = layout.findIndex((b) => b.id === id), to = layout.findIndex((b) => b.id === target.dataset.bid);
        if (from < 0 || to < 0) return;
        const item = layout.splice(from, 1)[0];
        layout.splice(to, 0, item), layout.forEach((b, k) => {
          const x = bEl(b);
          x && (x.style.order = String(k + 1));
        });
      }, up = () => {
        el.classList.remove("dragging"), grip.removeEventListener("pointermove", move), grip.removeEventListener("pointerup", up), grip.removeEventListener("pointercancel", up), saveLayout(), buildHome(), renderAll();
      };
      grip.addEventListener("pointermove", move), grip.addEventListener("pointerup", up), grip.addEventListener("pointercancel", up);
    });
  }
  function openCatalog() {
    openDetail("Accueil", "Ajouter un widget", () => {
      const has = (t) => layout.some((b) => b.type === t), rows = Object.keys(BTYPES).filter((t) => !(BTYPES[t].single && has(t))).map((t) => `<button class="cat" data-type="${t}"><strong>${esc(BTYPES[t].name)}</strong><span class="s">${esc(BTYPES[t].desc)}</span></button>`).join("");
      $("dt-body").innerHTML = `<div class="bubble"><span class="label">Taille</span><div class="seg seg3" id="cat-size">${SIZES.map((sz) => `<button data-size="${sz}" class="${sz === "m" ? "on" : ""}">${SIZE_NAME[sz]}</button>`).join("")}</div></div>
      <div class="cat-grid">${rows || '<p class="hint">Tous les widgets sont d\xE9j\xE0 sur l\u2019accueil.</p>'}</div><div id="cat-sub"></div>`;
      let size = "m";
      $("cat-size").querySelectorAll("button").forEach((sb) => sb.addEventListener("click", () => {
        size = sb.dataset.size, $("cat-size").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === sb));
      })), $("dt-body").querySelectorAll(".cat").forEach((btn) => btn.addEventListener("click", () => {
        const type = btn.dataset.type;
        if (type === "list") {
          $("cat-sub").innerHTML = `<div class="bubble"><span class="label">Quelle liste ?</span><div class="chips">${lists.map((l) => `<button data-list="${esc(l.id)}">${esc(l.name)}</button>`).join("")}</div></div>`, $("cat-sub").querySelectorAll("[data-list]").forEach((lb) => lb.addEventListener("click", () => addBubble("list", size, { list: lb.dataset.list })));
          return;
        }
        addBubble(type, size, {});
      }));
    });
  }
  function addBubble(type, size, extra) {
    const b = Object.assign({ id: "w-" + uid(), type, size: size || "m" }, extra);
    type === "depart" && doorList(), layout.push(b), saveLayout(), closeDetail(), buildHome(), renderAll(), type === "note" && editNote(b);
  }
  (function() {
    let timer = null;
    $("home").addEventListener("touchstart", (e) => {
      homeEdit || !e.target.closest(".w") || (timer = setTimeout(() => setEditing(!0), 700));
    }, { passive: !0 }), ["touchend", "touchmove", "touchcancel"].forEach((ev) => $("home").addEventListener(ev, () => clearTimeout(timer), { passive: !0 }));
  })();
  let memos = ls.get("memos", []);
  const MEMO_COLORS = { ink: () => cssVar("--ink"), accent: () => cssVar("--accent"), red: () => "#d9534f", yellow: () => "#e0b240" };
  function cssVar(n) {
    try {
      return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || "#888";
    } catch (e) {
      return "#888";
    }
  }
  const saveMemos = () => ls.set("memos", memos), latestMemo = () => memos.slice().sort((a, b) => b.at - a.at)[0] || null;
  function drawStrokes(ctx, strokes, W2, H, eraseBg) {
    ctx.clearRect(0, 0, W2, H), ctx.lineCap = "round", ctx.lineJoin = "round", strokes.forEach((s) => {
      if (!s.p.length) return;
      ctx.globalCompositeOperation = s.c === "erase" ? "destination-out" : "source-over", ctx.strokeStyle = s.c === "erase" ? "#000" : (MEMO_COLORS[s.c] || MEMO_COLORS.ink)(), ctx.lineWidth = s.w * Math.min(W2, H) / 400, ctx.beginPath();
      const P = s.p.map((q) => [q[0] * W2, q[1] * H]);
      ctx.moveTo(P[0][0], P[0][1]), P.length === 1 && ctx.lineTo(P[0][0] + 0.1, P[0][1] + 0.1);
      for (let i = 1; i < P.length - 1; i++) {
        const mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2;
        ctx.quadraticCurveTo(P[i][0], P[i][1], mx, my);
      }
      P.length > 1 && ctx.lineTo(P[P.length - 1][0], P[P.length - 1][1]), ctx.stroke();
    }), ctx.globalCompositeOperation = "source-over";
  }
  function paintMemo(canvas, memo) {
    const rect = canvas.parentNode.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    let w = rect.width || 300, h = rect.height || 200;
    memo.ratio && (w / h > memo.ratio ? w = h * memo.ratio : h = w / memo.ratio), canvas.style.width = w + "px", canvas.style.height = h + "px", canvas.width = Math.round(w * dpr), canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext && canvas.getContext("2d");
    ctx && drawStrokes(ctx, memo.strokes, canvas.width, canvas.height);
  }
  function openMemoEditor(memoId) {
    const existing = memoId ? memos.find((m) => m.id === memoId) : null;
    let strokes = existing ? existing.strokes.map((s) => ({ c: s.c, w: s.w, p: s.p.slice() })) : [], color = "ink", width = 6, erasing = !1;
    const sheet = $("memo-sheet");
    sheet.hidden = !1;
    const cv = $("memo-canvas"), box = $("memo-box");
    let ctx = null, W2 = 0, H = 0;
    function fit() {
      const r = box.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      W2 = Math.round((r.width || 600) * dpr), H = Math.round((r.height || 400) * dpr), cv.width = W2, cv.height = H, cv.style.width = (r.width || 600) + "px", cv.style.height = (r.height || 400) + "px", ctx = cv.getContext && cv.getContext("2d"), redraw();
    }
    const redraw = () => {
      ctx && drawStrokes(ctx, strokes, W2, H);
    };
    function tools() {
      sheet.querySelectorAll("[data-col]").forEach((b) => b.classList.toggle("on", !erasing && b.dataset.col === color)), sheet.querySelectorAll("[data-w]").forEach((b) => b.classList.toggle("on", +b.dataset.w === width)), $("memo-erase").classList.toggle("on", erasing);
    }
    sheet.querySelectorAll("[data-col]").forEach((b) => {
      b.onclick = () => {
        color = b.dataset.col, erasing = !1, tools();
      }, b.style.setProperty("--dot", MEMO_COLORS[b.dataset.col]());
    }), sheet.querySelectorAll("[data-w]").forEach((b) => {
      b.onclick = () => {
        width = +b.dataset.w, tools();
      };
    }), $("memo-erase").onclick = () => {
      erasing = !erasing, tools();
    }, $("memo-undo").onclick = () => {
      strokes.pop(), redraw();
    }, $("memo-clear").onclick = () => {
      strokes = [], redraw();
    }, $("memo-cancel").onclick = close, $("memo-save").onclick = () => {
      if (!strokes.filter((s) => s.c !== "erase" && s.p.length).length) {
        existing && (memos = memos.filter((m) => m.id !== existing.id), saveMemos()), close(), renderAll();
        return;
      }
      const ratio = W2 && H ? W2 / H : 1.5;
      existing ? (existing.strokes = strokes, existing.at = Date.now(), existing.ratio = ratio) : memos.push({ id: "m-" + uid(), at: Date.now(), ratio, strokes }), memos = memos.sort((a, b) => b.at - a.at).slice(0, 12), saveMemos(), layout.some((b) => b.type === "memo") || (layout.unshift({ id: "w-memo", type: "memo", size: "l" }), saveLayout(), buildHome()), close(), renderAll(), show("home");
    }, $("memo-delete").hidden = !existing, $("memo-delete").onclick = () => {
      memos = memos.filter((m) => m.id !== existing.id), saveMemos(), close(), renderAll();
    };
    let cur = null;
    const pos = (e) => {
      const r = cv.getBoundingClientRect();
      return [Math.min(1, Math.max(0, (e.clientX - r.left) / (r.width || 1))), Math.min(1, Math.max(0, (e.clientY - r.top) / (r.height || 1)))];
    };
    cv.onpointerdown = (e) => {
      e.preventDefault();
      try {
        cv.setPointerCapture(e.pointerId);
      } catch (err) {
      }
      cur = { c: erasing ? "erase" : color, w: erasing ? width * 4 : width, p: [pos(e)] }, strokes.push(cur), redraw();
    }, cv.onpointermove = (e) => {
      if (!cur) return;
      const q = pos(e), last = cur.p[cur.p.length - 1];
      Math.abs(q[0] - last[0]) + Math.abs(q[1] - last[1]) < 2e-3 || (cur.p.push([Math.round(q[0] * 1e4) / 1e4, Math.round(q[1] * 1e4) / 1e4]), redraw());
    }, cv.onpointerup = cv.onpointercancel = () => {
      cur = null;
    };
    function close() {
      sheet.hidden = !0, window.removeEventListener("resize", fit);
    }
    window.addEventListener("resize", fit), tools(), setTimeout(fit, 0), openMemoEditor.addStroke = (s) => {
      strokes.push(s), redraw();
    };
  }
  $("memo-fab").addEventListener("click", () => openMemoEditor(null));
  window.MonMatin = { openMemoEditor };
  function makeSetupLink() {
    const base = ($("setup-url").value || "").trim();
    if (!/^https:\/\/.+/.test(base)) {
      $("setup-out").innerHTML = '<span class="hint">Indique d\u2019abord l\u2019adresse https de ta version web (ex. https://ton-pseudo.github.io/monmatin/).</span>';
      return;
    }
    ls.set("webUrl", base);
    const data = {};
    SETUP_KEYS.forEach((k) => {
      const v = ls.get(k, void 0);
      v != null && v !== "" && (data[k] = v);
    });
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(data)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""), link = base.replace(/#.*$/, "") + "#setup=" + b64;
    $("setup-out").innerHTML = `<textarea id="setup-link" rows="3" readonly>${esc(link)}</textarea>
    <div class="row-btns"><button class="btn" id="setup-copy">Copier le lien</button></div>
    <span class="hint">Envoie-le-toi (Messages, mail, AirDrop) et ouvre-le une fois sur l\u2019iPad. Il contient tes cl\xE9s : ne le partage avec personne et supprime le message ensuite.</span>`, $("setup-copy").addEventListener("click", () => {
      const ta = $("setup-link"), done = () => {
        $("setup-copy").textContent = "Copi\xE9";
      };
      try {
        navigator.clipboard.writeText(link).then(done, () => {
          ta.select();
          try {
            document.execCommand("copy"), done();
          } catch (e) {
          }
        });
      } catch (e) {
        ta.select();
        try {
          document.execCommand("copy"), done();
        } catch (err) {
        }
      }
    });
  }
  $("setup-make").addEventListener("click", makeSetupLink);
  function renderSetup() {
    $("setup-url").value || ($("setup-url").value = ls.get("webUrl", "") || (N ? "" : location.origin + location.pathname));
  }
  setupImported && setTimeout(() => {
    setupImported > 0 ? ($("errbar").textContent = "R\xE9glages import\xE9s : cl\xE9s et pr\xE9f\xE9rences enregistr\xE9es sur cet appareil.", $("errbar").classList.add("okbar")) : $("errbar").textContent = "Le lien de configuration est invalide ou incomplet.", $("errbar").hidden = !1, setTimeout(() => {
      $("errbar").hidden = !0, $("errbar").classList.remove("okbar");
    }, 8e3);
  }, 400);
  function renderAll() {
    $("title").textContent = longDate(/* @__PURE__ */ new Date()), $("stamp").textContent = weather && weather.at ? "m\xE0j " + new Date(weather.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "chargement", renderWeather(), renderNext(), renderTrains(), renderPeek(), renderLists(), applyAppearance(), renderWeatherPage(), renderNewsPage(), renderSky(), applyPriority(), tickHeaderClock(), sizeGrid(), renderDoor(), syncWidget();
  }
  let busy = !1, lastLoad = 0;
  async function refresh() {
    if (busy) return;
    busy = !0, lastLoad = Date.now(), $("refresh").classList.add("spin"), $("errbar").hidden = !0;
    const errs = [];
    await Promise.all([
      loadWeather().catch((e) => errs.push(e.message)),
      loadTrains(),
      loadNews(!1).catch(() => {
      })
    ]), renderAll(), loadBrief(!1), $("refresh").classList.remove("spin"), busy = !1, errs.length && showError(errs.join(" \xB7 ")), renderAll(), detailRefresh && !$("detail").hidden && detailRefresh();
  }
  $("refresh").addEventListener("click", refresh);
  window.onAppResume = () => {
    Date.now() - lastLoad > 5 * 60 * 1e3 ? refresh() : renderAll();
  };
  view = "home";
  buildHome();
  renderAll();
  setTimeout(() => show("home", !0), 0);
  refresh();
  setInterval(() => {
    renderNext(), view === "trains" && renderTrains();
  }, 3e4);
})();
