// King's Desk — local clock, Calendar.app events, notes, and tasks.

import { React, run } from "uebersicht";

export const refreshFrequency = 60 * 1000;

export const command = `export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH; \
if command -v icalBuddy >/dev/null; then \
  icalBuddy -nc -nrd -b '' -ps '| ¦ |' -iep 'title,datetime' -po 'datetime,title' -df '%Y-%m-%d' -tf '%H:%M' -eed eventsToday+6 2>/dev/null; \
else echo '__NO_ICALBUDDY__'; fi`;

const K = "kings-desk-v2";
const LAYOUTS = ["classic", "vertical", "compact"];

// Apple's own variable fonts, symlinked from /System/Library/Fonts into ./fonts.
// Loading them by file (instead of by name) unlocks their weight and width axes —
// SF Pro's width axis is what gives the lock-screen clock its tall, narrow digits.
const FONT_DIR = "/kings-desk.widget/fonts";
const FONT_FILES = { "KD SF Pro": "SFNS.ttf", "KD SF Rounded": "SFNSRounded.ttf", "KD SF Compact": "SFCompact.ttf", "KD New York": "NewYork.ttf", "KD SF Mono": "SFNSMono.ttf" };
const FONTS = {
  system: { label: "SF Pro", family: '"KD SF Pro", -apple-system, system-ui, sans-serif', width: true },
  rounded: { label: "SF Pro Rounded", family: '"KD SF Rounded", ui-rounded, -apple-system, sans-serif' },
  compact: { label: "SF Compact", family: '"KD SF Compact", -apple-system, sans-serif' },
  serif: { label: "New York", family: '"KD New York", ui-serif, Georgia, serif' },
  mono: { label: "SF Mono", family: '"KD SF Mono", ui-monospace, Menlo, monospace' },
  inter: { label: "Inter", family: '"Inter", -apple-system, sans-serif', web: "Inter:opsz,wght@14..32,100..900" },
  geist: { label: "Geist", family: '"Geist", -apple-system, sans-serif', web: "Geist:wght@100..900" },
  avenir: { label: "Avenir Next", family: '"Avenir Next", -apple-system, sans-serif' },
  helvetica: { label: "Helvetica Neue", family: '"Helvetica Neue", Helvetica, sans-serif' },
  futura: { label: "Futura", family: "Futura, sans-serif" },
  baskerville: { label: "Baskerville", family: "Baskerville, Georgia, serif" },
};
const fontOf = (key) => FONTS[key] || FONTS.system;
const CLOCK_PRESETS = [
  { label: "Standard", patch: { font: "system", weight: 600, width: 100, size: 124 } },
  { label: "Tall", patch: { font: "system", weight: 640, width: 30, size: 176 } },
  { label: "Thin", patch: { font: "system", weight: 200, width: 100 } },
  { label: "Rounded", patch: { font: "rounded", weight: 600 } },
  { label: "Serif", patch: { font: "serif", weight: 500 } },
];
const QUADS = [
  { id: "q1", label: "Important & urgent", short: "Do now", tone: "#ff6b5a" },
  { id: "q2", label: "Important", short: "Schedule", tone: "#5aa2ff" },
  { id: "q3", label: "Urgent", short: "Delegate", tone: "#ffb547" },
  { id: "q4", label: "Later", short: "Later", tone: "#a3a9b5" },
];
const TONES = ["#5aa2ff", "#ff9f5a", "#5fd4a0", "#c49bff", "#ff6b8a"];
const CLOCK_COLORS = ["#ffffff", "#d8e9ff", "#ffdbb4", "#ffc6da", "#c9f0d4", "#1e293b"];
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DEFAULT_APPEARANCE = { font: "system", widgetFont: "system", size: 124, weight: 600, width: 100, scale: 100, color: "#ffffff", shade: "slate", effect: "liquid" };
const EMPTY_TASKS = { q1: [], q2: [], q3: [], q4: [] };

const normalize = (s) => ({
  ...s,
  tasks: { ...EMPTY_TASKS, ...(s.tasks || {}) },
  notes: s.notes || "",
  layout: Number(s.layout) || 0,
  appearance: { ...DEFAULT_APPEARANCE, ...(s.appearance || {}) },
});
const load = () => {
  try {
    const s = JSON.parse(localStorage.getItem(K));
    if (s) return normalize(s);
  } catch (e) {}
  let old = null;
  try {
    old = JSON.parse(localStorage.getItem("kings-desk-tasks-v1"));
  } catch (e) {}
  return normalize({ tasks: old, pos: null, locked: false });
};
const save = (s) => {
  try {
    localStorage.setItem(K, JSON.stringify({ tasks: s.tasks, notes: s.notes, layout: s.layout, pos: s.pos, locked: s.locked, appearance: s.appearance }));
  } catch (e) {}
};

export const initialState = { output: "", adding: null, appearanceOpen: false, locked: false, ...load() };

