/**
 * Heating Card – custom Lovelace card for Home Assistant
 * Schematic of a heating installation: buffer tank, radiators,
 * wood stove and gas boiler with live temperatures and animated flow.
 */
const VERSION = "1.0.0";

const DEFAULTS = {
  decimals: 1,
  min_temp: 20,
  max_temp: 60,
  cold_color: "#2f80ed",
  hot_color: "#eb3b3b",
};

const ON_STATES = ["on", "heat", "heating", "running", "active", "true", "open"];

/* ---------- helpers ---------- */

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function hexToRgb(hex) {
  let h = String(hex).trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (Number.isNaN(n) || h.length !== 6) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixColor(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** Accepts "sensor.x" or { entity: "sensor.x", name: "..." }. */
const toEntityConf = (e) => (typeof e === "string" ? { entity: e } : e && e.entity ? e : null);

/* ---------- card ---------- */

class HeatingCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._signature = null;
    this.shadowRoot.addEventListener("click", (ev) => {
      const target = ev.composedPath().find((el) => el.dataset && el.dataset.entity);
      if (target) this._moreInfo(target.dataset.entity);
    });
  }

  setConfig(config) {
    if (!config || typeof config !== "object") throw new Error("Ongeldige configuratie");
    const c = JSON.parse(JSON.stringify(config));
    // backwards compatibility: "heat_pump" was renamed to "boiler"
    if (!c.boiler && c.heat_pump) c.boiler = c.heat_pump;
    delete c.heat_pump;
    const buffer = c.buffer || {};
    this._config = {
      ...DEFAULTS,
      ...c,
      buffer: {
        name: buffer.name,
        entities: (buffer.entities || []).map(toEntityConf).filter(Boolean),
      },
    };
    this._signature = null;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 5;
  }

  getGridOptions() {
    return { columns: 12, rows: 5, min_columns: 6, min_rows: 3 };
  }

  static getStubConfig(hass) {
    const sensors = Object.keys(hass?.states || {}).filter((e) => e.startsWith("sensor.") && e.includes("buffer"));
    return {
      title: "Verwarming",
      buffer: { entities: sensors.slice(0, 4) },
      radiators: { name: "Radiatoren" },
      stove: { name: "Haard" },
      boiler: { name: "CV-ketel" },
    };
  }

  static getConfigForm() {
    const ent = (name, domain) => ({ name, selector: { entity: domain ? { domain } : {} } });
    const txt = (name) => ({ name, selector: { text: {} } });
    return {
      schema: [
        txt("title"),
        {
          name: "",
          type: "grid",
          schema: [
            { name: "min_temp", selector: { number: { min: -20, max: 100, mode: "box", unit_of_measurement: "°C" } } },
            { name: "max_temp", selector: { number: { min: 0, max: 120, mode: "box", unit_of_measurement: "°C" } } },
            { name: "cold_color", selector: { text: {} } },
            { name: "hot_color", selector: { text: {} } },
            { name: "decimals", selector: { number: { min: 0, max: 3, mode: "box" } } },
          ],
        },
        {
          name: "buffer",
          type: "expandable",
          title: "Buffervat",
          icon: "mdi:storage-tank",
          schema: [txt("name"), { name: "entities", selector: { entity: { multiple: true, domain: "sensor" } } }],
        },
        {
          name: "radiators",
          type: "expandable",
          title: "Radiatoren",
          icon: "mdi:radiator",
          schema: [txt("name"), ent("temperature", "sensor"), ent("pump")],
        },
        {
          name: "stove",
          type: "expandable",
          title: "Haard",
          icon: "mdi:fireplace",
          schema: [txt("name"), ent("temperature", "sensor"), ent("pump"), ent("active")],
        },
        {
          name: "boiler",
          type: "expandable",
          title: "CV-ketel",
          icon: "mdi:water-boiler",
          schema: [txt("name"), ent("temperature", "sensor"), ent("outdoor", "sensor"), ent("active")],
        },
      ],
      computeLabel: (s) =>
        ({
          title: "Titel",
          name: "Naam",
          min_temp: "Koudste temperatuur (blauw)",
          max_temp: "Warmste temperatuur (rood)",
          cold_color: "Kleur koud",
          hot_color: "Kleur warm",
          decimals: "Decimalen",
          entities: "Buffersensoren (van boven naar onder)",
          temperature: "Temperatuur",
          outdoor: "Buitentemperatuur",
          pump: "Pomp",
          active: "Actief",
        })[s.name],
    };
  }

  /* ---------- state helpers ---------- */

  _state(entityId) {
    return entityId ? this._hass?.states?.[entityId] : undefined;
  }

  _num(entityId) {
    const s = this._state(entityId);
    if (!s) return null;
    const n = parseFloat(s.state);
    return Number.isFinite(n) ? n : null;
  }

  _isOn(entityId) {
    const s = this._state(entityId);
    if (!s) return false;
    if (ON_STATES.includes(String(s.state).toLowerCase())) return true;
    const n = parseFloat(s.state);
    return Number.isFinite(n) && n > 0;
  }

  _fmt(entityId) {
    const s = this._state(entityId);
    if (!s || s.state === "unavailable" || s.state === "unknown") return "—";
    const n = parseFloat(s.state);
    if (!Number.isFinite(n)) {
      return this._hass.formatEntityState ? this._hass.formatEntityState(s) : s.state;
    }
    const d = Number(this._config.decimals);
    const value = n.toLocaleString(this._hass.locale?.language || undefined, {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });
    const unit = s.attributes?.unit_of_measurement;
    return unit ? `${value}${unit === "%" ? "" : " "}${unit}` : value;
  }

  _name(conf, fallback) {
    if (conf?.name) return conf.name;
    const s = this._state(conf?.entity);
    return s?.attributes?.friendly_name || fallback || "";
  }

  _color(temp) {
    const { min_temp, max_temp, cold_color, hot_color } = this._config;
    if (temp === null || temp === undefined) return mixColor(cold_color, hot_color, 0.5);
    const range = Number(max_temp) - Number(min_temp) || 1;
    const t = Math.min(1, Math.max(0, (temp - Number(min_temp)) / range));
    return mixColor(cold_color, hot_color, t);
  }

  _moreInfo(entityId) {
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId };
    this.dispatchEvent(ev);
  }

  /** Only re-render when one of our entities changes, so animations keep running smoothly. */
  _relevantEntities() {
    const c = this._config;
    const list = c.buffer.entities.map((e) => e.entity);
    for (const key of ["radiators", "stove", "boiler"]) {
      const sec = c[key];
      if (sec) for (const f of ["temperature", "pump", "active", "outdoor"]) if (sec[f]) list.push(sec[f]);
    }
    return list;
  }

  /* ---------- rendering ---------- */

  _render() {
    if (!this._config || !this._hass) return;
    const sig = JSON.stringify([
      this._hass.locale?.language,
      this._relevantEntities().map((e) => {
        const s = this._state(e);
        return s ? [s.state, s.attributes?.unit_of_measurement, s.attributes?.friendly_name] : null;
      }),
    ]);
    if (sig === this._signature) return;
    this._signature = sig;

    const c = this._config;
    const title = c.title ? `<h1 class="card-header">${esc(c.title)}</h1>` : "";
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <ha-card>
        ${title}
        <div class="wrap">${this._svg()}</div>
      </ha-card>`;
  }

  _svg() {
    const c = this._config;
    const rad = c.radiators;
    const stove = c.stove;
    const boiler = c.boiler;

    const bufTemps = c.buffer.entities.map((e) => this._num(e.entity));
    const known = bufTemps.filter((t) => t !== null);
    const topTemp = known.length ? known[0] : null;
    const bottomTemp = known.length ? known[known.length - 1] : null;
    const hot = topTemp !== null ? this._color(topTemp) : c.hot_color;
    const cold = bottomTemp !== null ? this._color(bottomTemp) : c.cold_color;

    // Buffer geometry
    const B = { x: 180, y: 50, w: 64, h: 180 };
    const cx = B.x + B.w / 2;

    const parts = { pipes: "", devices: "", labels: "" };

    /* --- radiators --- */
    if (rad) {
      const on = this._isOn(rad.pump);
      parts.pipes += pipe("M212 50 V34 H122", hot, on);
      parts.pipes += pipe("M40 48 H18 V238 H212 V226", cold, on);
      parts.devices += this._radiator(40, 18, 82, 42, rad, on);
      if (rad.pump) parts.devices += pump(156, 34, on, rad.pump, "left");
      parts.labels += this._label(81, -8, rad, "Radiatoren", "middle");
    }

    /* --- stove --- */
    if (stove) {
      const pumpOn = this._isOn(stove.pump);
      const fire = stove.active ? this._isOn(stove.active) : pumpOn;
      parts.pipes += pipe("M108 124 H180", hot, pumpOn);
      parts.pipes += pipe("M180 194 H108", cold, pumpOn);
      parts.devices += this._stove(40, 106, 68, 112, stove, fire);
      if (stove.pump) parts.devices += pump(146, 124, pumpOn, stove.pump, "right");
    }

    /* --- gas boiler (wall-hung) --- */
    if (boiler) {
      const on = boiler.active ? this._isOn(boiler.active) : false;
      parts.pipes += pipe("M326 162 V176 H272 V96 H244", hot, on);
      parts.pipes += pipe("M244 194 H366 V162", cold, on);
      parts.devices += this._boiler(306, 26, 80, 136, boiler, on);
      if (boiler.outdoor) {
        parts.labels += this._label(346, -8, { entity: boiler.outdoor, name: "Buiten" }, "Buiten", "middle", true);
      }
    }

    /* --- buffer --- */
    parts.devices += this._buffer(B, c.buffer.entities, bufTemps, cx);

    return `
      <svg viewBox="0 -22 420 266" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(c.title || "Verwarming")}">
        <g class="pipes">${parts.pipes}</g>
        <g class="devices">${parts.devices}</g>
        <g class="labels">${parts.labels}</g>
      </svg>`;
  }

  _label(x, y, conf, fallback, anchor = "middle", forceName = false) {
    const entity = conf.entity || conf.temperature;
    if (!entity) {
      return `<text x="${x}" y="${y}" text-anchor="${anchor}" class="lbl-name">${esc(conf.name || fallback)}</text>`;
    }
    const name = forceName ? conf.name : this._name({ name: conf.name }, fallback);
    return `
      <g class="clickable" data-entity="${esc(entity)}">
        <text x="${x}" y="${y}" text-anchor="${anchor}" class="lbl-name">${esc(name)}</text>
        <text x="${x}" y="${y + 14}" text-anchor="${anchor}" class="lbl-value">${esc(this._fmt(entity))}</text>
      </g>`;
  }

  _radiator(x, y, w, h, conf, on) {
    const temp = this._num(conf.temperature);
    const fill = on || temp !== null ? this._color(temp) : "var(--hc-device)";
    const fins = 8;
    const gap = 3;
    const fw = (w - 8 - gap * (fins - 1)) / fins;
    let finSvg = "";
    for (let i = 0; i < fins; i++) {
      finSvg += `<rect x="${x + 4 + i * (fw + gap)}" y="${y + 4}" width="${fw}" height="${h - 8}" rx="${fw / 2}"
        fill="${on ? fill : "var(--hc-device)"}" class="fin ${on ? "warm" : ""}" />`;
    }
    const entity = conf.temperature || conf.pump;
    return `
      <g class="${entity ? "clickable" : ""}" ${entity ? `data-entity="${esc(entity)}"` : ""}>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" class="body" />
        ${finSvg}
        <rect x="${x + 6}" y="${y + h}" width="5" height="5" class="foot" />
        <rect x="${x + w - 11}" y="${y + h}" width="5" height="5" class="foot" />
      </g>`;
  }

  _stove(x, y, w, h, conf, fire) {
    const entity = conf.temperature || conf.active || conf.pump;
    const win = { x: x + 9, y: y + 20, w: w - 18, h: 50 };
    const fx = win.x + win.w / 2;
    const fb = win.y + win.h - 4;
    const flames = fire
      ? `<g class="flames">
          <path class="flame f1" d="M${fx - 12} ${fb} C${fx - 20} ${fb - 14} ${fx - 8} ${fb - 22} ${fx - 6} ${fb - 34} C${fx + 2} ${fb - 22} ${fx + 4} ${fb - 12} ${fx} ${fb} Z" />
          <path class="flame f2" d="M${fx - 4} ${fb} C${fx - 8} ${fb - 16} ${fx + 6} ${fb - 26} ${fx + 6} ${fb - 40} C${fx + 16} ${fb - 24} ${fx + 18} ${fb - 10} ${fx + 12} ${fb} Z" />
          <path class="flame f3" d="M${fx - 6} ${fb} C${fx - 8} ${fb - 8} ${fx} ${fb - 14} ${fx + 2} ${fb - 22} C${fx + 8} ${fb - 12} ${fx + 8} ${fb - 6} ${fx + 6} ${fb} Z" />
        </g>
        <rect x="${win.x}" y="${win.y}" width="${win.w}" height="${win.h}" rx="4" class="glow" />`
      : "";
    const temp = conf.temperature
      ? `<text x="${x + w / 2}" y="${y + h - 22}" text-anchor="middle" class="dev-value">${esc(this._fmt(conf.temperature))}</text>`
      : "";
    return `
      <g class="${entity ? "clickable" : ""}" ${entity ? `data-entity="${esc(entity)}"` : ""}>
        <rect x="${x + 6}" y="${y - 8}" width="${w - 12}" height="10" rx="3" class="body" />
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" class="body" />
        <rect x="${win.x}" y="${win.y}" width="${win.w}" height="${win.h}" rx="4" class="window" />
        ${flames}
        <line x1="${x + 6}" x2="${x + w - 6}" y1="${y + h - 38}" y2="${y + h - 38}" class="trim" />
        ${temp}
        <text x="${x + w / 2}" y="${y + h - 8}" text-anchor="middle" class="dev-name">${esc(this._name({ name: conf.name, entity: conf.active }, "Haard"))}</text>
      </g>`;
  }

  _boiler(x, y, w, h, conf, on) {
    const entity = conf.active || conf.temperature;
    const fx = x + w / 2;
    const fb = y + 100;
    const display = conf.temperature ? this._fmt(conf.temperature) : conf.active ? (on ? "AAN" : "UIT") : "--";
    return `
      <g class="${entity ? "clickable" : ""}" ${entity ? `data-entity="${esc(entity)}"` : ""}>
        <rect x="${x + 6}" y="${y - 6}" width="${w - 12}" height="8" rx="2" class="foot" />
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" class="body" />
        <text x="${fx}" y="${y + 15}" text-anchor="middle" class="dev-name">${esc(this._name({ name: conf.name, entity: conf.active }, "CV-ketel"))}</text>
        <rect x="${x + 12}" y="${y + 23}" width="${w - 24}" height="24" rx="3" class="display" />
        <text x="${fx}" y="${y + 40}" text-anchor="middle" class="display-text">${esc(display)}</text>
        <g class="boiler-flame ${on ? "on" : ""}">
          <path class="flame ${on ? "f1" : ""}" d="M${fx - 9} ${fb} C${fx - 15} ${fb - 10} ${fx - 6} ${fb - 18} ${fx - 3} ${fb - 28} C${fx + 4} ${fb - 18} ${fx + 14} ${fb - 12} ${fx + 9} ${fb} Z" />
          ${on ? `<path class="flame f3" d="M${fx - 4} ${fb} C${fx - 6} ${fb - 6} ${fx} ${fb - 11} ${fx + 1} ${fb - 16} C${fx + 5} ${fb - 9} ${fx + 6} ${fb - 4} ${fx + 4} ${fb} Z" />` : ""}
          <line x1="${fx - 16}" x2="${fx + 16}" y1="${fb + 3}" y2="${fb + 3}" class="burner" />
        </g>
        <rect x="${x + 1}" y="${y + h - 26}" width="${w - 2}" height="25" rx="6" class="panel" />
        <circle cx="${x + 16}" cy="${y + h - 13}" r="4.5" class="knob" />
        <circle cx="${x + 32}" cy="${y + h - 13}" r="4.5" class="knob" />
        <circle cx="${x + w - 14}" cy="${y + h - 13}" r="3" class="led ${on ? "on" : ""}" />
      </g>`;
  }

  _buffer(B, entities, temps, cx) {
    const n = entities.length;
    const pad = 22;
    const ys = entities.map((_, i) => (n === 1 ? B.y + B.h / 2 : B.y + pad + (i * (B.h - 2 * pad)) / (n - 1)));

    let stops;
    if (n === 0) {
      stops = `<stop offset="0" stop-color="${this._config.hot_color}"/><stop offset="1" stop-color="${this._config.cold_color}"/>`;
    } else {
      stops = entities
        .map((_, i) => `<stop offset="${((ys[i] - B.y) / B.h).toFixed(3)}" stop-color="${this._color(temps[i])}" />`)
        .join("");
    }

    const pills = entities
      .map(
        (e, i) => `
        <g class="clickable" data-entity="${esc(e.entity)}">
          <title>${esc(this._name(e, e.entity))}</title>
          <rect x="${cx - 29}" y="${ys[i] - 10}" width="58" height="20" rx="10" class="pill" />
          <text x="${cx}" y="${ys[i] + 4.5}" text-anchor="middle" class="pill-text">${esc(this._fmt(e.entity))}</text>
        </g>`
      )
      .join("");

    const name = this._config.buffer.name
      ? `<text x="${cx}" y="${B.y + B.h + 18}" text-anchor="middle" class="dev-name">${esc(this._config.buffer.name)}</text>`
      : "";

    return `
      <defs>
        <linearGradient id="hc-buf" x1="0" y1="${B.y}" x2="0" y2="${B.y + B.h}" gradientUnits="userSpaceOnUse">${stops}</linearGradient>
        <linearGradient id="hc-gloss" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color="#000" stop-opacity="0.25" />
          <stop offset="0.3" stop-color="#fff" stop-opacity="0.22" />
          <stop offset="0.55" stop-color="#fff" stop-opacity="0" />
          <stop offset="1" stop-color="#000" stop-opacity="0.3" />
        </linearGradient>
      </defs>
      <rect x="${B.x}" y="${B.y}" width="${B.w}" height="${B.h}" rx="22" fill="url(#hc-buf)" />
      <rect x="${B.x}" y="${B.y}" width="${B.w}" height="${B.h}" rx="22" fill="url(#hc-gloss)" class="tank-outline" />
      ${pills}
      ${name}`;
  }
}

/* ---------- small svg builders ---------- */

function pipe(d, color, flowing) {
  return `
    <path d="${d}" class="pipe-shadow" />
    <path d="${d}" class="pipe" stroke="${color}" />
    ${flowing ? `<path d="${d}" class="flow" />` : ""}`;
}

function pump(x, y, on, entity, dir) {
  // Impeller with curved blades; spins (in the direction of flow) while the pump runs.
  const blade = (a) => `<path d="M0 0 C 1.5 -3.5, 5 -6, 7.5 -3.5 C 5 -2, 2.5 -0.5, 0 0 Z" transform="rotate(${a})" />`;
  const blades = [0, 72, 144, 216, 288].map(blade).join("");
  const flip = dir === "left" ? "scale(-1 1)" : "";
  return `
    <g class="clickable pump ${on ? "on" : ""}" data-entity="${esc(entity)}">
      ${on ? `<circle cx="${x}" cy="${y}" r="10" class="pump-pulse" />` : ""}
      <circle cx="${x}" cy="${y}" r="10" class="pump-body" />
      <g transform="translate(${x} ${y}) ${flip}">
        <g class="impeller ${on ? "spin" : ""}">${blades}<circle r="1.8" class="impeller-hub" /></g>
      </g>
    </g>`;
}

const STYLES = `
  :host {
    --hc-device: var(--heating-card-device-color, #dfe3e8);
    --hc-device-stroke: var(--heating-card-device-stroke, #9aa3ad);
    --hc-pump-on: var(--heating-card-pump-on-color, #43a047);
    --hc-text: var(--primary-text-color, #212121);
    --hc-text-2: var(--secondary-text-color, #727272);
  }
  ha-card { overflow: hidden; }
  .card-header { margin: 0; padding: 16px 16px 0; font-size: 20px; font-weight: 400; color: var(--ha-card-header-color, var(--hc-text)); }
  .wrap { padding: 8px 12px 12px; }
  svg { display: block; width: 100%; height: auto; font-family: var(--paper-font-body1_-_font-family, inherit); }

  .clickable { cursor: pointer; }
  .clickable:hover { filter: brightness(1.08); }

  .pipe-shadow { fill: none; stroke: rgba(0,0,0,.18); stroke-width: 9; stroke-linecap: round; stroke-linejoin: round; }
  .pipe { fill: none; stroke-width: 6; stroke-linecap: round; stroke-linejoin: round; transition: stroke .6s; }
  .flow {
    fill: none; stroke: rgba(255,255,255,.75); stroke-width: 2; stroke-linecap: round;
    stroke-dasharray: 2 10; animation: hc-flow 0.9s linear infinite;
  }
  @keyframes hc-flow { to { stroke-dashoffset: -12; } }

  .body { fill: var(--hc-device); stroke: var(--hc-device-stroke); stroke-width: 1.2; }
  .foot { fill: var(--hc-device-stroke); }
  .trim { stroke: var(--hc-device-stroke); stroke-width: 1.2; stroke-linecap: round; }
  .fin { stroke: var(--hc-device-stroke); stroke-width: .8; transition: fill .6s; }
  .fin.warm { stroke: rgba(0,0,0,.15); }

  .window { fill: #2b2b2e; stroke: var(--hc-device-stroke); stroke-width: 1.2; }
  .glow { fill: rgba(255,140,0,.18); }
  .flame { transform-box: fill-box; transform-origin: 50% 100%; }
  .f1 { fill: #ff6d00; animation: hc-flicker 1.1s ease-in-out infinite alternate; }
  .f2 { fill: #ff9100; animation: hc-flicker 0.8s ease-in-out infinite alternate-reverse; }
  .f3 { fill: #ffd54f; animation: hc-flicker 0.6s ease-in-out infinite alternate; }
  @keyframes hc-flicker {
    0% { transform: scale(1, 1) skewX(0deg); opacity: .95; }
    50% { transform: scale(.92, 1.08) skewX(3deg); opacity: 1; }
    100% { transform: scale(1.05, .9) skewX(-3deg); opacity: .85; }
  }

  .display { fill: #1d262c; stroke: rgba(0,0,0,.4); stroke-width: 1; }
  .display-text { fill: #8fe3ff; font-size: 12px; font-weight: 600; letter-spacing: .03em; }
  .boiler-flame .flame { fill: var(--hc-device-stroke); opacity: .55; }
  .boiler-flame.on .flame { opacity: 1; }
  .boiler-flame.on .f1 { fill: #2979ff; }
  .boiler-flame.on .f3 { fill: #80d8ff; }
  .burner { stroke: var(--hc-device-stroke); stroke-width: 2.5; stroke-linecap: round; }
  .panel { fill: rgba(0,0,0,.08); }
  .knob { fill: var(--card-background-color, #fff); stroke: var(--hc-device-stroke); stroke-width: 1.2; }
  .led { fill: var(--hc-device-stroke); }
  .led.on { fill: var(--hc-pump-on); filter: drop-shadow(0 0 3px var(--hc-pump-on)); }

  .tank-outline { stroke: rgba(0,0,0,.25); stroke-width: 1.2; }
  .pill { fill: rgba(0,0,0,.28); }
  .pill-text { fill: #fff; font-size: 12px; font-weight: 600; }

  .pump-body { fill: var(--card-background-color, #fff); stroke: var(--hc-device-stroke); stroke-width: 1.5; }
  .impeller { fill: var(--hc-device-stroke); }
  .impeller-hub { fill: var(--card-background-color, #fff); }
  .impeller.spin { animation: hc-spin 0.9s linear infinite; }
  @keyframes hc-spin { to { transform: rotate(360deg); } }
  .pump.on .pump-body { stroke: var(--hc-pump-on); }
  .pump.on .impeller { fill: var(--hc-pump-on); }
  .pump-pulse { fill: none; stroke: var(--hc-pump-on); stroke-width: 2; transform-box: fill-box; transform-origin: center; animation: hc-pulse 1.6s ease-out infinite; }
  @keyframes hc-pulse { from { transform: scale(1); opacity: .7; } to { transform: scale(1.9); opacity: 0; } }

  .lbl-name { fill: var(--hc-text-2); font-size: 9.5px; letter-spacing: .02em; }
  .lbl-value { fill: var(--hc-text); font-size: 13px; font-weight: 600; }
  .dev-name { fill: #555b63; font-size: 9px; }
  .dev-value { fill: #2b2f33; font-size: 12px; font-weight: 600; }

  @media (prefers-reduced-motion: reduce) {
    .flow, .flame, .pump-pulse, .impeller.spin { animation: none; }
  }
`;

customElements.define("heating-card", HeatingCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "heating-card",
  name: "Heating Card",
  description: "Schema van je verwarmingsinstallatie: buffervat, radiatoren, haard en CV-ketel.",
  preview: true,
  documentationURL: "https://github.com/vermeerschn/homeassistant-heating-card",
});

console.info(`%c HEATING-CARD %c v${VERSION} `, "color:#fff;background:#eb3b3b;font-weight:700", "color:#eb3b3b;background:#fff");
