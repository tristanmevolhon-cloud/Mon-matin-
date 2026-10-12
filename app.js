(() => {
  const VERSION = "5.0", $ = (id) => document.getElementById(id), esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]), ls = {
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
  }, N = window.Native || null, uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6), SETUP_KEYS = ["token", "planning", "shop", "shopHist", "animOn", "voiesOn", "webWall", "lists"];
  let setupImported = 0;
  (function() {
    const m = String(location.hash || "").match(/[#&]setup=([^&]+)/);
    if (m) {
      try {
        const data = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, "+").replace(/_/g, "/")))));
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
  const pad = (n) => String(n).padStart(2, "0"), isoOf = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()), todayISO = () => isoOf(/* @__PURE__ */ new Date()), dateOf = (iso) => /* @__PURE__ */ new Date(iso + "T12:00:00"), addDays = (iso, n) => {
    const d = dateOf(iso);
    return d.setDate(d.getDate() + n), isoOf(d);
  }, tomorrowISO = () => addDays(todayISO(), 1), nowMin = () => {
    const d = /* @__PURE__ */ new Date();
    return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  }, hm = (m) => pad(Math.floor(m / 60) % 24) + ":" + pad(Math.round(m) % 60), toMin = (t) => {
    const m = String(t).match(/(\d{1,2})\D?(\d{2})/);
    return m ? +m[1] * 60 + +m[2] : null;
  }, cap = (s) => s.charAt(0).toUpperCase() + s.slice(1), WD = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"], log = [];
  function note(msg) {
    log.unshift((/* @__PURE__ */ new Date()).toLocaleTimeString("fr-FR") + " " + msg), log.length = Math.min(log.length, 14);
  }
  let toastT = null;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg, t.style.opacity = "1", clearTimeout(toastT), toastT = setTimeout(() => {
      t.style.opacity = "0";
    }, 2600);
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
  let token = String(ls.get("token", "") || "").replace(/[^A-Za-z0-9-]/g, ""), weather = ls.get("weather5", null), live = ls.get("live2", null), trainErr = "", wxErr = "", planning = ls.get("planning", { pattern: [!1, !0, !0, !0, !0, !0, !1], overrides: {} });
  planning.overrides || (planning.overrides = {});
  const isTrainDay = (iso) => Object.prototype.hasOwnProperty.call(planning.overrides, iso) ? planning.overrides[iso] : !!planning.pattern[dateOf(iso).getDay()];
  let animOn = ls.get("animOn", !0), fxPreview = "", shop = ls.get("shop", null);
  if (!shop) {
    const old = (ls.get("lists", []) || []).find((l) => /course/i.test(l.name || l.id || ""));
    shop = old ? old.items.map((i) => ({ id: i.id || uid(), text: i.text, done: !!i.done })) : [], ls.set("shop", shop);
  }
  let shopHist = ls.get("shopHist", {});
  const PAGES = ["meteo", "home", "trains"];
  let view = "home";
  function markDots() {
    document.querySelectorAll("#dots button").forEach((b) => b.classList.toggle("on", b.dataset.go === view));
  }
  function show(v, instant) {
    PAGES.indexOf(v) < 0 && (v = "home"), view = v;
    const pg = $("pager"), left = PAGES.indexOf(v) * pg.clientWidth;
    try {
      pg.scrollTo({ left, behavior: instant || !animOn ? "auto" : "smooth" });
    } catch (e) {
      pg.scrollLeft = left;
    }
    markDots(), v === "trains" && renderTrainsPage(), v === "meteo" && renderMeteoPage();
  }
  document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", (e) => {
    e.stopPropagation(), show(b.dataset.go);
  }));
  (function() {
    const pg = $("pager");
    let t = null;
    pg.addEventListener("scroll", () => {
      clearTimeout(t), t = setTimeout(() => {
        const v = PAGES[Math.min(PAGES.length - 1, Math.max(0, Math.round(pg.scrollLeft / Math.max(1, pg.clientWidth))))];
        v !== view && (view = v, markDots(), v === "trains" && renderTrainsPage(), v === "meteo" && renderMeteoPage());
      }, 90);
    }, { passive: !0 }), window.addEventListener("resize", () => show(view, !0));
  })();
  window.onAppBack = () => $("settings").hidden ? view !== "home" ? (show("home"), !0) : !1 : ($("settings").hidden = !0, !0);
  const WMO = {
    0: "Ciel d\xE9gag\xE9",
    1: "Plut\xF4t d\xE9gag\xE9",
    2: "\xC9claircies",
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
  function wxCat(c) {
    return c == null ? "partly" : c <= 1 ? "clear" : c === 2 ? "partly" : c === 3 ? "cloudy" : c === 45 || c === 48 ? "fog" : c >= 95 ? "storm" : c >= 71 && c <= 77 || c === 85 || c === 86 ? "snow" : "rain";
  }
  const RAIN_INT = { 51: 0.25, 53: 0.35, 55: 0.5, 56: 0.35, 57: 0.5, 61: 0.45, 63: 0.7, 65: 1, 66: 0.55, 67: 0.9, 80: 0.55, 81: 0.75, 82: 1, 95: 0.9, 96: 1, 99: 1, 71: 0.4, 73: 0.7, 75: 1, 77: 0.4, 85: 0.6, 86: 0.9 };
  async function loadWeather() {
    const r = await httpGet("https://api.open-meteo.com/v1/forecast?latitude=47.322&longitude=5.041&timezone=Europe%2FParis&forecast_days=6&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m,is_day&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code,wind_speed_10m_max,sunrise,sunset,uv_index_max", "", !1);
    if (r.status !== 200) throw new Error("m\xE9t\xE9o indisponible (" + (r.status || r.body) + ")");
    const j = JSON.parse(r.body);
    weather = {
      at: Date.now(),
      date: todayISO(),
      now: Math.round(j.current.temperature_2m),
      code: j.current.weather_code,
      isDay: j.current.is_day,
      feels: Math.round(j.current.apparent_temperature),
      humidity: j.current.relative_humidity_2m,
      wind: Math.round(j.current.wind_speed_10m),
      gusts: Math.round(j.current.wind_gusts_10m),
      hourly: j.hourly.time.map((t, i) => ({
        t,
        temp: Math.round(j.hourly.temperature_2m[i]),
        rain: j.hourly.precipitation_probability[i] || 0,
        mm: j.hourly.precipitation[i] || 0,
        code: j.hourly.weather_code[i],
        day: j.hourly.is_day[i]
      })),
      days: j.daily.time.map((t, i) => ({
        t,
        max: Math.round(j.daily.temperature_2m_max[i]),
        min: Math.round(j.daily.temperature_2m_min[i]),
        rain: j.daily.precipitation_probability_max[i] || 0,
        mm: j.daily.precipitation_sum[i] || 0,
        code: j.daily.weather_code[i],
        wind: Math.round(j.daily.wind_speed_10m_max[i]),
        sunrise: j.daily.sunrise[i],
        sunset: j.daily.sunset[i],
        uv: j.daily.uv_index_max[i]
      }))
    }, ls.set("weather5", weather), note("m\xE9t\xE9o OK");
  }
  const todayW = () => weather && weather.days && weather.days.find((d) => d.t === todayISO()) || weather && weather.days && weather.days[0] || null;
  function nextHours(n, step) {
    if (!weather || !weather.hourly) return [];
    const H = /* @__PURE__ */ new Date();
    H.setMinutes(0, 0, 0);
    const key = isoOf(H) + "T" + pad(H.getHours()) + ":00", i0 = weather.hourly.findIndex((h) => h.t >= key);
    if (i0 < 0) return [];
    const out = [];
    for (let i = i0; i < weather.hourly.length && out.length < n; i += step) out.push(weather.hourly[i]);
    return out;
  }
  function advice() {
    if (!weather) return "";
    const hrs = nextHours(12, 1), d = todayW(), wet = hrs.find((h) => h.rain >= 50 || h.mm >= 0.5), tips = [];
    wet && tips.push(wet === hrs[0] ? "Pluie en cours ou imminente : prends un parapluie." : "Pluie probable vers " + +wet.t.slice(11, 13) + " h : prends un parapluie.");
    const minT = Math.min.apply(null, hrs.map((h) => h.temp).concat([weather.now]));
    return minT <= 2 ? tips.push("Risque de gel, couvre-toi bien.") : minT <= 9 ? tips.push("Frais : prends une veste.") : d && d.max >= 28 && tips.push("Chaud aujourd\u2019hui : pense \xE0 l\u2019eau."), weather.gusts >= 60 && tips.push("Fortes rafales (" + weather.gusts + " km/h)."), tips.slice(0, 2).join(" ");
  }
  function wxIcon(code, day) {
    const c = wxCat(code), D = day !== 0, sun = '<circle cx="24" cy="24" r="8" fill="#ffd56b"/><g stroke="#ffd56b" stroke-width="3" stroke-linecap="round">' + [0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
      const r = a * Math.PI / 180;
      return `<line x1="${24 + 13 * Math.cos(r)}" y1="${24 + 13 * Math.sin(r)}" x2="${24 + 18 * Math.cos(r)}" y2="${24 + 18 * Math.sin(r)}"/>`;
    }).join("") + "</g>", moon = '<path d="M30 9a14 14 0 1 0 10 22A12 12 0 0 1 30 9z" fill="#f2efe4"/>', cloud = (y, f) => `<path d="M15 ${36 + y}h20a8 8 0 0 0 0-16 11 11 0 0 0-21-2A7 7 0 0 0 15 ${36 + y}z" fill="${f || "#fff"}"/>`, small = (x, y) => `<g transform="translate(${x} ${y}) scale(.62)">${D ? sun : moon}</g>`;
    let s = "";
    return c === "clear" ? s = D ? sun : moon : c === "partly" ? s = small(2, 0) + cloud(4, "#f4f7fb") : c === "cloudy" ? s = cloud(-6, "#cfd8e3") + cloud(2, "#f4f7fb") : c === "fog" ? s = '<g stroke="#e6ecf2" stroke-width="3.2" stroke-linecap="round"><line x1="8" y1="16" x2="40" y2="16"/><line x1="12" y1="24" x2="36" y2="24"/><line x1="8" y1="32" x2="40" y2="32"/></g>' : c === "snow" ? s = cloud(-6, "#eef3f8") + '<g fill="#fff"><circle cx="16" cy="38" r="2.2"/><circle cx="24" cy="42" r="2.2"/><circle cx="32" cy="38" r="2.2"/></g>' : c === "storm" ? s = cloud(-6, "#b9c3cf") + '<path d="M25 30l-6 9h5l-3 8 9-11h-5l3-6z" fill="#ffd56b"/>' : s = cloud(-6, "#e2e9f1") + '<g stroke="#8fd0ff" stroke-width="2.6" stroke-linecap="round"><line x1="16" y1="35" x2="13" y2="42"/><line x1="24" y1="35" x2="21" y2="42"/><line x1="32" y1="35" x2="29" y2="42"/></g>', `<svg viewBox="0 0 48 48" aria-hidden="true">${s}</svg>`;
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
  }, NAMES = { aller: ["Dijon", "Le Creusot"], retour: ["Le Creusot", "Dijon"] }, staticTrains = (d) => STATIC[d].map((x) => {
    const dm = toMin(x[0]), am = toMin(x[1]);
    return { sched: dm, dep: dm, arr: am, arrBase: am, dur: am - dm, number: x[2], delay: 0, status: "", messages: [], stops: [] };
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
    throw r.status === 401 ? sncfError(401, "cl\xE9 SNCF refus\xE9e : v\xE9rifie qu\u2019elle est compl\xE8te, sans espace.", id) : r.status === 403 ? sncfError(403, "acc\xE8s refus\xE9 par la SNCF" + (detail ? " : " + detail : ""), id) : r.status === 429 ? sncfError(429, "quota de la cl\xE9 SNCF d\xE9pass\xE9, reprise plus tard.", id) : r.status === 0 ? sncfError(0, "pas de connexion \xE0 l\u2019API SNCF", id) : sncfError(r.status, "SNCF HTTP " + r.status + (detail ? " : " + detail : ""), id);
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
        const pt = (jr.sections || []).filter((s2) => s2.type === "public_transport");
        if (pt.length !== 1 || jr.nb_transfers > 0 || jr.duration > 90 * 60 || (jr.sections || []).filter((s2) => s2.type === "street_network" || s2.type === "transfer").reduce((a, s2) => a + (s2.duration || 0), 0) > 10 * 60) return;
        const s = pt[0], di = s.display_informations || {}, dep = parseNav(s.departure_date_time), sched = parseNav(s.base_departure_date_time || s.departure_date_time), arr = parseNav(s.arrival_date_time), arrBase = parseNav(s.base_arrival_date_time || s.arrival_date_time), key = sched + "-" + arrBase;
        if (seen[key]) return;
        seen[key] = 1;
        const ids = (di.links || []).filter((l) => l.type === "disruption").map((l) => l.id), messages = [];
        (j.disruptions || []).forEach((d) => {
          ids.indexOf(d.id) < 0 && ids.indexOf(d.disruption_id) < 0 || (d.messages || []).forEach((m) => {
            const t = String(m.text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
            t && messages.indexOf(t) < 0 && messages.push(t);
          });
        });
        const pc = (pl) => pl && pl.stop_point && pl.stop_point.platform_code || "";
        out.push({
          sched,
          dep,
          arr,
          arrBase,
          dur: Math.round(jr.duration / 60),
          number: di.headsign || di.trip_short_name || "",
          delay: dep - sched,
          status: jr.status || "",
          messages,
          voie: pc(s.from),
          voieArr: pc(s.to),
          stops: (s.stop_date_times || []).map((st) => ({ name: st.stop_point && st.stop_point.name || "", t: parseNav(st.departure_date_time || st.arrival_date_time) }))
        });
      });
    return out.sort((a, b) => a.sched - b.sched);
  }
  function trainTTL(iso) {
    if (iso !== todayISO()) return 60 * 6e4;
    const h = (/* @__PURE__ */ new Date()).getHours();
    return isTrainDay(iso) && h >= 5 && h < 21 ? 5 * 6e4 - 2e4 : 30 * 6e4;
  }
  let stations = ls.get("stations", null);
  async function loadTrains(force) {
    if (trainErr = "", !token) return;
    const pause = ls.get("sncfPause", 0);
    if (!force && pause > Date.now()) {
      trainErr = "quota SNCF atteint, reprise vers " + hm(new Date(pause).getHours() * 60 + new Date(pause).getMinutes());
      return;
    }
    try {
      const dijon = await stopArea("Dijon Ville", /^dijon( ville)?$/i, /porte|perrigny|longvic/i), creusot = await stopArea("Le Creusot", /^le creusot( ville)?$/i, /TGV|montchanin|montceau/i);
      stations = { dijon, creusot }, ls.set("stations", stations);
      const prev = live && live.days || {}, prevAt = live && live.dayAt || {}, days = {}, dayAt = {};
      let fetched = 0;
      for (const iso of [todayISO(), tomorrowISO()]) {
        if (!force && prev[iso] && prevAt[iso] && Date.now() - prevAt[iso] < trainTTL(iso)) {
          days[iso] = prev[iso], dayAt[iso] = prevAt[iso];
          continue;
        }
        try {
          const both = await Promise.all([journeys(dijon.id, creusot.id, iso), journeys(creusot.id, dijon.id, iso)]);
          days[iso] = { aller: both[0], retour: both[1] }, dayAt[iso] = Date.now(), fetched++;
        } catch (e) {
          if (iso === todayISO() || [401, 403, 429, 0].indexOf(e.status) >= 0) throw e;
          prev[iso] && (days[iso] = prev[iso], dayAt[iso] = prevAt[iso]);
        }
      }
      live = { at: fetched ? Date.now() : live && live.at || Date.now(), dayAt, days }, ls.set("live2", live), ls.set("sncfPause", 0), fetched && note("trains OK");
    } catch (e) {
      e.status === 429 && ls.set("sncfPause", Date.now() + 60 * 6e4), trainErr = e.message, note("trains : " + e.message);
    }
    syncNative();
  }
  const liveDay = (iso) => token && live && live.days && live.days[iso] || null, isLive = (iso) => {
    const L = liveDay(iso || todayISO());
    return !!(L && (L.aller.length || L.retour.length));
  }, trainsFor = (d, iso) => {
    const L = liveDay(iso);
    return L && L[d] && L[d].length ? L[d] : staticTrains(d);
  }, cancelled = (t) => /NO_SERVICE/.test(t.status);
  let voiesOn = ls.get("voiesOn", !0), voies = ls.get("voies", {}), voieAt = 0, voieBusy = !1, voieErr = "";
  const SIRI_URL = "https://proxy.transport.data.gouv.fr/resource/sncf-siri-lite-estimated-timetable", STN = { aller: [/dijon/i, /creusot/i], retour: [/creusot/i, /dijon/i] }, uicOf = (st) => {
    const m = st && String(st.id || "").match(/(\d{8})/);
    return m ? m[1] : "";
  };
  function voieKey(iso, t, end) {
    return iso + "|" + String(t.number || "").replace(/\D/g, "") + "|" + end;
  }
  function voieOf(t, iso, d, end) {
    return (end === "D" ? t.voie : t.voieArr) || voies[voieKey(iso, t, end + d)] || "";
  }
  function findPlatform(feed, no, iso, uic, nameRe, kind) {
    const re = new RegExp('[">\\s:]' + no + '["<\\s:]', "g");
    let m, guard = 0;
    for (; (m = re.exec(feed)) && guard++ < 40; ) {
      let end = feed.indexOf("EstimatedVehicleJourney", m.index + 1);
      (end < 0 || end - m.index > 12e4) && (end = m.index + 12e4);
      const block = feed.slice(m.index, end);
      if (block.indexOf(iso) < 0) continue;
      const calls = block.split(/StopPointRef/);
      for (let i = 1; i < calls.length; i++) {
        const c = calls[i], sn = c.match(/StopPointName"?\s*[:>]\s*(?:\[\s*)?(?:\{\s*"value"\s*:\s*)?"?([^"<]{1,60})/);
        if (!(uic && c.slice(0, 120).indexOf(uic) >= 0 || sn && nameRe.test(sn[1]))) continue;
        const r = new RegExp(kind + 'PlatformName"?\\s*[:>]\\s*(?:\\[\\s*)?(?:\\{\\s*"value"\\s*:\\s*)?"?\\s*([A-Za-z0-9][A-Za-z0-9 -]{0,5})'), v = c.match(r);
        if (v) return v[1].trim();
      }
      re.lastIndex = end;
    }
    return "";
  }
  function voieTargets() {
    const out = [], now = nowMin(), iso = todayISO();
    return isTrainDay(iso) && ["aller", "retour"].forEach((d) => trainsFor(d, iso).forEach((t) => {
      t.number && t.dep >= now - 5 && t.dep <= now + 40 && !cancelled(t) && !(t.voie && t.voieArr) && out.push({ d, t });
    })), out;
  }
  async function loadVoies(force) {
    if (!voiesOn || voieBusy) return;
    const targets = voieTargets();
    if (targets.length && !(!force && Date.now() - voieAt < 4 * 6e4)) {
      voieBusy = !0, voieAt = Date.now();
      try {
        const r = await httpGet(SIRI_URL, "", !1);
        if (r.status !== 200) throw new Error("flux des voies indisponible (" + (r.status || r.body) + ")");
        const iso = todayISO();
        let found = 0;
        targets.forEach((x) => {
          const no = String(x.t.number).replace(/\D/g, "");
          if (!no) return;
          const st = stations ? x.d === "aller" ? [stations.dijon, stations.creusot] : [stations.creusot, stations.dijon] : [null, null], dv = findPlatform(r.body, no, iso, uicOf(st[0]), STN[x.d][0], "Departure"), av = findPlatform(r.body, no, iso, uicOf(st[1]), STN[x.d][1], "Arrival");
          dv && (voies[voieKey(iso, x.t, "D" + x.d)] = dv, found++), av && (voies[voieKey(iso, x.t, "A" + x.d)] = av);
        }), Object.keys(voies).forEach((k) => {
          k.slice(0, 10) < iso && delete voies[k];
        }), ls.set("voies", voies), voieErr = "", note("voies : " + found + " trouv\xE9e(s)");
      } catch (e) {
        voieErr = e.message, note("voies : " + e.message);
      }
      voieBusy = !1;
    }
  }
  function voieChip(t, iso, d) {
    const v = voieOf(t, iso, d, "D");
    return v ? `<span class="chip voie">Voie ${esc(v)}</span>` : "";
  }
  function chipFor(t, iso) {
    return cancelled(t) ? '<span class="chip bad">Supprim\xE9</span>' : t.delay > 0 ? `<span class="chip late">+${t.delay} min</span>` : isLive(iso) ? '<span class="chip ok">\xC0 l\u2019heure</span>' : "";
  }
  function timeHtml(t) {
    return (t.delay > 0 && !cancelled(t) ? `<s>${hm(t.sched)}</s>` : "") + `<span class="t num">${hm(t.delay > 0 ? t.dep : t.sched)}</span>`;
  }
  function syncNative() {
    N && N.setTrainConfig && N.setTrainConfig(JSON.stringify({ token: "", stations: null, favs: [], days: [] }));
  }
  function syncWidget() {
    if (!N || !N.setWidgetData) return;
    const pack = (d2, iso) => trainsFor(d2, iso).map((t) => [t.sched, t.arr, t.delay || 0, cancelled(t) ? 1 : 0]), days = {};
    [todayISO(), tomorrowISO()].forEach((iso) => {
      days[iso] = { plan: isTrainDay(iso), aller: pack("aller", iso), retour: pack("retour", iso) };
    });
    const d = todayW();
    N.setWidgetData(JSON.stringify({ at: Date.now(), weather: weather ? { now: weather.now, sky: sky(weather.code), tmin: d ? d.min : weather.now, tmax: d ? d.max : weather.now, rain: d ? d.rain : 0, date: weather.date } : null, days }));
  }
  function renderClock() {
    const d = /* @__PURE__ */ new Date();
    $("clock").textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()), $("date").textContent = cap(d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }));
  }
  function renderWx() {
    const el = $("c-wx");
    if (!weather) {
      el.innerHTML = '<div class="chead"><span class="label">M\xE9t\xE9o \xB7 Dijon</span></div><p class="hint">' + (wxErr ? "M\xE9t\xE9o indisponible (pas de connexion ?). Nouvel essai dans 5 min." : "Chargement de la m\xE9t\xE9o\u2026") + "</p>";
      return;
    }
    const d = todayW(), tip = advice(), hrs = nextHours(6, 2);
    el.innerHTML = `<div class="chead"><span class="label">M\xE9t\xE9o \xB7 Dijon</span><span class="label">D\xE9tails \u203A</span></div>
    <div class="wxnow">${wxIcon(weather.code, weather.isDay)}<span class="big num">${weather.now}\xB0</span>
      <div><strong>${esc(sky(weather.code))}</strong><span class="muted num">${d ? d.min + "\xB0 / " + d.max + "\xB0" : ""} \xB7 ressenti ${weather.feels}\xB0</span></div></div>
    ${tip ? `<p class="advice">${esc(tip)}</p>` : ""}
    <div class="hours">${hrs.map((h) => `<div><span>${+h.t.slice(11, 13)} h</span>${wxIcon(h.code, h.day)}<b class="num">${h.temp}\xB0</b><span class="rp">${h.rain >= 20 ? h.rain + " %" : ""}</span></div>`).join("")}</div>`;
  }
  $("c-wx").addEventListener("click", () => show("meteo"));
  let homeDir = null, homeDirAt = 0;
  function homePlan() {
    const today = todayISO(), now = nowMin();
    if (isTrainDay(today)) {
      const manual = homeDir && Date.now() - homeDirAt < 18e5;
      let d = manual ? homeDir : now < 13 * 60 ? "aller" : "retour", list = trainsFor(d, today).filter((t) => t.dep >= now - 0.5);
      if (!list.length && !manual && d === "aller" && (d = "retour", list = trainsFor(d, today).filter((t) => t.dep >= now - 0.5)), list.length) return { d, iso: today, list, title: "" };
    }
    for (let k = 1; k <= 7; k++) {
      const iso = addDays(today, k);
      if (isTrainDay(iso)) {
        const d = homeDir && Date.now() - homeDirAt < 18e5 ? homeDir : "aller";
        return { d, iso, list: trainsFor(d, iso), title: k === 1 ? "Demain" : cap(dateOf(iso).toLocaleDateString("fr-FR", { weekday: "long" })) };
      }
    }
    return null;
  }
  let trTab = null, trTabAt = 0;
  function curTab() {
    if (trTab && Date.now() - trTabAt < 30 * 6e4) return trTab;
    const today = todayISO();
    return isTrainDay(today) && trainsFor((/* @__PURE__ */ new Date()).getHours() < 13 ? "aller" : "retour", today).some((t) => t.dep >= nowMin()) ? "train" : "bus";
  }
  function tabsHtml(tab, right) {
    return `<div class="chead"><div class="tabs"><button data-tab="train" class="${tab === "train" ? "on" : ""}">Trains</button><button data-tab="bus" class="${tab === "bus" ? "on" : ""}">Bus</button></div><span class="label">${right}</span></div>`;
  }
  function bindTabs(el) {
    el.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation(), trTab = b.dataset.tab, trTabAt = Date.now(), renderTr(), trTab === "bus" && loadBusRT(!1).then(() => {
        curTab() === "bus" && renderTr();
      });
    }));
  }
  function renderTr() {
    const el = $("c-tr"), tab = curTab();
    if (el.classList.toggle("is-bus", tab === "bus"), tab === "bus") {
      el.onclick = null, renderBus(el, tabsHtml("bus", "Divia")), bindTabs(el);
      return;
    }
    renderTrainCard(el), bindTabs(el);
  }
  function renderTrainCard(el) {
    const p = homePlan();
    if (!p) {
      el.innerHTML = tabsHtml("train", "") + '<p class="hint">Aucun jour au Creusot cette semaine.</p>';
      return;
    }
    const row = (t, i, iso, d) => `<div class="trow${i === 0 ? " first" : ""}">${timeHtml(t)}<span class="a num">\u2192 ${hm(t.arr)}</span>${voieChip(t, iso, d || p.d)}${chipFor(t, iso)}</div>`, shown = p.list.slice(0, 3);
    let rows = shown.map((t, i) => row(t, i, p.iso)).join("");
    if (p.iso === todayISO() && shown.length < 3)
      for (let k = 1; k <= 7; k++) {
        const iso = addDays(todayISO(), k);
        if (!isTrainDay(iso)) continue;
        const nd = "aller", more = trainsFor(nd, iso).slice(0, 3 - shown.length);
        rows += `<div class="tsep">${k === 1 ? "Demain" : cap(dateOf(iso).toLocaleDateString("fr-FR", { weekday: "long" }))} \xB7 ${NAMES[nd][0]} \u2192 ${NAMES[nd][1]}</div>` + more.map((t) => row(t, 1, iso, nd)).join("");
        break;
      }
    const src = isLive(p.iso) ? "Temps r\xE9el SNCF" : token && trainErr ? "Indicatif \xB7 " + trainErr : "Horaires indicatifs";
    el.innerHTML = tabsHtml("train", (p.title ? esc(p.title) + " \xB7 " : "") + "Tous \u203A") + `
    <div class="route">${NAMES[p.d][0]} \u2192 ${NAMES[p.d][1]} <button class="sw" id="tr-swap" aria-label="Changer de sens">\u21C4</button></div>
    <div class="trows">${rows}</div>
    <div class="tfoot"><span>${esc(src)}</span><span class="num">${p.list[0] ? Math.round(p.list[0].dur || 53) + " min" : ""}</span></div>`, $("tr-swap").addEventListener("click", (e) => {
      e.stopPropagation(), homeDir = p.d === "aller" ? "retour" : "aller", homeDirAt = Date.now(), renderTr();
    }), el.onclick = () => {
      pDir = p.d, pDay = p.iso === todayISO() ? "today" : "tomorrow", show("trains");
    };
  }
  const BUS_CFG = [
    { stop: "Perri\xE8res", line: "10", to: /ahuy|darcy/i, label: "Ahuy" },
    { stop: "Perri\xE8res", line: "12", to: /colombi/i, label: "Colombi\xE8re" },
    { stop: "Albert 1er", line: "L3", to: /capnord|epirey/i, label: "\xC9pirey" },
    { stop: "Albert 1er", line: "13", to: /fontaine/i, label: "Fontaine" }
  ], GTFS_URL = "https://www.data.gouv.fr/api/1/datasets/r/e0dbd217-15cd-4e28-9459-211a27511a34", GTFSRT_URL = "https://proxy.transport.data.gouv.fr/resource/divia-dijon-gtfs-rt-trip-update";
  let busIdx = ls.get("divia1", null), busRT = null, busRTAt = 0, busErr = "", busBuilding = !1;
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  async function unzipEntries(buf, wanted) {
    const u = new Uint8Array(buf), dv = new DataView(buf);
    let e = u.length - 22;
    for (; e > 0 && dv.getUint32(e, !0) !== 101010256; ) e--;
    const n = dv.getUint16(e + 10, !0);
    let p = dv.getUint32(e + 16, !0);
    const out = {};
    for (let i = 0; i < n; i++) {
      const method = dv.getUint16(p + 10, !0), csize = dv.getUint32(p + 20, !0), off = dv.getUint32(p + 42, !0), nl = dv.getUint16(p + 28, !0), el = dv.getUint16(p + 30, !0), cl = dv.getUint16(p + 32, !0), name = new TextDecoder().decode(u.subarray(p + 46, p + 46 + nl)).replace(/^.*\//, "");
      if (p += 46 + nl + el + cl, wanted.indexOf(name) < 0) continue;
      const ln = dv.getUint16(off + 26, !0), le = dv.getUint16(off + 28, !0), data = u.subarray(off + 30 + ln + le, off + 30 + ln + le + csize);
      method === 0 ? out[name] = new TextDecoder().decode(data) : out[name] = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
    }
    return out;
  }
  function csvRows(text, keep) {
    const lines = text.replace(/^﻿/, "").split(/\r?\n/), h = lines[0].split(",").map((x) => x.trim().replace(/^"|"$/g, "")), out = [];
    for (let i = 1; i < lines.length; i++) {
      const l = lines[i];
      if (!l) continue;
      const v = l.indexOf('"') < 0 ? l.split(",") : (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || []).map((x) => x.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"')), o = {};
      h.forEach((k, j) => {
        o[k] = v[j];
      }), (!keep || keep(o)) && out.push(o);
    }
    return out;
  }
  const hms = (t) => {
    const a = String(t).split(":");
    return +a[0] * 3600 + +a[1] * 60 + (+a[2] || 0);
  };
  async function buildBusIndex() {
    if (!busBuilding) {
      if (typeof DecompressionStream > "u") {
        busErr = "horaires th\xE9oriques indisponibles sur cet appareil (temps r\xE9el seul)";
        return;
      }
      busBuilding = !0;
      try {
        const r = await fetch(GTFS_URL);
        if (!r.ok) throw new Error("horaires Divia indisponibles (" + r.status + ")");
        const f = await unzipEntries(await r.arrayBuffer(), ["routes.txt", "stops.txt", "trips.txt", "calendar.txt", "calendar_dates.txt", "stop_times.txt"]), routes = csvRows(f["routes.txt"]), stopNames = {};
        BUS_CFG.forEach((c) => {
          stopNames[norm(c.stop)] = 1;
        });
        const stops = csvRows(f["stops.txt"], (s) => stopNames[norm(s.stop_name)]), lines = BUS_CFG.map((c) => {
          const rt = routes.find((x) => norm(x.route_short_name) === norm(c.line));
          return {
            c,
            route: rt ? rt.route_id : null,
            color: rt && rt.route_color ? "#" + rt.route_color : "#888",
            text: rt && rt.route_text_color ? "#" + rt.route_text_color : "#fff",
            stops: stops.filter((s) => norm(s.stop_name) === norm(c.stop)).map((s) => s.stop_id),
            deps: []
          };
        }), routeSet = {};
        lines.forEach((l) => {
          l.route && (routeSet[l.route] = 1);
        });
        const trips = {};
        csvRows(f["trips.txt"], (t) => routeSet[t.route_id]).forEach((t) => {
          trips[t.trip_id] = t;
        }), lines.forEach((l) => {
          const score = {};
          Object.keys(trips).forEach((id) => {
            const t = trips[id];
            t.route_id === l.route && l.c.to.test(t.trip_headsign || "") && (score[t.direction_id] = (score[t.direction_id] || 0) + 1);
          }), l.dir = Object.keys(score).sort((a, b) => score[b] - score[a])[0];
        });
        const st = f["stop_times.txt"];
        f["stop_times.txt"] = null;
        const hdr = st.slice(0, st.indexOf(`
`)).replace(/\r|﻿/g, "").split(",").map((x) => x.trim()), iT = hdr.indexOf("trip_id"), iD = hdr.indexOf("departure_time"), iA = hdr.indexOf("arrival_time"), iS = hdr.indexOf("stop_id"), iQ = hdr.indexOf("stop_sequence"), heads = [], services = {}, allStops = {};
        lines.forEach((l) => l.stops.forEach((s) => {
          allStops[s] = 1;
        })), Object.keys(allStops).forEach((sid) => {
          const pat = "," + sid + ",";
          let k = st.indexOf(pat);
          for (; k >= 0; ) {
            const a = st.lastIndexOf(`
`, k) + 1, b = st.indexOf(`
`, k), v = st.slice(a, b < 0 ? void 0 : b).replace(/\r$/, "").split(",");
            if (v[iS] === sid) {
              const t = trips[v[iT]];
              t && lines.forEach((l) => {
                if (t.route_id !== l.route || t.direction_id !== l.dir || l.stops.indexOf(sid) < 0) return;
                let hi = heads.indexOf(t.trip_headsign);
                hi < 0 && (heads.push(t.trip_headsign), hi = heads.length - 1), services[t.service_id] = 1, l.deps.push([hms(v[iD] || v[iA]), t.service_id, hi, t.trip_id, +v[iQ], sid]);
              });
            }
            k = st.indexOf(pat, k + 1);
          }
        }), lines.forEach((l) => l.deps.sort((x, y) => x[0] - y[0]));
        const cal = csvRows(f["calendar.txt"] || `service_id
`, (c) => services[c.service_id]).map((c) => [c.service_id, c.start_date, c.end_date, [c.sunday, c.monday, c.tuesday, c.wednesday, c.thursday, c.friday, c.saturday].map(Number).join("")]), cd = {};
        csvRows(f["calendar_dates.txt"] || `service_id
`, (c) => services[c.service_id]).forEach((c) => {
          (cd[c.date] = cd[c.date] || {})[c.service_id] = +c.exception_type;
        });
        let until = "";
        cal.forEach((c) => {
          c[2] > until && (until = c[2]);
        }), Object.keys(cd).forEach((d) => {
          Object.keys(cd[d]).some((s) => cd[d][s] === 1) && d > until && (until = d);
        }), busIdx = { at: Date.now(), until, heads, cal, cd, lines: lines.map((l) => ({ line: l.c.line, stop: l.c.stop, label: l.c.label, color: l.color, text: l.text, deps: l.deps })) }, ls.set("divia1", busIdx), busErr = "", note("bus : horaires Divia \xE0 jour (" + lines.map((l) => l.c.line + ":" + l.deps.length).join(" ") + ")");
      } catch (e) {
        busErr = e.message || String(e), note("bus : " + busErr);
      }
      busBuilding = !1;
    }
  }
  function activeServices(iso) {
    const ymd = iso.replace(/-/g, ""), wd = dateOf(iso).getDay(), on = {};
    (busIdx.cal || []).forEach((c) => {
      ymd >= c[1] && ymd <= c[2] && c[3].charAt(wd) === "1" && (on[c[0]] = 1);
    });
    const ex = (busIdx.cd || {})[ymd] || {};
    return Object.keys(ex).forEach((s) => {
      ex[s] === 1 ? on[s] = 1 : delete on[s];
    }), on;
  }
  function decodeTripUpdates(buf) {
    const u = new Uint8Array(buf);
    function vint(s) {
      let lo = 0, hi = 0, shift = 0, b;
      do
        b = u[s.p++], shift < 28 ? lo += (b & 127) * Math.pow(2, shift) : shift === 28 ? (lo += (b & 15) * Math.pow(2, 28), hi += b >> 4 & 7) : hi += (b & 127) * Math.pow(2, shift - 32), shift += 7;
      while (b & 128);
      return hi >= 2147483648 ? lo - 4294967296 + (hi - 4294967295) * 4294967296 : lo + hi * 4294967296;
    }
    function msg(a, b) {
      const s = { p: a }, o = {};
      for (; s.p < b; ) {
        const k = vint(s), fno = Math.floor(k / 8), w = k & 7;
        let v;
        if (w === 0) v = vint(s);
        else if (w === 2) {
          const l = vint(s);
          v = [s.p, s.p + l], s.p += l;
        } else if (w === 1) {
          s.p += 8;
          continue;
        } else if (w === 5) {
          s.p += 4;
          continue;
        } else break;
        (o[fno] = o[fno] || []).push(v);
      }
      return o;
    }
    const str = (r) => new TextDecoder().decode(u.subarray(r[0], r[1])), sub = (o, f) => o[f] ? msg(o[f][0][0], o[f][0][1]) : null, top = msg(0, u.length), trips = {};
    return (top[2] || []).forEach((r) => {
      const ent = msg(r[0], r[1]), tu = sub(ent, 3);
      if (!tu) return;
      const td = sub(tu, 1);
      if (!td || !td[1]) return;
      const id = str(td[1][0]), rel = td[4] ? td[4][0] : 0, stus = (tu[2] || []).map((x) => {
        const s = msg(x[0], x[1]), a = sub(s, 2), ev = sub(s, 3) || a;
        return { seq: s[1] ? s[1][0] : null, stop: s[4] ? str(s[4][0]) : "", time: ev && ev[2] ? ev[2][0] : null, delay: ev && ev[1] ? ev[1][0] : null, skip: s[5] ? s[5][0] === 1 : !1 };
      });
      trips[id] = { cancelled: rel === 3, stus };
    }), trips;
  }
  async function loadBusRT(force) {
    if (!(!force && Date.now() - busRTAt < 5e4)) {
      busRTAt = Date.now();
      try {
        const r = await fetch(GTFSRT_URL, { cache: "no-store" });
        if (!r.ok) throw new Error("temps r\xE9el Divia indisponible (" + r.status + ")");
        busRT = { at: Date.now(), trips: decodeTripUpdates(await r.arrayBuffer()) };
      } catch (e) {
        note("bus RT : " + (e.message || e)), busRT && Date.now() - busRT.at > 10 * 6e4 && (busRT = null);
      }
    }
  }
  function busNext(l, n) {
    const now = /* @__PURE__ */ new Date(), nowS = Math.floor(now.getTime() / 1e3);
    new Date(now).setHours(0, 0, 0, 0);
    const out = [], seen = {}, RT = busRT ? busRT.trips : {};
    return [-1, 0, 1].forEach((k) => {
      const iso = addDays(todayISO(), k), on = activeServices(iso), base = new Date(dateOf(iso));
      base.setHours(0, 0, 0, 0);
      const b0 = Math.floor(base.getTime() / 1e3);
      l.deps.forEach((d) => {
        if (!on[d[1]]) return;
        let t = b0 + d[0], live2 = !1;
        const rt = RT[d[3]];
        if (rt) {
          if (rt.cancelled) return;
          const at = rt.stus.find((s) => s.stop === d[5] || s.seq != null && s.seq === d[4]);
          if (at) {
            if (at.skip) return;
            at.time ? t = at.time : at.delay != null && (t += at.delay), live2 = !0;
          } else if (rt.stus.length && t < nowS + 120) return;
        }
        t < nowS - 30 || t > nowS + 14 * 3600 || seen[d[3]] || (seen[d[3]] = 1, out.push({ t, live: live2, head: busIdx.heads[d[2]], sched: b0 + d[0] }));
      });
    }), out.sort((a, b) => a.t - b.t).slice(0, n);
  }
  function busWhen(p) {
    const m = Math.round((p.t * 1e3 - Date.now()) / 6e4);
    if (m <= 0) return "<b>\xE0 l\u2019arr\xEAt</b>";
    if (m < 60) return `<b class="num">${m}</b> min`;
    const d = new Date(p.t * 1e3);
    return `<b class="num">${pad(d.getHours())}:${pad(d.getMinutes())}</b>`;
  }
  function renderBus(el, head) {
    if (!busIdx) {
      el.innerHTML = head + `<p class="hint">${busBuilding ? "Chargement des horaires Divia\u2026" : busErr ? esc(busErr) : "Horaires Divia en attente\u2026"}</p>`;
      return;
    }
    const groups = {};
    busIdx.lines.forEach((l) => {
      (groups[l.stop] = groups[l.stop] || []).push(l);
    });
    const html = Object.keys(groups).map((stop) => `<div class="tsep">${esc(stop)}</div>` + groups[stop].map((l) => {
      const next = busNext(l, 2);
      return `<div class="brow"><span class="bline" style="background:${l.color};color:${l.text}">${esc(l.line)}</span>
      <span class="bdest">\u2192 ${esc(l.label)}</span>
      <span class="btimes">${next.length ? next.map((p, i) => `<span class="${p.live ? "live" : ""}${i ? " later" : ""}" title="${esc(p.head)}">${busWhen(p)}</span>`).join("") : '<span class="later">plus de bus</span>'}</span></div>`;
    }).join("")).join(""), rtOk = busRT && Date.now() - busRT.at < 3 * 6e4;
    el.innerHTML = head + `<div class="bus">${html}</div>
    <div class="tfoot"><span>${rtOk ? '<i class="dot"></i>Temps r\xE9el Divia' : "Horaires th\xE9oriques Divia"}</span><span>${busIdx.until && busIdx.until < todayISO().replace(/-/g, "") ? "horaires \xE0 mettre \xE0 jour" : ""}</span></div>`;
  }
  async function refreshBus(force) {
    (!busIdx || Date.now() - busIdx.at > 6048e5 || busIdx.until && busIdx.until < todayISO().replace(/-/g, "") || force === "index") && await buildBusIndex(), await loadBusRT(force === !0);
  }
  const saveShop = () => {
    ls.set("shop", shop), ls.set("shopHist", shopHist);
  };
  function renderShop() {
    const ul = $("shop-list"), sorted = shop.filter((i) => !i.done).concat(shop.filter((i) => i.done));
    ul.innerHTML = sorted.length ? sorted.map((i) => `<li class="${i.done ? "done" : ""}" data-id="${i.id}"><span class="box"></span><span>${esc(i.text)}</span><button class="x" aria-label="Retirer">\xD7</button></li>`).join("") : '<li class="empty">Liste vide. Ajoute un article ci-dessus.</li>', ul.querySelectorAll("li[data-id]").forEach((li) => {
      const it = shop.find((i) => i.id === li.dataset.id);
      li.addEventListener("click", () => {
        it.done = !it.done, saveShop(), renderShop();
      }), li.querySelector(".x").addEventListener("click", (e) => {
        e.stopPropagation(), shop = shop.filter((i) => i !== it), saveShop(), renderShop();
      });
    }), $("shop-clear").hidden = !shop.some((i) => i.done);
    const inList = {};
    shop.forEach((i) => {
      inList[i.text.toLowerCase()] = 1;
    });
    const sugg = Object.keys(shopHist).filter((k) => !inList[k]).sort((a, b) => shopHist[b] - shopHist[a]).slice(0, 6);
    $("shop-chips").innerHTML = sugg.map((k) => `<button data-k="${esc(k)}">+ ${esc(k)}</button>`).join(""), $("shop-chips").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => addShop(b.dataset.k)));
  }
  function addShop(text) {
    if (text = String(text || "").trim().replace(/\s+/g, " "), !text) return;
    const k = text.toLowerCase(), ex = shop.find((i) => i.text.toLowerCase() === k);
    ex ? ex.done = !1 : shop.unshift({ id: uid(), text, done: !1 }), shopHist[k] = (shopHist[k] || 0) + 1;
    const keys = Object.keys(shopHist);
    keys.length > 60 && keys.sort((a, b) => shopHist[a] - shopHist[b]).slice(0, keys.length - 60).forEach((x) => {
      delete shopHist[x];
    }), saveShop(), renderShop();
  }
  $("shop-form").addEventListener("submit", (e) => {
    e.preventDefault(), addShop($("shop-in").value), $("shop-in").value = "";
  });
  $("shop-clear").addEventListener("click", () => {
    shop = shop.filter((i) => !i.done), saveShop(), renderShop();
  });
  const memo = function() {
    let data = ls.get("memo5", null);
    data || (data = { strokes: [] });
    let color = ls.get("memoColor", "#ffffff"), width = ls.get("memoWidth", 4.2), erasing = !1, cur = null, confirmT = null;
    const cv = $("memo-cv"), wrap = $("memo-wrap");
    let ctx = null, W = 0, H = 0, dpr = 1;
    const lw = (s) => (s.e ? 30 : s.w || 4.2) * Math.max(0.7, Math.min(1.6, W / 820)), pager = $("pager");
    function lockPage(on) {
      if (pager.classList.toggle("drawing", on), !on) {
        const left = PAGES.indexOf(view) * pager.clientWidth;
        Math.abs(pager.scrollLeft - left) > 1 && (pager.scrollLeft = left), window.scrollTo(0, 0);
      }
    }
    const stop = (e) => {
      e.cancelable && e.preventDefault();
    };
    ["touchstart", "touchmove"].forEach((t) => cv.addEventListener(t, stop, { passive: !1 })), $("c-memo").addEventListener("touchmove", stop, { passive: !1 });
    function style(s) {
      ctx.globalCompositeOperation = s.e ? "destination-out" : "source-over", ctx.strokeStyle = s.e ? "#000" : s.c, ctx.fillStyle = ctx.strokeStyle, ctx.lineWidth = lw(s);
    }
    function seg(s, a, b) {
      ctx.beginPath(), ctx.moveTo(a[0] * W, a[1] * W), ctx.lineTo(b[0] * W, b[1] * W), ctx.stroke();
    }
    function dot(s, a) {
      ctx.beginPath(), ctx.arc(a[0] * W, a[1] * W, lw(s) / 2, 0, Math.PI * 2), ctx.fill();
    }
    function redraw() {
      ctx && (ctx.setTransform(dpr, 0, 0, dpr, 0, 0), ctx.clearRect(0, 0, W, H), ctx.lineCap = "round", ctx.lineJoin = "round", data.strokes.forEach((s) => {
        if (style(s), s.p.length === 1) dot(s, s.p[0]);
        else {
          ctx.beginPath(), ctx.moveTo(s.p[0][0] * W, s.p[0][1] * W);
          for (let i = 1; i < s.p.length; i++) ctx.lineTo(s.p[i][0] * W, s.p[i][1] * W);
          ctx.stroke();
        }
      }), ctx.globalCompositeOperation = "source-over", $("memo-ph").hidden = data.strokes.some((s) => !s.e));
    }
    function fit() {
      const r = wrap.getBoundingClientRect();
      W = r.width || 600, H = r.height || 200, dpr = Math.min(2, window.devicePixelRatio || 1), cv.width = Math.round(W * dpr), cv.height = Math.round(H * dpr), ctx = cv.getContext && cv.getContext("2d"), redraw();
    }
    const save = () => ls.set("memo5", data), pos = (e) => {
      const r = cv.getBoundingClientRect(), w = r.width || 1;
      return [Math.round((e.clientX - r.left) / w * 1e4) / 1e4, Math.round((e.clientY - r.top) / w * 1e4) / 1e4];
    };
    cv.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      try {
        cv.setPointerCapture(e.pointerId);
      } catch (err) {
      }
      lockPage(!0), cur = erasing ? { e: 1, p: [pos(e)] } : { c: color, w: width, p: [pos(e)] }, data.strokes.push(cur), ctx && (ctx.setTransform(dpr, 0, 0, dpr, 0, 0), ctx.lineCap = "round", style(cur), dot(cur, cur.p[0]), ctx.globalCompositeOperation = "source-over"), erasing || ($("memo-ph").hidden = !0);
    }), cv.addEventListener("pointermove", (e) => {
      if (!cur) return;
      const q = pos(e), last = cur.p[cur.p.length - 1];
      Math.abs(q[0] - last[0]) + Math.abs(q[1] - last[1]) < 15e-4 || (cur.p.push(q), ctx && (ctx.setTransform(dpr, 0, 0, dpr, 0, 0), ctx.lineCap = "round", style(cur), seg(cur, last, q), ctx.globalCompositeOperation = "source-over"));
    });
    const end = () => {
      lockPage(!1), cur && (cur = null, data.strokes.length > 600 && (data.strokes = data.strokes.slice(-600)), save());
    };
    cv.addEventListener("pointerup", end), cv.addEventListener("pointercancel", end);
    const pick = $("memo-pick"), custom = document.querySelector("#c-memo .pen.custom");
    function tools() {
      let preset = !1;
      document.querySelectorAll("#c-memo .pen[data-c]").forEach((b) => {
        const on = !erasing && b.dataset.c === color;
        on && (preset = !0), b.classList.toggle("on", on);
      }), custom.classList.toggle("on", !erasing && !preset), custom.style.setProperty("--c", color), document.querySelectorAll("#c-memo .size").forEach((b) => b.classList.toggle("on", +b.dataset.w === width)), $("memo-erase").classList.toggle("on", erasing), ls.set("memoColor", color), ls.set("memoWidth", width);
    }
    document.querySelectorAll("#c-memo .pen[data-c]").forEach((b) => b.addEventListener("click", () => {
      color = b.dataset.c, erasing = !1, tools();
    }));
    const onPick = () => {
      color = pick.value, erasing = !1, tools();
    };
    return pick.addEventListener("input", onPick), pick.addEventListener("change", onPick), document.querySelectorAll("#c-memo .size").forEach((b) => b.addEventListener("click", () => {
      width = +b.dataset.w, erasing = !1, tools();
    })), tools(), $("memo-erase").addEventListener("click", () => {
      erasing = !erasing, tools();
    }), $("memo-undo").addEventListener("click", () => {
      data.strokes.pop(), save(), redraw();
    }), $("memo-clear").addEventListener("click", () => {
      const b = $("memo-clear");
      if (!b.classList.contains("warn")) {
        b.classList.add("warn"), b.textContent = "Tout effacer ?", clearTimeout(confirmT), confirmT = setTimeout(() => {
          b.classList.remove("warn"), b.textContent = "Effacer";
        }, 3e3);
        return;
      }
      clearTimeout(confirmT), b.classList.remove("warn"), b.textContent = "Effacer", data.strokes = [], save(), redraw();
    }), window.ResizeObserver ? new ResizeObserver(() => fit()).observe(wrap) : window.addEventListener("resize", fit), setTimeout(fit, 0), { fit, redraw, get data() {
      return data;
    }, addStroke(s) {
      data.strokes.push(s), save(), redraw();
    } };
  }();
  ["gesturestart", "gesturechange"].forEach((t) => document.addEventListener(t, (e) => e.preventDefault(), { passive: !1 }));
  function renderMeteoPage() {
    const el = $("meteo-body");
    if (!weather) {
      el.innerHTML = '<div class="card wide"><p class="hint">M\xE9t\xE9o indisponible pour l\u2019instant.</p></div>';
      return;
    }
    const d = todayW(), hrs = nextHours(24, 1), days = weather.days.slice(0, 6), lo = Math.min.apply(null, days.map((x) => x.min)), hi = Math.max.apply(null, days.map((x) => x.max)), span = Math.max(1, hi - lo), t = (s) => s ? s.slice(11, 16) : "\u2013";
    el.innerHTML = `<div class="card wide"><div class="wxnow">${wxIcon(weather.code, weather.isDay)}<span class="big num">${weather.now}\xB0</span>
      <div><strong>${esc(sky(weather.code))}</strong><span class="muted num">${d ? "Min " + d.min + "\xB0 \xB7 Max " + d.max + "\xB0" : ""}</span></div></div>
      ${advice() ? `<p class="advice">${esc(advice())}</p>` : ""}
      <div class="stats" style="margin-top:14px">
        <div><span class="label">Ressenti</span><b class="num">${weather.feels}\xB0</b></div>
        <div><span class="label">Vent</span><b class="num">${weather.wind} km/h</b><span class="muted">rafales ${weather.gusts}</span></div>
        <div><span class="label">Humidit\xE9</span><b class="num">${weather.humidity} %</b></div>
        <div><span class="label">Lever</span><b class="num">${t(d && d.sunrise)}</b></div>
        <div><span class="label">Coucher</span><b class="num">${t(d && d.sunset)}</b></div>
        <div><span class="label">UV max</span><b class="num">${d && d.uv != null ? Math.round(d.uv) : "\u2013"}</b></div>
      </div></div>
    <div class="card wide"><div class="chead"><span class="label">Prochaines 24 h</span></div>
      <div class="hstrip">${hrs.map((h, i) => `<div class="${i === 0 ? "now" : ""}"><span>${i === 0 ? "Maint." : +h.t.slice(11, 13) + " h"}</span>${wxIcon(h.code, h.day)}<b class="num">${h.temp}\xB0</b><span class="rp">${h.rain >= 20 ? h.rain + " %" : ""}</span></div>`).join("")}</div></div>
    <div class="card wide"><div class="chead"><span class="label">Prochains jours</span></div>
      ${days.map((x, i) => `<div class="drow"><span>${i === 0 ? "Aujourd\u2019hui" : cap(dateOf(x.t).toLocaleDateString("fr-FR", { weekday: "long" }))}</span>${wxIcon(x.code, 1)}
        <div class="bar"><i style="left:${(x.min - lo) / span * 100}%;right:${100 - (x.max - lo) / span * 100}%"></i></div>
        <span class="num">${x.min}\xB0 / <b>${x.max}\xB0</b>${x.rain >= 30 ? ` <span class="muted">\xB7 ${x.rain} %</span>` : ""}</span></div>`).join("")}</div>`;
  }
  let pDir = (/* @__PURE__ */ new Date()).getHours() < 13 ? "aller" : "retour", pDay = "today", openTrain = null;
  function renderTrainsPage() {
    const iso = pDay === "today" ? todayISO() : tomorrowISO();
    document.querySelectorAll("#tr-dir button").forEach((b) => b.classList.toggle("on", b.dataset.d === pDir)), document.querySelectorAll("#tr-day button").forEach((b) => b.classList.toggle("on", b.dataset.day === pDay));
    const now = nowMin(), list = trainsFor(pDir, iso), firstNext = pDay === "today" ? list.findIndex((t) => t.dep >= now) : 0;
    $("tr-all").innerHTML = (isTrainDay(iso) ? "" : `<p class="hint" style="margin:0 0 8px">${pDay === "today" ? "Aujourd\u2019hui" : "Demain"} est un jour \xE0 Dijon dans ton planning.</p>`) + list.map((t, i) => {
      const k = pDir + t.sched, gone = pDay === "today" && t.dep < now, vd = voieOf(t, iso, pDir, "D"), va = voieOf(t, iso, pDir, "A"), vtxt = vd || va ? " \xB7 " + (vd ? "d\xE9part voie " + esc(vd) : "") + (vd && va ? ", " : "") + (va ? "arriv\xE9e voie " + esc(va) : "") : pDay === "today" && t.dep - now <= 40 && t.dep >= now ? " \xB7 voie pas encore annonc\xE9e (affich\xE9e environ 20 min avant)" : "", more = openTrain === k ? `<div class="more">TER ${esc(t.number || "")} \xB7 ${Math.round(t.dur || t.arr - t.sched)} min${vtxt}
        ${t.stops && t.stops.length ? `<ol>${t.stops.map((s) => `<li><span class="num">${s.t != null ? hm(s.t) : ""}</span> ${esc(s.name)}</li>`).join("")}</ol>` : "<div>Arr\xEAts disponibles avec la cl\xE9 SNCF.</div>"}
        ${(t.messages || []).map((m) => `<div class="msg">${esc(m)}</div>`).join("")}</div>` : "";
      return `<div class="trow${i === firstNext ? " first" : ""}${gone ? " gone" : ""}" data-k="${k}">${timeHtml(t)}<span class="a num">\u2192 ${hm(t.arr)}</span>${voieChip(t, iso, pDir)}${chipFor(t, iso)}${more}</div>`;
    }).join(""), $("tr-all").querySelectorAll(".trow").forEach((r) => r.addEventListener("click", () => {
      openTrain = openTrain === r.dataset.k ? null : r.dataset.k, renderTrainsPage();
    })), $("tr-src").textContent = isLive(iso) ? "Temps r\xE9el SNCF, mis \xE0 jour \xE0 " + new Date(live.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) + "." : token ? "Horaires indicatifs" + (trainErr ? " (" + trainErr + ")" : "") + "." : "Horaires indicatifs. Ajoute ta cl\xE9 SNCF dans les r\xE9glages pour le temps r\xE9el.";
  }
  document.querySelectorAll("#tr-dir button").forEach((b) => b.addEventListener("click", () => {
    pDir = b.dataset.d, openTrain = null, renderTrainsPage();
  }));
  document.querySelectorAll("#tr-day button").forEach((b) => b.addEventListener("click", () => {
    pDay = b.dataset.day, openTrain = null, renderTrainsPage();
  }));
  $("tr-refresh").addEventListener("click", () => refresh(!0));
  const docEl = document.documentElement, fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null, fsAvail = !!(docEl.requestFullscreen || docEl.webkitRequestFullscreen), standalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === !0;
  function syncFs() {
    docEl.classList.toggle("fs", !!fsEl() || standalone);
  }
  $("fs-btn").hidden = !!N || standalone;
  $("fs-btn").addEventListener("click", () => {
    if (fsEl()) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      return;
    }
    if (fsAvail) {
      const p = (docEl.requestFullscreen || docEl.webkitRequestFullscreen).call(docEl);
      p && p.catch && p.catch(() => toast("Plein \xE9cran refus\xE9 : ajoute la page \xE0 l\u2019\xE9cran d\u2019accueil."));
    } else toast("Sur iPad : Partager \u2192 \xAB Sur l\u2019\xE9cran d\u2019accueil \xBB, puis ouvre l\u2019app depuis l\u2019ic\xF4ne.");
  });
  document.addEventListener("fullscreenchange", syncFs);
  document.addEventListener("webkitfullscreenchange", syncFs);
  syncFs();
  function renderSettings() {
    $("token").value = token, $("bus-status").textContent = busBuilding ? "T\xE9l\xE9chargement\u2026" : busIdx ? "Horaires du " + new Date(busIdx.at).toLocaleDateString("fr-FR") + (busRT ? ", temps r\xE9el actif." : ".") : busErr || "Pas encore charg\xE9s.", $("token-status").textContent = token ? isLive() ? "Cl\xE9 valide, temps r\xE9el actif." : trainErr || "Cl\xE9 enregistr\xE9e." : "Aucune cl\xE9 : horaires indicatifs.", $("plan-days").innerHTML = [1, 2, 3, 4, 5, 6, 0].map((i) => `<button data-i="${i}" class="${planning.pattern[i] ? "on" : ""}">${WD[i]}</button>`).join(""), $("plan-days").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      planning.pattern[+b.dataset.i] = !planning.pattern[+b.dataset.i], ls.set("planning", planning), renderSettings(), renderHome();
    })), $("anim-on").checked = !!animOn, $("voies-on").checked = !!voiesOn, $("fx-preview").value = fxPreview, readWall(), renderWallSettings(), $("setup-url").value || ($("setup-url").value = ls.get("webUrl", "") || (N ? "" : location.origin + location.pathname)), renderDiag();
  }
  function renderDiag() {
    $("diag").textContent = [
      "Version " + VERSION + (N ? " (Android)" : " (web)"),
      "M\xE9t\xE9o : " + (weather ? "OK " + new Date(weather.at).toLocaleTimeString("fr-FR") : "\u2014"),
      "Trains : " + (isLive() ? "temps r\xE9el" : token ? "indicatifs" + (trainErr ? " \u2014 " + trainErr : "") : "sans cl\xE9"),
      "Voies : " + (voiesOn ? voieErr || (voieAt ? "flux lu \xE0 " + new Date(voieAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "en attente d\u2019un train dans les 40 min") : "d\xE9sactiv\xE9es"),
      "Bus : " + (busIdx ? "horaires du " + new Date(busIdx.at).toLocaleDateString("fr-FR") + " (valables jusqu\u2019au " + (busIdx.until || "?").replace(/(\d{4})(\d{2})(\d{2})/, "$3/$2") + ")" : busErr || "\u2014") + (busRT ? " \xB7 temps r\xE9el " + new Date(busRT.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : ""),
      "Fond : " + fx.describe(),
      ""
    ].concat(log).join(`
`);
  }
  $("open-settings").addEventListener("click", () => {
    renderSettings(), $("settings").hidden = !1;
  });
  $("close-settings").addEventListener("click", () => {
    $("settings").hidden = !0;
  });
  $("settings").addEventListener("click", (e) => {
    e.target === $("settings") && ($("settings").hidden = !0);
  });
  $("save-token").addEventListener("click", async () => {
    if (token = $("token").value.replace(/[^A-Za-z0-9-]/g, ""), $("token").value = token, ls.set("token", token), ls.set("sncfPause", 0), !token) {
      renderSettings(), renderHome();
      return;
    }
    $("token-status").textContent = "Test de la cl\xE9\u2026", await loadTrains(!0), $("token-status").textContent = isLive() ? "Cl\xE9 valide, temps r\xE9el actif." : trainErr ? "\xC9chec : " + trainErr : "Cl\xE9 valide (aucun direct trouv\xE9 aujourd\u2019hui).", renderHome();
  });
  $("bus-update").addEventListener("click", async () => {
    $("bus-status").textContent = "T\xE9l\xE9chargement des horaires Divia\u2026", await buildBusIndex(), await loadBusRT(!0), $("bus-status").textContent = busIdx && !busErr ? "Horaires \xE0 jour." : "\xC9chec : " + busErr, renderTr(), renderDiag();
  });
  $("voies-on").addEventListener("change", () => {
    voiesOn = $("voies-on").checked, ls.set("voiesOn", voiesOn), voiesOn ? loadVoies(!0).then(renderAll) : renderAll();
  });
  $("anim-on").addEventListener("change", () => {
    animOn = $("anim-on").checked, ls.set("animOn", animOn), applyAnim();
  });
  $("fx-preview").addEventListener("change", () => {
    fxPreview = $("fx-preview").value, fx.update(), renderDiag();
  });
  function applyAnim() {
    docEl.classList.toggle("noanim", !animOn), fx.update();
  }
  $("setup-make").addEventListener("click", () => {
    const base = ($("setup-url").value || "").trim();
    if (!/^https:\/\/.+/.test(base)) {
      $("setup-out").textContent = "Indique d\u2019abord l\u2019adresse https de ton site.";
      return;
    }
    ls.set("webUrl", base);
    const data = {};
    SETUP_KEYS.filter((k) => k !== "lists").forEach((k) => {
      const v = ls.get(k, void 0);
      v !== void 0 && (data[k] = v);
    });
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(data)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""), link = base.replace(/#.*$/, "") + "#setup=" + b64;
    $("setup-out").textContent = link, $("setup-copy").hidden = !1, $("setup-copy").onclick = () => {
      const done = () => toast("Lien copi\xE9");
      navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(link).then(done, () => toast("S\xE9lectionne le lien et copie-le")) : toast("S\xE9lectionne le lien et copie-le");
    };
  });
  let wall = { on: !1, start: 390, end: 1350, days: "1111111" };
  function readWall() {
    try {
      N && N.getWallInfo ? wall = Object.assign(wall, JSON.parse(N.getWallInfo())) : wall = Object.assign({ on: !1, start: 390, end: 1350, days: "1111111" }, ls.get("webWall", {}));
    } catch (e) {
    }
  }
  function sendWall() {
    N && N.setWallConfig ? N.setWallConfig(JSON.stringify({ on: wall.on, start: wall.start, end: wall.end, days: wall.days })) : (ls.set("webWall", { on: wall.on, start: wall.start, end: wall.end, days: wall.days }), webWallTick(!0)), readWall(), renderWallSettings();
  }
  function renderWallSettings() {
    $("wall-on").checked = !!wall.on, $("wall-start").value = hm(wall.start), $("wall-end").value = hm(wall.end), $("wall-days").innerHTML = [1, 2, 3, 4, 5, 6, 0].map((i) => `<button data-i="${i}" class="${wall.days.charAt(i) === "1" ? "on" : ""}">${WD[i]}</button>`).join(""), $("wall-days").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      const a = wall.days.split(""), i = +b.dataset.i;
      a[i] = a[i] === "1" ? "0" : "1", wall.days = a.join(""), sendWall();
    })), N || ($("wall-hint").textContent = (navigator.wakeLock ? "L\u2019\xE9cran reste allum\xE9 pendant la plage choisie, puis passe au noir." : "R\xE8gle \xAB Verrouillage automatique \xBB sur Jamais dans les r\xE9glages de l\u2019iPad.") + " Sur iPad, ouvre l\u2019app depuis l\u2019\xE9cran d\u2019accueil et active Acc\xE8s guid\xE9 pour rester dedans.");
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
  let wakeLock = null, webPeekUntil = 0, webWallState = null;
  function webActive() {
    const d = /* @__PURE__ */ new Date(), m = d.getHours() * 60 + d.getMinutes(), dayOn = (dd) => wall.days.charAt(dd.getDay()) === "1";
    return wall.start === wall.end ? dayOn(d) : wall.start < wall.end ? dayOn(d) && m >= wall.start && m < wall.end : m >= wall.start ? dayOn(d) : m < wall.end && dayOn(new Date(d.getTime() - 864e5));
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
    document.hidden || (wakeLock = null, webWallTick(!0)), fx.update();
  });
  $("night").addEventListener("click", () => {
    N && N.peek ? N.peek() : (webPeekUntil = Date.now() + 5 * 6e4, webWallTick(!0)), $("night").hidden = !0, fx.update();
  });
  window.onWallState = (isWall, on) => {
    $("night").hidden = !isWall || on, isWall && on && ($("settings").hidden = !0, show("home"), refresh()), fx.update();
  };
  N || (setTimeout(() => webWallTick(!0), 0), setInterval(() => webWallTick(!1), 3e4));
  const fx = function() {
    const cv = $("fx"), ctx = cv.getContext ? cv.getContext("2d") : null;
    let W = 0, H = 0, dpr = 1, scene = null, raf = 0, last = 0, t = 0, clouds = [], drops = [], flakes = [], stars = [], fogs = [], nextBolt = 0, bolt = null;
    const rnd = (a, b) => a + Math.random() * (b - a), SKY = {
      clear: ["#2b6cb4", "#8cc2ea"],
      partly: ["#3a6ea6", "#9dbdd9"],
      cloudy: ["#56677b", "#9eabb8"],
      rain: ["#3b4859", "#77889a"],
      storm: ["#232a37", "#4b5566"],
      snow: ["#71839a", "#cdd7e2"],
      fog: ["#7f8c9a", "#bfc7cf"],
      dawn: ["#38497a", "#f0a877"],
      dusk: ["#2a2d5c", "#ee8a6a"],
      nclear: ["#060c1e", "#1b2b50"],
      ncloud: ["#10151f", "#2a3240"],
      nrain: ["#0c121b", "#222b39"],
      nsnow: ["#1a2232", "#3c485c"]
    }, hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)], mix = (a, b, k) => {
      const A = hex(a), B = hex(b);
      return "#" + A.map((v, i) => pad(Math.round(v + (B[i] - v) * k).toString(16))).join("");
    };
    function phaseNow() {
      const d = todayW(), rise = d && d.sunrise ? toMin(d.sunrise.slice(11)) : 450, set = d && d.sunset ? toMin(d.sunset.slice(11)) : 1140, m = nowMin();
      return Math.abs(m - rise) <= 40 ? "dawn" : Math.abs(m - set) <= 40 ? "dusk" : m > rise && m < set ? "day" : "night";
    }
    function compute() {
      const P = { clear: [0, "day"], partly: [2, "day"], cloudy: [3, "day"], rain: [63, "day"], storm: [95, "day"], snow: [73, "day"], fog: [45, "day"], night: [0, "night"] };
      let code, phase;
      fxPreview && P[fxPreview] ? (code = P[fxPreview][0], phase = P[fxPreview][1]) : (code = weather ? weather.code : 2, phase = phaseNow());
      const cat = wxCat(code), night = phase === "night";
      let colors;
      if (night) colors = cat === "clear" || cat === "partly" ? SKY.nclear : cat === "snow" ? SKY.nsnow : cat === "rain" || cat === "storm" ? SKY.nrain : SKY.ncloud;
      else if (phase === "dawn" || phase === "dusk") {
        const g = SKY[phase], w = SKY[cat], k = cat === "clear" ? 0 : cat === "partly" ? 0.3 : 0.6;
        colors = [mix(g[0], w[0], k), mix(g[1], w[1], k)];
      } else colors = SKY[cat];
      const wind = fxPreview ? cat === "storm" ? 40 : 15 : weather ? weather.wind : 10;
      return { code, cat, phase, night, colors, intensity: RAIN_INT[code] || (cat === "storm" ? 0.9 : 0.5), wind, key: code + phase + cat };
    }
    function cloudSprite(w, h, tint, alpha) {
      const c = document.createElement("canvas");
      c.width = w, c.height = h;
      const g = c.getContext("2d"), n = 7 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) {
        const r = rnd(h * 0.28, h * 0.48), x = rnd(r, w - r), y = rnd(h * 0.45, h - r * 0.9), gr = g.createRadialGradient(x, y, r * 0.1, x, y, r);
        gr.addColorStop(0, "rgba(" + tint + "," + alpha + ")"), gr.addColorStop(0.65, "rgba(" + tint + "," + alpha * 0.7 + ")"), gr.addColorStop(1, "rgba(" + tint + ",0)"), g.fillStyle = gr, g.beginPath(), g.arc(x, y, r, 0, Math.PI * 2), g.fill();
      }
      return c;
    }
    function build() {
      const area = Math.max(0.35, W * H / 836e3), s = scene, nC = { clear: 0, partly: 4, cloudy: 9, fog: 3, rain: 8, storm: 9, snow: 7 }[s.cat] || 0, tint = s.night ? s.cat === "partly" || s.cat === "clear" ? "120,135,160" : "70,80,96" : s.cat === "storm" ? "95,105,120" : s.cat === "rain" ? "150,160,172" : s.cat === "cloudy" ? "205,212,222" : "255,255,255", alpha = s.cat === "partly" ? 0.85 : 0.7;
      clouds = [];
      for (let i = 0; i < nC; i++) {
        const w = rnd(280, 560) * Math.min(1.4, Math.max(0.7, W / 1100)), h = w * rnd(0.36, 0.48);
        clouds.push({ img: cloudSprite(Math.round(w), Math.round(h), tint, alpha), x: rnd(-w, W), y: rnd(-h * 0.35, H * (s.cat === "partly" ? 0.35 : 0.5)), w, h, v: rnd(5, 12) * (1 + s.wind / 25) * (Math.random() < 0.5 ? 0.8 : 1.1) });
      }
      if (clouds.sort((a, b) => a.w - b.w), drops = [], s.cat === "rain" || s.cat === "storm") {
        const n = Math.round((60 + 280 * s.intensity) * area);
        for (let i = 0; i < n; i++) drops.push({ x: rnd(0, W), y: rnd(-H, H), l: rnd(12, 24), v: rnd(650, 1050), a: rnd(0.25, 0.55) });
      }
      if (flakes = [], s.cat === "snow") {
        const n = Math.round((60 + 180 * s.intensity) * area);
        for (let i = 0; i < n; i++) flakes.push({ x: rnd(0, W), y: rnd(-H, H), r: rnd(1.2, 3.8), v: rnd(28, 75), ph: rnd(0, 6.3), sw: rnd(10, 30) });
      }
      if (stars = [], s.night && (s.cat === "clear" || s.cat === "partly")) {
        const n = Math.round((s.cat === "clear" ? 170 : 80) * area);
        for (let i = 0; i < n; i++) stars.push({ x: rnd(0, W), y: rnd(0, H * 0.75), r: rnd(0.4, 1.5), tw: rnd(0.6, 2.2), ph: rnd(0, 6.3) });
      }
      if (fogs = [], s.cat === "fog") for (let i = 0; i < 5; i++) fogs.push({ x: rnd(-W * 0.5, W), y: H * (0.3 + i * 0.15), w: W * rnd(0.9, 1.5), h: H * rnd(0.18, 0.3), v: rnd(6, 16) * (i % 2 ? 1 : -1) });
      nextBolt = performance.now() + rnd(2500, 6e3), bolt = null;
    }
    function drawSun(x, y, low) {
      const core = low ? "255,196,140" : "255,247,220", g = ctx.createRadialGradient(x, y, 10, x, y, 260);
      g.addColorStop(0, "rgba(" + core + ",0.75)"), g.addColorStop(0.25, "rgba(" + core + ",0.25)"), g.addColorStop(1, "rgba(" + core + ",0)"), ctx.fillStyle = g, ctx.beginPath(), ctx.arc(x, y, 260, 0, Math.PI * 2), ctx.fill(), ctx.save(), ctx.translate(x, y), ctx.rotate(t * 0.03), ctx.fillStyle = "rgba(" + core + ",0.06)";
      for (let i = 0; i < 12; i++)
        ctx.rotate(Math.PI / 6), ctx.beginPath(), ctx.moveTo(0, 0), ctx.lineTo(420, -26), ctx.lineTo(420, 26), ctx.closePath(), ctx.fill();
      ctx.restore(), ctx.fillStyle = "rgba(" + core + ",0.95)", ctx.beginPath(), ctx.arc(x, y, 44, 0, Math.PI * 2), ctx.fill();
    }
    function drawMoon(x, y) {
      const g = ctx.createRadialGradient(x, y, 20, x, y, 170);
      g.addColorStop(0, "rgba(220,228,255,0.28)"), g.addColorStop(1, "rgba(220,228,255,0)"), ctx.fillStyle = g, ctx.beginPath(), ctx.arc(x, y, 170, 0, Math.PI * 2), ctx.fill(), ctx.fillStyle = "#f1eee2", ctx.beginPath(), ctx.arc(x, y, 32, 0, Math.PI * 2), ctx.fill(), ctx.fillStyle = "rgba(180,176,160,0.35)", [[-9, -6, 7], [8, 6, 5], [4, -12, 4], [-4, 12, 3.5]].forEach((c) => {
        ctx.beginPath(), ctx.arc(x + c[0], y + c[1], c[2], 0, Math.PI * 2), ctx.fill();
      });
    }
    function makeBolt() {
      let x = rnd(W * 0.15, W * 0.85), y = 0;
      const pts = [[x, y]];
      for (; y < H * rnd(0.45, 0.7); )
        x += rnd(-38, 38), y += rnd(25, 55), pts.push([x, y]);
      return { pts, until: performance.now() + 180 };
    }
    function frame(now) {
      if (raf = 0, !ctx || !scene) return;
      const dt = last ? Math.min(0.05, (now - last) / 1e3) : 0;
      last = now, t += dt;
      const s = scene;
      if (ctx.setTransform(dpr, 0, 0, dpr, 0, 0), ctx.clearRect(0, 0, W, H), stars.length && (ctx.fillStyle = "#fff", stars.forEach((st) => {
        ctx.globalAlpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * st.tw + st.ph)), ctx.beginPath(), ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2), ctx.fill();
      }), ctx.globalAlpha = 1), (s.cat === "clear" || s.cat === "partly") && (s.night ? drawMoon(W < 560 ? W * 0.13 : W * 0.15, W < 560 ? 44 : Math.min(H * 0.1, 66)) : s.phase === "dawn" || s.phase === "dusk" ? drawSun(s.phase === "dawn" ? W * 0.18 : W * 0.82, H * 0.62, !0) : drawSun(W < 560 ? W * 0.12 : W * 0.14, W < 560 ? 40 : Math.min(H * 0.1, 64), !1)), clouds.forEach((c) => {
        c.x += c.v * dt, c.x > W + 40 && (c.x = -c.w - rnd(0, 200), c.y = rnd(-c.h * 0.35, H * (s.cat === "partly" ? 0.35 : 0.5))), ctx.drawImage(c.img, c.x, c.y, c.w, c.h);
      }), fogs.forEach((f) => {
        f.x += f.v * dt, f.x > W && (f.x = -f.w), f.x < -f.w && (f.x = W);
        const g = ctx.createRadialGradient(f.x + f.w / 2, f.y, 10, f.x + f.w / 2, f.y, f.w / 2);
        g.addColorStop(0, "rgba(235,240,245,0.28)"), g.addColorStop(1, "rgba(235,240,245,0)"), ctx.fillStyle = g, ctx.save(), ctx.translate(f.x + f.w / 2, f.y), ctx.scale(1, f.h / f.w), ctx.beginPath(), ctx.arc(0, 0, f.w / 2, 0, Math.PI * 2), ctx.restore(), ctx.fill();
      }), drops.length) {
        const slant = Math.min(0.45, s.wind / 70);
        ctx.strokeStyle = s.night ? "rgba(170,190,220,0.5)" : "rgba(215,228,245,0.55)", ctx.lineWidth = 1.2, ctx.lineCap = "round", ctx.beginPath(), drops.forEach((d) => {
          d.y += d.v * dt, d.x += d.v * slant * dt, d.y > H + 20 && (d.y = rnd(-80, -10), d.x = rnd(-W * slant, W)), d.x > W + 20 && (d.x -= W + 40), ctx.moveTo(d.x, d.y), ctx.lineTo(d.x - d.l * slant, d.y - d.l);
        }), ctx.stroke();
      }
      if (flakes.length) {
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        const drift = Math.min(40, s.wind);
        flakes.forEach((f) => {
          f.y += f.v * dt, f.x += Math.sin(t * 0.9 + f.ph) * f.sw * 0.04 + drift * 0.6 * dt, f.y > H + 6 && (f.y = -6, f.x = rnd(0, W)), f.x > W + 6 && (f.x = -6), ctx.beginPath(), ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2), ctx.fill();
        });
      }
      if (s.cat === "storm" && animOn) {
        if (now > nextBolt) {
          bolt = makeBolt(), nextBolt = now + rnd(5e3, 13e3);
          const fl = $("flash");
          fl.style.transition = "none", fl.style.opacity = "0.55", setTimeout(() => {
            fl.style.transition = "opacity .7s ease-out", fl.style.opacity = "0";
          }, 60);
        }
        bolt && now < bolt.until && (ctx.strokeStyle = "rgba(255,255,240,0.95)", ctx.lineWidth = 2.4, ctx.shadowColor = "#cfe0ff", ctx.shadowBlur = 18, ctx.beginPath(), bolt.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])), ctx.stroke(), ctx.shadowBlur = 0);
      }
      running() && (raf = requestAnimationFrame(throttle));
    }
    let lastReq = 0;
    function throttle(now) {
      if (raf = 0, now - lastReq < 30) {
        raf = requestAnimationFrame(throttle);
        return;
      }
      lastReq = now, frame(now);
    }
    const running = () => animOn && !document.hidden && $("night").hidden;
    function resize() {
      W = window.innerWidth, H = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1), cv.width = Math.round(W * dpr), cv.height = Math.round(H * dpr), scene && (build(), last = 0, frame(performance.now()));
    }
    function update() {
      const next = compute(), changed = !scene || next.key !== scene.key;
      scene = next, docEl.style.setProperty("--sky-top", scene.colors[0]), docEl.style.setProperty("--sky-bot", scene.colors[1]);
      const meta = document.querySelector('meta[name="theme-color"]');
      meta && meta.setAttribute("content", scene.colors[0]), changed && build(), raf && (cancelAnimationFrame(raf), raf = 0), last = 0, frame(performance.now());
    }
    return window.addEventListener("resize", resize), W = window.innerWidth, H = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1), cv.width = Math.round(W * dpr), cv.height = Math.round(H * dpr), { update, describe: () => scene ? scene.cat + " \xB7 " + scene.phase + (fxPreview ? " (aper\xE7u)" : "") + (animOn ? "" : " \xB7 fixe") : "\u2014", get scene() {
      return scene;
    } };
  }();
  function renderHome() {
    renderClock(), renderWx(), renderTr();
  }
  function renderAll() {
    renderHome(), renderShop(), view === "trains" && renderTrainsPage(), view === "meteo" && renderMeteoPage(), $("settings").hidden || renderDiag(), syncWidget();
  }
  let busy = !1, lastLoad = 0;
  async function refresh(force) {
    force = force === !0, !busy && (busy = !0, lastLoad = Date.now(), await Promise.all([loadWeather().then(() => {
      wxErr = "";
    }, (e) => {
      wxErr = e.message, note(e.message);
    }), loadTrains(force).then(() => loadVoies(force)), refreshBus(force).catch((e) => note("bus : " + e.message))]), busy = !1, fx.update(), renderAll());
  }
  window.onAppResume = () => {
    Date.now() - lastLoad > 5 * 6e4 ? refresh() : (renderAll(), fx.update());
  };
  let lastMinute = -1;
  setInterval(() => {
    const m = (/* @__PURE__ */ new Date()).getMinutes();
    m !== lastMinute && (lastMinute = m, renderClock(), view === "home" && renderTr(), view === "home" && curTab() === "bus" && !document.hidden && $("night").hidden && loadBusRT(!1).then(() => {
      curTab() === "bus" && renderTr();
    }), m % 5 === 0 && fx.update());
  }, 5e3);
  setInterval(() => {
    !document.hidden && $("night").hidden && refresh();
  }, 5 * 6e4);
  setupImported && setTimeout(() => toast(setupImported > 0 ? "R\xE9glages import\xE9s sur cet appareil" : "Lien de transfert illisible"), 400);
  docEl.classList.toggle("noanim", !animOn);
  renderAll();
  fx.update();
  show("home", !0);
  refresh();
  window.MonMatin = { fx, memo, buildBusIndex, loadBusRT, decodeTripUpdates, get busIdx() {
    return busIdx;
  }, renderTr, setTab(t) {
    trTab = t, trTabAt = Date.now(), renderTr();
  }, findPlatform, loadVoies, get voies() {
    return voies;
  }, addShop, get shop() {
    return shop;
  }, renderAll, show, refresh, setPreview(v) {
    fxPreview = v, fx.update();
  } };
})();