export const updateState = (ev, prev) => {
  let next = prev;
  switch (ev.type) {
    case "UB/COMMAND_RAN":
      return ev.output === prev.output ? prev : { ...prev, output: ev.output || "" };
    case "ADD_OPEN":
      return { ...prev, adding: ev.q };
    case "ADD_CANCEL":
      return { ...prev, adding: null };
    case "ADD": {
      // The input's blur fires after Enter/Escape already closed it; ignore that echo.
      if (prev.adding !== ev.q) return prev;
      const text = (ev.text || "").trim();
      if (!text) return { ...prev, adding: null };
      next = { ...prev, adding: null, tasks: { ...prev.tasks, [ev.q]: [...prev.tasks[ev.q], { id: Date.now(), text }] } };
      break;
    }
    case "DONE":
      next = { ...prev, tasks: { ...prev.tasks, [ev.q]: prev.tasks[ev.q].map((t) => t.id === ev.id ? { ...t, doneAt: t.doneAt ? null : Date.now() } : t) } };
      break;
    case "CLEAR_DONE":
      next = { ...prev, tasks: { ...prev.tasks, [ev.q]: prev.tasks[ev.q].filter((t) => !t.doneAt) } };
      break;
    case "NOTES":
      if (ev.text === prev.notes) return prev;
      next = { ...prev, notes: ev.text };
      break;
    case "LAYOUT":
      next = { ...prev, layout: (prev.layout + 1) % LAYOUTS.length };
      break;
    case "APPEARANCE_TOGGLE":
      return { ...prev, appearanceOpen: !prev.appearanceOpen };
    case "APPEARANCE_SET":
      next = { ...prev, appearance: { ...prev.appearance, ...ev.patch } };
      break;
    case "LOCK_TOGGLE":
      next = { ...prev, locked: !prev.locked, appearanceOpen: false };
      break;
    case "POS":
      next = { ...prev, pos: ev.pos };
      break;
    default:
      return prev;
  }
  save(next);
  return next;
};

/* ---------- helpers ---------- */
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Keep a saved position on screen, e.g. after a display or resolution change.
const clampPos = (x, y) => ({ x: clamp(x, 0, Math.max(0, window.innerWidth - 160)), y: clamp(y, 0, Math.max(0, window.innerHeight - 120)) });

// Multi-day events ("2026-09-26 - 2026-09-28 ¦ Trip") are listed once by icalBuddy;
// spread them over every day they cover so ongoing events still show up.
const parseEvents = (out) => {
  if (out.includes("__NO_ICALBUDDY__")) return null;
  const events = [];
  out.split("\n").forEach((line) => {
    const m = line.trim().match(/^(\d{4}-\d{2}-\d{2})(?: at (\d{2}:\d{2}))?(.*?)¦ (.+)$/);
    if (!m) return;
    const [, start, time, rest, title] = m;
    const end = (rest.match(/\d{4}-\d{2}-\d{2}/) || [start])[0];
    const tone = TONES[hash(title) % TONES.length];
    const d = fromIso(start);
    for (let i = 0; i < 400 && iso(d) <= end; i++, d.setDate(d.getDate() + 1)) {
      events.push({ date: iso(d), time: iso(d) === start ? time || null : null, title, tone });
    }
  });
  return events.sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
};

// @font-face for the system fonts, plus Google Fonts only when one of those is picked.
const injectFonts = () => {
  if (document.getElementById("kd-fonts")) return;
  const el = document.createElement("style");
  el.id = "kd-fonts";
  el.textContent = Object.entries(FONT_FILES)
    .map(([name, file]) => `@font-face { font-family: "${name}"; src: url("${FONT_DIR}/${file}") format("truetype"); font-weight: 1 1000; font-stretch: 30% 150%; font-display: block; }`)
    .join("\n");
  document.head.appendChild(el);
};
const ensureWebFont = (key) => {
  const spec = fontOf(key).web;
  const id = `kd-web-${key}`;
  if (!spec || document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
  document.head.appendChild(link);
};

// Open Calendar.app at the chosen date.
const openDay = (d) =>
  run(
    `osascript -e 'set d to current date' -e 'set day of d to 1' -e 'set year of d to ${d.getFullYear()}' ` +
      `-e 'set month of d to ${MONTHS[d.getMonth()]}' -e 'set day of d to ${d.getDate()}' ` +
      `-e 'tell application "Calendar" to activate' -e 'tell application "Calendar" to view calendar at d'`,
  );

// Drag by the clock/date; save the position.
const startDrag = (e, dispatch) => {
  if (e.button !== 0) return;
  const el = e.currentTarget.closest(".desk");
  const r = el.getBoundingClientRect();
  const dx = e.clientX - r.left;
  const dy = e.clientY - r.top;
  const place = (m) => {
    const p = clampPos(m.clientX - dx, m.clientY - dy);
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    el.style.right = "auto";
    return p;
  };
  el.classList.add("dragging");
  const up = (m) => {
    window.removeEventListener("mousemove", place);
    window.removeEventListener("mouseup", up);
    el.classList.remove("dragging");
    dispatch({ type: "POS", pos: place(m) });
  };
  window.addEventListener("mousemove", place);
  window.addEventListener("mouseup", up);
  e.preventDefault();
};

// Re-render on each minute boundary (the calendar command alone drifts up to 59 s)
// and when the screen size changes.
const useTick = () => {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    let timer;
    const bump = () => setTick((n) => n + 1);
    const arm = () => {
      timer = setTimeout(() => {
        bump();
        arm();
      }, 60000 - (Date.now() % 60000) + 30);
    };
    const wake = () => {
      clearTimeout(timer);
      bump();
      arm();
    };
    arm();
    window.addEventListener("resize", bump);
    document.addEventListener("visibilitychange", wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", bump);
      document.removeEventListener("visibilitychange", wake);
    };
  }, []);
};

// Übersicht re-renders on the next animation frame, so a plain controlled input
// snaps back to its old value for a frame on every change (the slider jitter).
// Local state updates synchronously and keeps the control steady.
const useLive = (value) => {
  const [v, setV] = React.useState(value);
  React.useEffect(() => setV(value), [value]);
  return [v, setV];
};
const Range = ({ value, onValue, ...rest }) => {
  const [v, setV] = useLive(value);
  return <input type="range" {...rest} value={v} onChange={(e) => { const n = Number(e.target.value); setV(n); onValue(n); }} />;
};
const Select = ({ value, onValue, children }) => {
  const [v, setV] = useLive(value);
  return <select value={v} onChange={(e) => { setV(e.target.value); onValue(e.target.value); }}>{children}</select>;
};
const Color = ({ value, onValue }) => {
  const [v, setV] = useLive(value);
  return <input type="color" value={v} title="Choose a custom clock color" onChange={(e) => { setV(e.target.value); onValue(e.target.value); }} />;
};

const autosize = (el) => {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
};

/* ---------- components ---------- */
const clockStyle = (a, size) => ({
  fontFamily: fontOf(a.font).family,
  fontSize: size,
  fontWeight: a.weight,
  fontVariationSettings: fontOf(a.font).width ? `"wdth" ${a.width}` : "normal",
  letterSpacing: fontOf(a.font).width && a.width < 80 ? "0.005em" : "-0.02em",
  color: a.color,
});

const Clock = ({ now, dispatch, small, vertical, appearance, locked }) => {
  const d0 = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const size = Math.round(appearance.size * (small ? 0.52 : vertical ? 0.84 : 1));
  return (
    <div className={small ? "clockwrap small" : "clockwrap"} onMouseDown={(e) => !locked && startDrag(e, dispatch)} title={locked ? "Unlock to move" : "Drag to move"}>
      <div className="date">{d0.charAt(0).toUpperCase() + d0.slice(1)}</div>
      <div className="clock" style={clockStyle(appearance, size)}>
        {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
  );
};

const WeekStrip = ({ week, events }) => (
  <div className="glass week">
    {week.map((d, i) => {
      const evs = (events || []).filter((e) => e.date === iso(d)).slice(0, 2);
      return (
        <div className="day" key={i} onClick={() => openDay(d)} title="Open in Calendar">
          <div className="dname">{DAYS[d.getDay()]}</div>
          <div className={i === 0 ? "dnum today" : "dnum"}>{d.getDate()}</div>
          {evs.map((e, j) => (
            <div className="pill" key={j} style={{ background: e.tone + "38", color: e.tone }}>
              {e.title}
            </div>
          ))}
        </div>
      );
    })}
  </div>
);

const WeekList = ({ week, events }) => (
  <div className="glass weeklist">
    {week.map((d, i) => {
      const evs = (events || []).filter((e) => e.date === iso(d));
      return (
        <div className={i === 0 ? "wrow now" : "wrow"} key={i} onClick={() => openDay(d)} title="Open in Calendar">
          <div className="wdate">
            <span className="wnum">{d.getDate()}</span>
            <span className="wname">{i === 0 ? "Today" : DAYS_LONG[d.getDay()]}</span>
          </div>
          <div className="wevs">
            {evs.length === 0 && <span className="wfree">Free</span>}
            {evs.slice(0, 3).map((e, j) => (
              <div className="wev" key={j}>
                <span className="bar" style={{ background: e.tone }} />
                <span className="etime">{e.time || "All day"}</span>
                <span className="etitle">{e.title}</span>
              </div>
            ))}
          </div>
        </div>
      );
    })}
  </div>
);

const Today = ({ todays, events, notes, dispatch, now }) => (
  <div className="glass agenda">
    <div className="head">
      <span>Today</span>
      <button className="calendar-button" onClick={() => openDay(now)} title="Open Calendar" aria-label="Open Calendar">
        <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2.5" y="4.5" width="15" height="13" rx="2" />
          <path d="M6.5 2.5v4M13.5 2.5v4M2.5 8.5h15" />
        </svg>
      </button>
    </div>
    {events === null && <div className="empty">Calendar unavailable</div>}
    {todays.slice(0, 4).map((e, i) => (
      <div className="ev" key={i} onClick={() => openDay(now)}>
        <span className="bar" style={{ background: e.tone }} />
        <span className="etime">{e.time || "All day"}</span>
        <span className="etitle">{e.title}</span>
      </div>
    ))}
    <textarea
      className="notes"
      placeholder="Add a note…"
      defaultValue={notes}
      rows={2}
      ref={autosize}
      onInput={(e) => {
        autosize(e.target);
        dispatch({ type: "NOTES", text: e.target.value });
      }}
    />
  </div>
);

const Matrix = ({ tasks, adding, dispatch, compact }) => (
  <div className={compact ? "matrix compact" : "matrix"}>
    {QUADS.map((q) => {
      const active = tasks[q.id].filter((t) => !t.doneAt);
      const completed = tasks[q.id].filter((t) => t.doneAt).sort((a, b) => b.doneAt - a.doneAt);
      return (
      <div className="glass quad" key={q.id}>
        <div className="qhead">
          <span className="dot" style={{ background: q.tone }} />
          {compact ? q.short : q.label}
          <span className="count">{active.length || ""}</span>
          <button className="add" onClick={() => dispatch({ type: "ADD_OPEN", q: q.id })} aria-label={`Add task to ${q.label}`}>
            +
          </button>
        </div>
        {!compact && active.length === 0 && completed.length === 0 && adding !== q.id && <div className="none">No tasks</div>}
        {active.slice(0, compact ? 2 : 6).map((t) => (
          <button className="task" key={t.id} onClick={() => dispatch({ type: "DONE", q: q.id, id: t.id })} title="Mark completed">
            <span className="check" />
            <span className="ttext">{t.text}</span>
          </button>
        ))}
        {adding === q.id && (
          <input
            className="input"
            autoFocus
            placeholder="New task…"
            onKeyDown={(e) => {
              if (e.key === "Enter") dispatch({ type: "ADD", q: q.id, text: e.target.value });
              if (e.key === "Escape") dispatch({ type: "ADD_CANCEL" });
            }}
            onBlur={(e) => dispatch({ type: "ADD", q: q.id, text: e.target.value })}
          />
        )}
        {completed.length > 0 && (
          <div className="completed">
            <div className="completed-title">
              Completed · {completed.length}
              <button className="clear-done" onClick={() => dispatch({ type: "CLEAR_DONE", q: q.id })} title="Remove completed tasks">Clear</button>
            </div>
            <div className="completed-list">
              {completed.map((t) => (
                <button className="task done" key={t.id} onClick={() => dispatch({ type: "DONE", q: q.id, id: t.id })} title="Mark as not completed">
                  <span className="check">✓</span><span className="ttext">{t.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    ); })}
  </div>
);

// Opens beside the widget and stays fixed on screen, so it neither covers the clock
// nor moves under the cursor while "Widget size" is dragged.
const usePanelSpot = () => {
  const ref = React.useRef(null);
  const [spot, setSpot] = React.useState(null);
  React.useLayoutEffect(() => {
    const desk = ref.current.parentElement.getBoundingClientRect();
    const w = ref.current.offsetWidth;
    const gap = 14;
    const left = desk.left - w - gap >= 8 ? desk.left - w - gap : Math.min(desk.right + gap, window.innerWidth - w - 8);
    const top = clamp(desk.top, 8, Math.max(8, window.innerHeight - 320));
    setSpot({ left, top, maxHeight: window.innerHeight - top - 8 });
  }, []);
  return [ref, spot || { visibility: "hidden" }];
};

const Appearance = ({ appearance, dispatch }) => {
  const set = (patch) => dispatch({ type: "APPEARANCE_SET", patch });
  const [ref, spot] = usePanelSpot();
  const fontOptions = Object.keys(FONTS).map((key) => <option key={key} value={key}>{FONTS[key].label}</option>);
  return (
    <div className="appearance glass" ref={ref} style={spot} role="group" aria-label="Appearance settings">
      <div className="panel-title">Appearance</div>
      <div className="presets" role="group" aria-label="Clock styles">
        {CLOCK_PRESETS.map((p) => (
          <button key={p.label} className="preset" onClick={() => set(p.patch)}
            style={{ fontFamily: fontOf(p.patch.font).family, fontWeight: p.patch.weight, fontVariationSettings: fontOf(p.patch.font).width ? `"wdth" ${p.patch.width}` : "normal" }}>
            <span className="preset-sample">12</span>
            <span className="preset-name">{p.label}</span>
          </button>
        ))}
      </div>
      <label className="setting">
        <span>Clock font</span>
        <Select value={appearance.font} onValue={(v) => set({ font: v })}>{fontOptions}</Select>
      </label>
      <label className="setting">
        <span>Clock weight <span className="value">{appearance.weight}</span></span>
        <Range min="100" max="900" step="10" value={appearance.weight} onValue={(v) => set({ weight: v })} />
      </label>
      {fontOf(appearance.font).width && (
        <label className="setting">
          <span>Clock width <span className="value">{appearance.width <= 60 ? "Tall" : appearance.width >= 120 ? "Wide" : appearance.width}</span></span>
          <Range min="30" max="150" step="5" value={appearance.width} onValue={(v) => set({ width: v })} />
        </label>
      )}
      <label className="setting">
        <span>Clock size <span className="value">{appearance.size}px</span></span>
        <Range min="72" max="200" step="2" value={appearance.size} onValue={(v) => set({ size: v })} />
      </label>
      <label className="setting">
        <span>Widget font</span>
        <Select value={appearance.widgetFont} onValue={(v) => set({ widgetFont: v })}>{fontOptions}</Select>
      </label>
      <label className="setting">
        <span>Widget size <span className="value">{appearance.scale}%</span></span>
        <Range min="70" max="130" step="5" value={appearance.scale} onValue={(v) => set({ scale: v })} />
      </label>
      <label className="setting color-setting">
        <span>Clock color</span>
        <Color value={appearance.color} onValue={(v) => set({ color: v })} />
      </label>
      <div className="clock-colors" role="group" aria-label="Clock colors">
        {CLOCK_COLORS.map((color) => (
          <button key={color} className={`color-swatch ${appearance.color === color ? "selected" : ""}`}
            style={{ background: color }} onClick={() => set({ color })}
            title={color} aria-label={`Clock color ${color}`} aria-pressed={appearance.color === color} />
        ))}
      </div>
      <div className="setting"><span>Glass shade</span></div>
      <div className="shades" role="group" aria-label="Glass shade">
        {["clear", "frost", "slate", "midnight"].map((shade) => (
          <button key={shade} className={`shade-swatch ${shade} ${appearance.shade === shade ? "selected" : ""}`}
            onClick={() => set({ shade })}
            title={shade.charAt(0).toUpperCase() + shade.slice(1)} aria-label={`${shade} glass`}
            aria-pressed={appearance.shade === shade} />
        ))}
      </div>
      <div className="shade-name">{appearance.shade.charAt(0).toUpperCase() + appearance.shade.slice(1)}</div>
      <label className="setting">
        <span>Surface effect</span>
        <Select value={appearance.effect} onValue={(v) => set({ effect: v })}>
          <option value="liquid">Liquid</option>
          <option value="soft">Soft blur</option>
          <option value="glow">Luminous</option>
        </Select>
      </label>
    </div>
  );
};

/* ---------- render ---------- */
const Desk = ({ s, dispatch }) => {
  useTick();
  const now = new Date();
  const events = parseEvents(s.output);
  const week = [...Array(7)].map((_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    return d;
  });
  const todays = (events || []).filter((e) => e.date === iso(now));
  const layout = LAYOUTS[s.layout] || LAYOUTS[0];
  const appearance = { ...DEFAULT_APPEARANCE, ...s.appearance };
  const scale = clamp(Number(appearance.scale) || 100, 70, 130) / 100;
  const p = s.pos && clampPos(s.pos.x, s.pos.y);
  const pos = p ? { left: p.x, top: p.y } : { right: 48, top: 48 };

  injectFonts();
  ensureWebFont(appearance.font);
  ensureWebFont(appearance.widgetFont);

  return (
    <div className={`desk ${layout} shade-${appearance.shade} effect-${appearance.effect} ${s.locked ? "locked" : ""}`}
      style={{ ...pos, fontFamily: fontOf(appearance.widgetFont).family }}>
      <div className="toolbar">
        <div className="edit-tools" aria-hidden={s.locked}>
          <button className="tool" tabIndex={s.locked ? -1 : 0} onClick={() => dispatch({ type: "LAYOUT" })} title={`Switch layout · ${layout}`} aria-label={`Switch layout, current ${layout}`}>▦</button>
          <button className="tool" tabIndex={s.locked ? -1 : 0} onClick={() => dispatch({ type: "APPEARANCE_TOGGLE" })} title="Appearance" aria-label="Appearance settings" aria-expanded={s.appearanceOpen}>◐</button>
        </div>
        <button className="tool lock-tool" onClick={() => dispatch({ type: "LOCK_TOGGLE" })} title={s.locked ? "Unlock widget" : "Lock widget"} aria-label={s.locked ? "Unlock widget controls" : "Lock widget controls"} aria-pressed={!!s.locked}>
          {s.locked ? <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="4.5" y="9" width="11" height="8" rx="2"/><path d="M7 9V6a3 3 0 0 1 6 0v3"/></svg>
            : <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="4.5" y="9" width="11" height="8" rx="2"/><path d="M7 9V6a3 3 0 0 1 6 0"/></svg>}
        </button>
      </div>
      {s.appearanceOpen && <Appearance appearance={appearance} dispatch={dispatch} />}
      {/* zoom (not transform: scale) re-lays out instead of re-rasterizing the
          backdrop-filter layers, which flickered in WebKit. */}
      <div className="stack" style={{ zoom: scale }}>
        {layout === "classic" && (
          <>
            <Clock now={now} dispatch={dispatch} appearance={appearance} locked={s.locked} />
            <WeekStrip week={week} events={events} />
            <Today todays={todays} events={events} notes={s.notes} dispatch={dispatch} now={now} />
            <Matrix tasks={s.tasks} adding={s.adding} dispatch={dispatch} />
          </>
        )}
        {layout === "vertical" && (
          <div className="cols">
            <div className="col">
              <Clock now={now} dispatch={dispatch} appearance={appearance} locked={s.locked} vertical />
              <Today todays={todays} events={events} notes={s.notes} dispatch={dispatch} now={now} />
              <Matrix tasks={s.tasks} adding={s.adding} dispatch={dispatch} compact />
            </div>
            <WeekList week={week} events={events} />
          </div>
        )}
        {layout === "compact" && (
          <>
            <Clock now={now} dispatch={dispatch} appearance={appearance} locked={s.locked} small />
            <WeekStrip week={week} events={events} />
            <Matrix tasks={s.tasks} adding={s.adding} dispatch={dispatch} compact />
          </>
        )}
      </div>
    </div>
  );
};

export const render = (s, dispatch) => <Desk s={s} dispatch={dispatch} />;

export const className = `
  top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none;
  font-family: -apple-system, system-ui, sans-serif;
  color: rgba(255,255,255,.96); -webkit-font-smoothing: antialiased;

  .desk { position: absolute; pointer-events: auto; }
  .stack { display: flex; flex-direction: column; gap: 14px; }
  .classic .stack { width: 460px; }
  .vertical .stack { width: 760px; }
  .compact .stack { width: 380px; gap: 12px; }
  .desk.dragging { opacity: .88; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
  .col { display: flex; flex-direction: column; gap: 14px; }

  .shade-clear { --fill: rgba(255,255,255,.14); --edge: rgba(255,255,255,.3); --inner: rgba(255,255,255,.4); --shadow: rgba(0,0,0,.28); }
  .shade-frost { --fill: rgba(35,48,63,.38); --edge: rgba(255,255,255,.28); --inner: rgba(255,255,255,.35); --shadow: rgba(0,0,0,.32); }
  .shade-slate { --fill: rgba(21,29,42,.64); --edge: rgba(255,255,255,.20); --inner: rgba(255,255,255,.23); --shadow: rgba(0,0,0,.38); }
  .shade-midnight { --fill: rgba(8,12,20,.82); --edge: rgba(255,255,255,.14); --inner: rgba(255,255,255,.18); --shadow: rgba(0,0,0,.44); }
  .glass {
    position: relative; overflow: hidden; border-radius: 28px; padding: 14px 16px;
    background: var(--fill);
    -webkit-backdrop-filter: blur(28px) saturate(150%);
    backdrop-filter: blur(28px) saturate(150%);
    border: 1px solid var(--edge);
    box-shadow: inset 0 1px 0 var(--inner), 0 16px 48px var(--shadow);
  }
  .glass::before { content: ""; position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
    background: linear-gradient(155deg, rgba(255,255,255,.10), transparent 42%); }
  .glass > * { position: relative; }
  .effect-liquid .glass { box-shadow: inset 0 1px 0 rgba(255,255,255,.48), inset 0 -1px 0 rgba(255,255,255,.14), 0 16px 48px var(--shadow); }
  .effect-liquid .glass::before { background: radial-gradient(110% 54% at 20% -12%, rgba(255,255,255,.25), transparent 65%), radial-gradient(70% 48% at 92% 110%, rgba(255,255,255,.11), transparent 72%); }
  .effect-soft .glass { -webkit-backdrop-filter: blur(38px) saturate(115%); backdrop-filter: blur(38px) saturate(115%); box-shadow: 0 10px 32px var(--shadow); }
  .effect-soft .glass::before { opacity: .24; }
  .effect-glow .glass { box-shadow: inset 0 1px 0 rgba(255,255,255,.4), 0 0 24px rgba(157,206,255,.23), 0 16px 48px var(--shadow); }
  .effect-glow .glass::before { background: radial-gradient(90% 80% at 10% 0%, rgba(183,220,255,.22), transparent 68%); }

  .toolbar { position: absolute; top: -26px; right: 2px; z-index: 5; display: flex; gap: 6px; opacity: .72; transition: opacity .16s ease-out; }
  .desk:hover .toolbar, .toolbar:focus-within { opacity: 1; }
  .edit-tools { display: flex; gap: 6px; opacity: 1; transform: translateX(0) scale(1); transition: opacity .18s ease-out, transform .18s ease-out, visibility 0s; }
  .desk.locked .edit-tools { opacity: 0; transform: translateX(10px) scale(.88); pointer-events: none; visibility: hidden; transition: opacity .18s ease-out, transform .18s ease-out, visibility 0s linear .18s; }
  .desk.locked .toolbar { opacity: .45; }
  .desk.locked:hover .toolbar, .desk.locked .toolbar:focus-within { opacity: 1; }
  .tool, .calendar-button { display: grid; place-items: center; border: 1px solid var(--edge); color: #fff; background: var(--fill); -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); cursor: pointer; }
  .tool { width: 30px; height: 25px; border-radius: 10px; font: 500 17px -apple-system, system-ui, sans-serif; line-height: 1; }
  .tool:active { transform: scale(.94); }
  .tool:hover, .calendar-button:hover { background: rgba(255,255,255,.22); }
  .tool:focus-visible, .calendar-button:focus-visible, .shade-swatch:focus-visible, .color-swatch:focus-visible, .preset:focus-visible, .task:focus-visible, .appearance select:focus-visible, .appearance input:focus-visible { outline: 2px solid #9ed2ff; outline-offset: 2px; }
  .appearance { position: fixed; z-index: 6; width: 236px; box-sizing: border-box; overflow-y: auto; padding: 17px; border-radius: 20px; display: flex; flex-direction: column; gap: 12px; color: #fff; font-family: inherit; font-size: 12px; font-weight: 500; }
  .panel-title { font-size: 14px; font-weight: 700; margin-bottom: 2px; }
  .presets { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; }
  .preset { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 0 5px; border: 1px solid rgba(255,255,255,.18); border-radius: 10px; background: rgba(255,255,255,.08); color: #fff; cursor: pointer; }
  .preset:hover { background: rgba(255,255,255,.2); }
  .preset-sample { font-size: 22px; line-height: 1; }
  .preset-name { font: 500 9px -apple-system, system-ui, sans-serif; opacity: .7; }
  .setting { display: flex; flex-direction: column; gap: 7px; }
  .setting .value { float: right; opacity: .55; font-variant-numeric: tabular-nums; }
  .appearance select { width: 100%; color: #fff; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.18); border-radius: 9px; padding: 6px 8px; font: inherit; }
  .appearance select option { color: #111; }
  .appearance input[type=range] { width: 100%; margin: 0; accent-color: #b7d8ff; }
  .color-setting { flex-direction: row; align-items: center; justify-content: space-between; }
  .appearance input[type=color] { width: 38px; height: 26px; padding: 2px; border: 1px solid rgba(255,255,255,.3); border-radius: 8px; background: transparent; cursor: pointer; }
  .clock-colors { display: flex; gap: 8px; margin-top: -4px; }
  .color-swatch { width: 22px; height: 22px; border: 1px solid rgba(255,255,255,.45); border-radius: 50%; cursor: pointer; }
  .color-swatch.selected { outline: 2px solid #fff; outline-offset: 2px; }
  .shades { display: flex; gap: 9px; }
  .shade-swatch { width: 34px; height: 34px; border: 1px solid rgba(255,255,255,.35); border-radius: 11px; cursor: pointer; }
  .shade-swatch.clear { background: rgba(255,255,255,.42); }
  .shade-swatch.frost { background: #8999a7; }
  .shade-swatch.slate { background: #354052; }
  .shade-swatch.midnight { background: #111927; }
  .shade-swatch.selected { outline: 2px solid #fff; outline-offset: 2px; }
  .shade-name { font-size: 11px; opacity: .62; margin-top: -6px; }

  .clockwrap { cursor: grab; user-select: none; text-align: center; padding-top: 4px; }
  .clockwrap:active { cursor: grabbing; }
  .locked .clockwrap, .locked .clockwrap:active { cursor: default; }
  .date { font-size: 21px; font-weight: 600; letter-spacing: -0.01em; opacity: .96; text-shadow: 0 1px 2px rgba(0,0,0,.35), 0 6px 20px rgba(0,0,0,.3); }
  .clock { line-height: .92; margin: 0 0 8px; font-optical-sizing: auto;
           text-shadow: 0 1px 2px rgba(0,0,0,.22), 0 10px 34px rgba(0,0,0,.3); }
  .clockwrap.small { display: flex; align-items: baseline; justify-content: space-between; text-align: left; padding: 0 6px; }
  .clockwrap.small .clock { margin: 0; }
  .clockwrap.small .date { font-size: 17px; }

  .week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; padding: 12px 10px 14px; }
  .day { display: flex; flex-direction: column; align-items: center; gap: 5px; min-width: 0; cursor: pointer; border-radius: 14px; padding: 2px 0 4px; }
  .day:hover { background: rgba(255,255,255,.08); }
  .dname { font-size: 12px; font-weight: 600; opacity: .55; }
  .dnum { font-size: 19px; font-weight: 600; width: 32px; height: 32px; display: grid; place-items: center; border-radius: 16px; font-variant-numeric: tabular-nums; }
  .dnum.today { background: #fff; color: #111; }
  .pill { width: 100%; font-size: 10.5px; font-weight: 600; padding: 3px 5px; border-radius: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box; }
  .compact .pill { display: none; }

  .weeklist { padding: 8px 8px; }
  .wrow { display: grid; grid-template-columns: 112px 1fr; gap: 10px; padding: 11px 10px; border-radius: 18px; cursor: pointer; min-height: 44px; }
  .wrow + .wrow { border-top: .5px solid rgba(255,255,255,.08); }
  .wrow:hover { background: rgba(255,255,255,.08); }
  .wrow.now { background: rgba(255,255,255,.12); }
  .wdate { display: flex; align-items: baseline; gap: 8px; }
  .wnum { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .wname { font-size: 12.5px; font-weight: 600; opacity: .6; }
  .wevs { display: flex; flex-direction: column; gap: 5px; justify-content: center; min-width: 0; }
  .wfree { font-size: 13px; opacity: .58; }
  .wev { display: grid; grid-template-columns: 3px 44px 1fr; gap: 8px; align-items: center; font-size: 13.5px; }

  .head, .qhead { font-size: 13px; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 7px; }
  .head { justify-content: space-between; }
  .calendar-button { width: 28px; height: 28px; border-radius: 9px; margin: -5px -5px -5px 0; }
  .empty, .none { font-size: 14px; opacity: .45; padding: 2px 0 4px; }
  .ev { display: grid; grid-template-columns: 4px 74px 1fr; gap: 10px; align-items: center; padding: 6px 0; font-size: 15px; cursor: pointer; }
  .ev + .ev { border-top: .5px solid rgba(255,255,255,.1); }
  .bar { width: 4px; height: 20px; border-radius: 2px; }
  .wev .bar { width: 3px; height: 15px; }
  .etime { font-variant-numeric: tabular-nums; opacity: .6; font-weight: 500; }
  .etitle { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .notes { display: block; width: 100%; box-sizing: border-box; margin-top: 8px; resize: none; overflow: hidden; min-height: 40px;
           background: rgba(255,255,255,.07); border: 0; border-radius: 12px; padding: 9px 11px; color: #fff;
           font-family: inherit; font-size: 14.5px; font-weight: 500; line-height: 1.4; outline: none; }
  .notes:focus { background: rgba(255,255,255,.13); }
  .notes::placeholder { color: rgba(255,255,255,.4); }

  .matrix { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .quad { min-height: 118px; padding: 13px 14px; }
  .matrix.compact .quad { min-height: 0; padding: 11px 12px; border-radius: 22px; }
  .dot { width: 8px; height: 8px; border-radius: 4px; }
  .count { margin-left: auto; font-variant-numeric: tabular-nums; opacity: .7; }
  .add { border: 0; background: rgba(255,255,255,.16); color: #fff; width: 22px; height: 22px; border-radius: 11px; font-size: 15px; line-height: 22px; padding: 0; cursor: pointer; margin-left: 4px; }
  .add:hover { background: rgba(255,255,255,.3); }
  .task { display: flex; gap: 8px; align-items: flex-start; width: 100%; border: 0; background: none; color: inherit; text-align: left; font-family: inherit; font-size: 14px; font-weight: 500; padding: 4px 0; cursor: pointer; line-height: 1.3; }
  .ttext { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .compact .task { font-size: 13px; white-space: nowrap; }
  .check { flex: none; width: 13px; height: 13px; margin-top: 2px; border-radius: 7px; border: 1.5px solid rgba(255,255,255,.55); }
  .task:hover .check { background: rgba(255,255,255,.55); }
  .completed { margin-top: 9px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.16); }
  .completed-title { display: flex; align-items: center; font-size: 11px; font-weight: 600; opacity: .72; margin-bottom: 3px; }
  .clear-done { margin-left: auto; border: 0; background: none; color: inherit; font: inherit; opacity: 0; cursor: pointer; padding: 0; }
  .completed:hover .clear-done, .clear-done:focus-visible { opacity: .8; }
  .clear-done:hover { opacity: 1; text-decoration: underline; }
  .completed-list { max-height: 92px; overflow-y: auto; }
  .task.done { opacity: .8; }
  .task.done .check { background: #a8e7c4; border-color: #a8e7c4; color: #152a20; display: grid; place-items: center; font-size: 10px; font-weight: 700; }
  .task.done .ttext { text-decoration: line-through; text-decoration-color: rgba(255,255,255,.55); }
  .input { width: 100%; box-sizing: border-box; background: rgba(255,255,255,.14); border: 0; border-radius: 9px; padding: 7px 9px; color: #fff;
           font-family: inherit; font-size: 14px; font-weight: 500; outline: none; margin-top: 4px; }
  .input::placeholder { color: rgba(255,255,255,.45); }
  @media (prefers-reduced-transparency: reduce) { .glass, .effect-soft .glass, .tool, .calendar-button { -webkit-backdrop-filter: none; backdrop-filter: none; } .glass { background: rgba(26,33,45,.94); } }
  @media (prefers-contrast: more) { .glass { background: rgba(18,24,35,.96); border-color: rgba(255,255,255,.55); } }
  @media (prefers-reduced-motion: reduce) { .toolbar, .edit-tools { transition: none; } }
`;
