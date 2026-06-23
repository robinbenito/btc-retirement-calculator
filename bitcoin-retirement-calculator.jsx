import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  AreaChart, Area, LineChart, Line, ComposedChart, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea, CartesianGrid, ReferenceDot,
} from "recharts";

/* ──────────────────────────────────────────────────────────────
   PALETTE & TYPE  —  "quant terminal meets editorial finance"
   ────────────────────────────────────────────────────────────── */
const C = {
  bg:"#0E0B07", panel:"#16120B", panel2:"#1D180F", line:"#2C2417",
  ink:"#EDE4D2", inkDim:"#9C9077", inkFaint:"#5E563F",
  orange:"#F7931A", gold:"#E8BE5C", blue:"#5FB0C9",
  green:"#7FB069", red:"#D9685B",
};

const GENESIS = new Date("2009-01-03T00:00:00Z");
const MS_DAY = 86400000;
const daysNow = (Date.now() - GENESIS.getTime()) / MS_DAY;
const STORE_KEY = "btc-calc:scenarios";

const fmtMoney = (n, sym) => {
  if (!isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e12) return `${sym}${(n/1e12).toFixed(2)}T`;
  if (a >= 1e9)  return `${sym}${(n/1e9).toFixed(2)}B`;
  if (a >= 1e6)  return `${sym}${(n/1e6).toFixed(2)}M`;
  if (a >= 1e3)  return `${sym}${(n/1e3).toFixed(1)}K`;
  return `${sym}${Math.round(n).toLocaleString()}`;
};
const fmtBtc = (n) => (n >= 1 ? `₿${n.toFixed(3)}` : `₿${n.toFixed(4)}`);
const fmtSats = (n) => `${Math.round(n).toLocaleString()} sats`;
const SATS = 1e8;

/* ── Country / currency + asset inflation presets ───────────────── */
/* wb = World Bank ISO3 used for the live CPI feed (EMU = euro-area aggregate). */
const COUNTRIES = {
  US: { flag:"🇺🇸", label:"USA",         cur:"$",   cgCode:"usd", wb:"USA", assetInfl:{ car:0.055, realestate:0.06,  boat:0.05, travel:0.04,  general:0.03  } },
  EU: { flag:"🇪🇺", label:"Eurozone",    cur:"€",   cgCode:"eur", wb:"EMU", euro:true, assetInfl:{ car:0.045, realestate:0.055, boat:0.045,travel:0.035, general:0.025 } },
  GB: { flag:"🇬🇧", label:"UK",          cur:"£",   cgCode:"gbp", wb:"GBR", assetInfl:{ car:0.05,  realestate:0.065, boat:0.05, travel:0.045, general:0.035 } },
  CA: { flag:"🇨🇦", label:"Canada",      cur:"CA$", cgCode:"cad", wb:"CAN", assetInfl:{ car:0.055, realestate:0.07,  boat:0.05, travel:0.04,  general:0.035 } },
  AU: { flag:"🇦🇺", label:"Australia",   cur:"A$",  cgCode:"aud", wb:"AUS", assetInfl:{ car:0.05,  realestate:0.07,  boat:0.05, travel:0.04,  general:0.035 } },
  CH: { flag:"🇨🇭", label:"Switzerland", cur:"CHF", cgCode:"chf", wb:"CHE", assetInfl:{ car:0.035, realestate:0.045, boat:0.035,travel:0.03,  general:0.015 } },
  JP: { flag:"🇯🇵", label:"Japan",       cur:"¥",   cgCode:"jpy", wb:"JPN", assetInfl:{ car:0.02,  realestate:0.03,  boat:0.02, travel:0.02,  general:0.01  } },
};

/* Euro-area members selectable in the inflation workspace. wb = World Bank ISO3 (per-country
   headline CPI); geo = Eurostat code (per-COICOP basket). */
const EURO_GEOS = {
  DE: { label:"Germany",     wb:"DEU", geo:"DE" },
  FR: { label:"France",      wb:"FRA", geo:"FR" },
  IT: { label:"Italy",       wb:"ITA", geo:"IT" },
  ES: { label:"Spain",       wb:"ESP", geo:"ES" },
  NL: { label:"Netherlands", wb:"NLD", geo:"NL" },
  AT: { label:"Austria",     wb:"AUT", geo:"AT" },
  BE: { label:"Belgium",     wb:"BEL", geo:"BE" },
  PT: { label:"Portugal",    wb:"PRT", geo:"PT" },
  IE: { label:"Ireland",     wb:"IRL", geo:"IE" },
  FI: { label:"Finland",     wb:"FIN", geo:"FI" },
  GR: { label:"Greece",      wb:"GRC", geo:"EL" },
};

/* Savings goal presets — coicop maps to DE basket category for personalised inflation */
const GOAL_PRESETS = {
  car:        { label:"Car (new)",    emoji:"🚗", coicop:"07" },
  realestate: { label:"Real estate",  emoji:"🏠", coicop:"04" },
  boat:       { label:"Boat",         emoji:"⛵", coicop:"09" },
  travel:     { label:"Travel",       emoji:"✈️", coicop:"11" },
  general:    { label:"General",      emoji:"📦", coicop:null },
  custom:     { label:"Custom",       emoji:"✏️", coicop:null },
};

/* ── Personal inflation data — Destatis DE, COICOP 2020=100 ─────── */
const PI_YEARS = [2020, 2021, 2022, 2023, 2024, 2025];
const PI_CATS = [
  { code:"01", en:"Food & non-alcoholic drinks", de:"Nahrungsmittel & alkoholfreie Getränke", w:11.9, s:[100,103.1,116.0,130.3,132.8,136.2] },
  { code:"02", en:"Alcohol & tobacco",           de:"Alkohol & Tabakwaren",                  w:3.7,  s:[100,103.5,107.9,117.1,122.3,126.3] },
  { code:"03", en:"Clothing & footwear",         de:"Bekleidung & Schuhe",                   w:4.0,  s:[100,101.5,102.3,106.1,109.3,110.2] },
  { code:"04", en:"Housing, water & energy",     de:"Wohnung, Wasser, Strom, Gas",           w:25.9, s:[100,101.7,109.1,114.5,115.9,117.5] },
  { code:"05", en:"Furnishings & household",     de:"Möbel & Haushaltszubehör",              w:6.8,  s:[100,102.7,110.5,117.6,118.0,118.0] },
  { code:"06", en:"Health",                      de:"Gesundheit",                            w:5.5,  s:[100,100.5,101.8,104.9,107.8,110.8] },
  { code:"07", en:"Transport",                   de:"Verkehr",                               w:13.8, s:[100,107.7,120.0,123.6,124.8,127.1] },
  { code:"08", en:"Post & telecom",              de:"Post & Telekommunikation",              w:2.3,  s:[100,99.4, 99.4, 99.8, 99.1, 98.4]  },
  { code:"09", en:"Recreation & culture",        de:"Freizeit, Unterhaltung & Kultur",       w:10.8, s:[100,102.9,107.9,114.0,116.1,117.6] },
  { code:"10", en:"Education",                   de:"Bildungswesen",                         w:0.9,  s:[100,102.5,104.9,108.9,114.3,119.8] },
  { code:"11", en:"Restaurants & hotels",        de:"Gaststätten & Beherbergung",            w:4.5,  s:[100,102.7,110.5,119.5,126.9,131.7] },
  { code:"12", en:"Other goods & services",      de:"Andere Waren & Dienstleistungen",       w:9.9,  s:[100,103.8,106.1,113.0,120.2,127.0] },
];
const PI_HEADLINE = [100, 103.1, 110.2, 116.7, 119.3, 121.9];
const PI_PRESETS = {
  official: Object.fromEntries(PI_CATS.map(c => [c.code, c.w])),
  foodrent: { "01":22,"02":3,"03":3,"04":34,"05":5,"06":5,"07":6,"08":3,"09":7,"10":1,"11":2,"12":9 },
  car:      { "01":12,"02":3,"03":4,"04":24,"05":6,"06":5,"07":22,"08":2,"09":9,"10":1,"11":4,"12":8 },
  even:     Object.fromEntries(PI_CATS.map(c => [c.code, +(100/12).toFixed(2)])),
};
/* Embedded fallback if the live feed is unreachable: DE COICOP 2020=100 indices extended
   back to 2010 (rebased from Destatis 2015=100 series). Headline & per-category. */
const PI_FALLBACK_YEARS = [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const PI_FALLBACK_HEADLINE = [88.6, 90.5, 92.3, 93.7, 94.6, 95.0, 95.4, 96.8, 98.5, 99.9, 100, 103.1, 110.2, 116.7, 119.3, 121.9];

/* ── Live inflation feed ──────────────────────────────────────────
   Headline CPI for every selectable country/region comes from the World Bank
   (indicator FP.CPI.TOTL, annual, back to 2010). Per-COICOP basket detail for the
   euro area comes from Eurostat (prc_hicp_aind). Both degrade to embedded data. */
const annualizedRate = (idx, y0, y1) =>
  (idx[y0] > 0 && idx[y1] > 0 && y1 > y0) ? Math.pow(idx[y1] / idx[y0], 1 / (y1 - y0)) - 1 : 0;

/* "Verify, don't trust" — every inflation figure links back to its primary source (#8). */
const DESTATIS_URL = "https://www-genesis.destatis.de/genesis/online?operation=table&code=61111-0001";
const DATA_SOURCE_URLS = {
  "World Bank":        "https://data.worldbank.org/indicator/FP.CPI.TOTL",
  "Eurostat":          "https://ec.europa.eu/eurostat/databrowser/view/prc_hicp_aind/default/table",
  "Destatis (offline)":DESTATIS_URL,
  "Destatis DE proxy": DESTATIS_URL,
  "CoinGecko":         "https://www.coingecko.com/en/coins/bitcoin",
};
const sourceUrlFor = (name) => DATA_SOURCE_URLS[name] || DATA_SOURCE_URLS[String(name).replace(/\s*\(offline\)$/, "")];

async function fetchWorldBankCPI(iso3List) {
  const codes = iso3List.join(";");
  const url = `https://api.worldbank.org/v2/country/${codes}/indicator/FP.CPI.TOTL?format=json&per_page=5000&date=2010:2025`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("world bank " + r.status);
  const j = await r.json();
  const rows = Array.isArray(j) && Array.isArray(j[1]) ? j[1] : [];
  const out = {};
  for (const row of rows) {
    if (row.value == null) continue;
    // aggregates (euro area) report the code in country.id rather than countryiso3code
    const key = row.countryiso3code || row.country?.id;
    if (!key) continue;
    (out[key] ||= {})[+row.date] = row.value;
  }
  // euro-area aggregate is sometimes reported under the 2-char code "XC" instead of "EMU"
  if (out.XC && !out.EMU) out.EMU = out.XC;
  return out;   // { ISO3: { year: index } }
}

/* Euro-area ISO2 members → our euro sub-country key (null = euro member we don't break out). */
const EURO_MEMBERS = {
  AT:"AT", BE:"BE", FI:"FI", FR:"FR", DE:"DE", GR:"GR", IE:"IE", IT:"IT", NL:"NL", PT:"PT", ES:"ES",
  HR:null, CY:null, EE:null, LV:null, LT:null, LU:null, MT:null, SK:null, SI:null,
};
/* Best-effort IP geolocation → ISO2 country code (free, CORS-enabled). Convenience only —
   the user can override the country, so one source is enough. (#4) */
async function fetchGeoCountry() {
  try {
    const r = await fetch("https://ipwho.is/");
    if (!r.ok) return null;
    const j = await r.json();
    return j.success === false || !j.country_code ? null : String(j.country_code).toUpperCase();
  } catch (e) { return null; }
}

/* Minimal JSON-stat 2.0 reader: returns value at the given dimension-category map. */
function jsonStatLookup(ds, sel) {
  const dimIds = ds.id || ds.dimension?.id;
  const sizes = ds.size || (dimIds || []).map(d => ds.dimension[d].category.index.length ?
    Object.keys(ds.dimension[d].category.index).length : 1);
  let offset = 0;
  for (let i = 0; i < dimIds.length; i++) {
    const dim = dimIds[i];
    const cats = ds.dimension[dim].category.index;
    let pos;
    if (sel[dim] == null) { if (sizes[i] === 1) pos = 0; else return null; }   // skip singleton dims (freq/unit)
    else pos = Array.isArray(cats) ? cats.indexOf(sel[dim]) : cats[sel[dim]];
    if (pos == null || pos < 0) return null;
    let stride = 1;
    for (let k = i + 1; k < sizes.length; k++) stride *= sizes[k];
    offset += pos * stride;
  }
  const v = ds.value[offset];
  return v == null ? null : v;
}

async function fetchEurostatBasket(geo) {
  const coicops = ["CP00", ...PI_CATS.map(c => "CP" + c.code)];
  const params = new URLSearchParams();
  params.set("format", "JSON");
  params.set("unit", "INX_A_AVG");
  params.set("geo", geo);
  coicops.forEach(c => params.append("coicop", c));
  const url = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_aind?${params}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("eurostat " + r.status);
  const ds = await r.json();
  const timeCats = ds.dimension?.time?.category?.index;
  const years = (Array.isArray(timeCats) ? timeCats : Object.keys(timeCats || {}))
    .map(Number).filter(y => y >= 2010).sort((a, b) => a - b);
  if (!years.length) throw new Error("eurostat: no years");
  const at = (coicop, year) => jsonStatLookup(ds, { geo, coicop, time: String(year), unit: "INX_A_AVG" });
  const headline = {}, cats = {};
  years.forEach(y => { const v = at("CP00", y); if (v != null) headline[y] = v; });
  PI_CATS.forEach(c => {
    const code = c.code, series = {};
    years.forEach(y => { const v = at("CP" + code, y); if (v != null) series[y] = v; });
    cats[code] = series;
  });
  return { years: years.filter(y => headline[y] != null), headline, cats };
}

const GENESIS_YEAR = 2009 + 2 / 365.25;                 // Jan 3, 2009
const nowYear = GENESIS_YEAR + daysNow / 365.25;        // current moment as a decimal year
// approximate year-end BTC price (USD) — illustrative history for the power-law fit
const BTC_HISTORY = [
  [2011, 4.7], [2012, 13.5], [2013, 754], [2014, 320], [2015, 430],
  [2016, 963], [2017, 13880], [2018, 3740], [2019, 7200], [2020, 29000],
  [2021, 46300], [2022, 16550], [2023, 42300], [2024, 93400],
];

/* Calibrated power-law fair value (BGeometrics/Santostasi):
   P ≈ 1.0117e-17 × (days since genesis)^5.82, floor ≈ 0.42 × fair. USD. */
const FV_A = 1.0117e-17, FV_NREF = 5.82, FV_FLOOR = 0.42;
const fvToday = FV_A * Math.pow(daysNow, FV_NREF);
const fairAt = (y, exp) => fvToday * Math.pow((daysNow + y * 365.25) / daysNow, exp);
const positionLabel = (r) =>
  r < 0.5 ? "near the floor — deeply undervalued" :
  r < 0.85 ? "below fair value" :
  r < 1.2 ? "around fair value" :
  r < 2 ? "above fair value" : "near resistance — overheated";

/* price model: starts at spot's position on the curve, closes the gap to fair value by a
   chosen fraction over τ years, then follows the exponent. (Flat-CAGR stays spot-anchored.) */
function priceAt(yearsOut, model) {
  if (model.type === "cagr") return model.spot * Math.pow(1 + model.cagr, yearsOut);
  const fx = model.fxRate ?? 1;
  const lnk = Math.log(model.spot / (fx * fvToday));     // gap vs fair value in local currency
  const meanDev = lnk * (1 - model.gap);
  const dev = meanDev + (lnk - meanDev) * Math.exp(-yearsOut / model.tau);
  return fx * fairAt(yearsOut, model.exp) * Math.exp(dev);
}
const modelOf = (p) =>
  p.modelType === "cagr"
    ? { type: "cagr", cagr: p.cagr, spot: p.spot, tau: p.tau ?? 2 }
    : { type: "pl", exp: p.exp, tau: p.tau ?? 2, gap: p.gap ?? 1, spot: p.spot, fxRate: p.fxRate ?? 1 };

/* ── Mining model ───────────────────────────────────────────────
   Network hashrate is COUPLED to the price power law: empirically hashrate ∝ price^α
   (α≈2), because miners deploy capacity in proportion to profitability. So we never fit a
   second model — we read future price from priceAt() and raise it to α. Difficulty and
   hashrate move together (network_hashrate ≈ difficulty × 2³² / 600), so this projects both.
   Anchors are June 2026; refresh them as the network grows. */
const NET_HASH_NOW = 960e18;        // H/s ≈ 960 EH/s (Jun 2026)
const SUBSIDY_NOW = 3.125;          // BTC per block (post-Apr-2024 halving)
const LAST_HALVING_YEAR = 2024.29;  // ≈ Apr 2024
const HALVING_YEARS = 4;            // ~210,000 blocks ≈ 4 years
const HASH_ALPHA_DEFAULT = 2;       // hashrate ∝ price^α
const ASIC_DECLINE = 0.18;          // ASIC $/TH falls ~18%/yr (efficiency gains) — used on hardware refresh

/* block subsidy at a future point, honouring the halving schedule */
function subsidyAt(yearsOut) {
  const year = nowYear + yearsOut;
  const halvings = Math.max(0, Math.floor((year - LAST_HALVING_YEAR) / HALVING_YEARS));
  return SUBSIDY_NOW / Math.pow(2, halvings);
}
/* projected network hashrate (H/s), coupled to the price model */
function netHashAt(yearsOut, model, alpha) {
  return NET_HASH_NOW * Math.pow(priceAt(yearsOut, model) / model.spot, alpha);
}

/* month-by-month mining projection. Hosted = own the rig (capex + electricity + hosting);
   Rented = pay a daily rate for hashrate. opexFunding "sell" covers running costs by selling
   mined BTC (accruing the rest); "fiat" pays costs out of pocket and keeps all mined BTC.
   Returns BTC accumulated (gross/net), fiat value, cumulative outlay, breakeven & ROI. */
function simulateMining(p) {
  const { mode, ths, capexPerTh, wPerTh, elecPrice, hostFeePerThDay, poolFeePct, rigLifeYears,
    refresh, rentPerThDay, termYears, feeBoost, alpha, opexFunding, horizon, model, infl } = p;
  const myHs = ths * 1e12;                       // TH/s → H/s
  const poolKeep = 1 - poolFeePct / 100;
  const feeMult = 1 + feeBoost / 100;            // tx fees as a fraction of subsidy
  const dPerMo = 365.25 / 12;
  const months = Math.max(1, Math.round(horizon * 12));
  const aliveMonths = mode === "rented"
    ? Math.min(termYears, horizon) * 12
    : (refresh ? months : Math.min(rigLifeYears, horizon) * 12);

  const capex0 = mode === "hosted" ? capexPerTh * ths : 0;
  let fiatOutlay = capex0;     // capex + (opex when paid in fiat) — the money you put in
  let btcGross = 0, btcNet = 0;
  let nextRefresh = mode === "hosted" && refresh ? rigLifeYears * 12 : Infinity;
  let breakevenY = null;
  const rows = [{ year: 0, btcGross: 0, btcNet: 0, value: 0, valueReal: 0, cost: capex0 }];

  for (let m = 1; m <= months; m++) {
    const y = m / 12;
    const price = priceAt(y, model);             // local currency
    const active = m <= aliveMonths;

    if (active) {
      const netHs = netHashAt(y, model, alpha);
      const mined = (myHs / netHs) * 144 * subsidyAt(y) * feeMult * poolKeep * dPerMo;
      btcGross += mined;

      const opex = mode === "hosted"
        ? (ths * wPerTh * 24 / 1000 * elecPrice + hostFeePerThDay * ths) * dPerMo  // power + hosting
        : rentPerThDay * ths * dPerMo;                                              // rental
      if (opexFunding === "sell") { btcNet += mined - opex / price; }               // sell output to cover costs
      else { btcNet += mined; fiatOutlay += opex; }                                 // pay costs from pocket
    }
    // hardware refresh: re-buy the rig at a (declining) ASIC price
    if (m === nextRefresh && m < months) {
      fiatOutlay += capexPerTh * Math.pow(1 - ASIC_DECLINE, y) * ths;
      nextRefresh += rigLifeYears * 12;
    }
    if (breakevenY === null && fiatOutlay > 0 && btcNet * price >= fiatOutlay) breakevenY = y;

    if (m % 12 === 0 || m === months) {
      rows.push({ year: y, btcGross, btcNet,
        value: btcNet * price, valueReal: (btcNet * price) / Math.pow(1 + infl, y), cost: fiatOutlay });
    }
  }
  const endPrice = priceAt(horizon, model);
  const valueEnd = btcNet * endPrice;
  return {
    rows, totalBtcGross: btcGross, totalBtcNet: btcNet, totalOutlay: fiatOutlay,
    valueNow: btcNet * model.spot, valueEnd, valueEndReal: valueEnd / Math.pow(1 + infl, horizon),
    breakevenY, roi: fiatOutlay > 0 ? (valueEnd - fiatOutlay) / fiatOutlay : null,
  };
}

/* full accumulation → drawdown projection with optional crash shock */
function simulate(p) {
  const { age, retireAge, endAge, btc, monthly, spend, infl, model, shock } = p;
  const shockStart = retireAge - age;
  const sm = (y) => {
    if (!shock || !shock.on || y < shockStart) return 1;
    const t = y - shockStart;
    if (t >= shock.recovery) return 1;
    return (1 - shock.depth) + shock.depth * (t / shock.recovery);
  };
  const eff = (y) => priceAt(y, model) * sm(y);
  const row = (a, s) => {
    const y = a - age, price = eff(y);
    const r = { age: a, btc: s, price, value: s * price, valueReal: (s * price) / Math.pow(1 + infl, y), sats: s * SATS };
    if (a < retireAge) {
      r.buySats = (monthly / price) * SATS;
      r.flowKind = "buy"; r.flowSatsYr = r.buySats * 12; r.cashYr = monthly * 12; r.cashYrReal = monthly * 12;
    } else {
      r.sellSats = (((spend / 12) * Math.pow(1 + infl, y)) / price) * SATS;
      r.flowKind = "sell"; r.flowSatsYr = r.sellSats * 12; r.cashYr = spend * Math.pow(1 + infl, y); r.cashYrReal = spend;
    }
    return r;
  };
  const timeline = [];
  let stack = btc;
  timeline.push(row(age, stack));
  for (let a = age + 1; a <= retireAge; a++) {
    for (let k = 0; k < 12; k++) {
      const mi = (a - 1 - age) * 12 + k + 1;
      stack += monthly / eff(mi / 12);
    }
    timeline.push(row(a, stack));
  }
  const retYears = retireAge - age;
  const retStack = stack;
  const retPrice = eff(retYears);
  const retValue = retStack * retPrice;
  let depletedAge = null;
  for (let a = retireAge + 1; a <= endAge; a++) {
    const y = a - age, price = eff(y);
    stack -= (spend * Math.pow(1 + infl, y)) / price;
    if (stack <= 0 && depletedAge === null) { depletedAge = a; stack = 0; }
    timeline.push(row(a, Math.max(0, stack)));
    if (depletedAge) break;
  }
  return {
    timeline, retStack, retPrice, retValue,
    retValueReal: retValue / Math.pow(1 + infl, retYears),
    endPrice: eff(endAge - age), depletedAge, lasts: depletedAge === null,
    firstYearSpendBtc: (spend * Math.pow(1 + infl, retYears)) / retPrice,
  };
}

function normalize(p, shock) {
  const ret = Math.max(p.retireAge, p.age + 1);
  return {
    age: p.age, retireAge: ret, endAge: Math.max(p.endAge, ret + 1),
    btc: p.btc, monthly: p.monthly, spend: p.spend, infl: p.infl,
    spot: p.spot, model: modelOf(p), shock,
  };
}

function merge(A, B) {
  const m = new Map();
  const add = (tl, pre) => tl.forEach(r => {
    const e = m.get(r.age) || { age: r.age };
    e[pre + "V"] = r.value; e[pre + "VR"] = r.valueReal; e[pre + "B"] = r.btc;
    e[pre + "S"] = r.sats; e[pre + "Buy"] = r.buySats; e[pre + "Sell"] = r.sellSats;
    e[pre + "FlowSats"] = r.flowSatsYr; e[pre + "FlowKind"] = r.flowKind; e[pre + "Cash"] = r.cashYr; e[pre + "CashReal"] = r.cashYrReal;
    e[pre + "Price"] = r.price;
    m.set(r.age, e);
  });
  add(A.timeline, "a"); if (B) add(B.timeline, "b");
  return [...m.values()].sort((x, y) => x.age - y.age);
}

/* Monte Carlo — paths around the trend with mean reversion + decaying volatility */
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function runMC(p, vol, nPaths) {
  const { age, retireAge, endAge, btc, monthly, spend, infl, spot, model } = p;
  const accYears = retireAge - age;
  const totalMonths = (endAge - age) * 12;
  const years = endAge - age + 1;
  const phi = Math.exp(-1 / (12 * model.tau)), sq12 = Math.sqrt(12), ln2 = Math.LN2; // τ governs reversion
  const isPL = model.type !== "cagr";
  const lnk = isPL ? Math.log(spot / fvToday) : 0;              // start at today's position on the curve
  const meanDev = isPL ? lnk * (1 - model.gap) : 0;            // where paths settle after the gap closes
  const trendAt = (y) => isPL ? fairAt(y, model.exp) : spot * Math.pow(1 + model.cagr, y);
  const volAt = (y) => vol.floor + (vol.start - vol.floor) * Math.exp((-y * ln2) / vol.half);
  const byYear = Array.from({ length: years }, () => []);
  const byYearBtc = Array.from({ length: years }, () => []);
  const byYearPrice = Array.from({ length: years }, () => []);
  const retVals = [], depAges = [];
  let success = 0;
  for (let pth = 0; pth < nPaths; pth++) {
    let stack = btc, dev = lnk, dead = false, dAge = null;
    byYear[0].push(btc * spot); byYearBtc[0].push(btc); byYearPrice[0].push(spot);
    for (let m = 1; m <= totalMonths; m++) {
      const y = m / 12;
      dev = meanDev + phi * (dev - meanDev) + (volAt(y) / sq12) * randn();   // reverts toward meanDev
      const price = trendAt(y) * Math.exp(dev);
      if (y <= accYears) stack += monthly / price;
      else {
        stack -= ((spend / 12) * Math.pow(1 + infl, y)) / price;
        if (stack <= 0) { stack = 0; if (!dead) { dead = true; dAge = age + y; } }
      }
      if (m % 12 === 0) {
        const idx = m / 12;
        const real = (stack * price) / Math.pow(1 + infl, y);
        if (idx < years) { byYear[idx].push(real); byYearBtc[idx].push(stack); byYearPrice[idx].push(price); }
        if (m === accYears * 12) retVals.push(real);
      }
    }
    if (!dead) success++; else depAges.push(Math.floor(dAge));
  }
  const pct = (arr, q) => {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(q * s.length))];
  };
  const fan = byYear.map((arr, idx) => {
    const aAge = age + idx, p50price = pct(byYearPrice[idx], 0.5) || 1;
    const r = {
      age: aAge, p50: pct(arr, 0.5),
      b1090: [pct(arr, 0.1), pct(arr, 0.9)],
      b2575: [pct(arr, 0.25), pct(arr, 0.75)],
      p50sats: pct(byYearBtc[idx], 0.5) * SATS,
      p50btc: pct(byYearBtc[idx], 0.5),
    };
    if (aAge < retireAge) { r.flowKind = "buy"; r.flowSatsYr = ((monthly * 12) / p50price) * SATS; r.cashYr = monthly * 12; r.cashYrReal = monthly * 12; }
    else { const income = spend * Math.pow(1 + infl, idx); r.flowKind = "sell"; r.flowSatsYr = (income / p50price) * SATS; r.cashYr = income; r.cashYrReal = spend; }
    return r;
  });
  return {
    fan, nPaths, successRate: success / nPaths,
    medianTerminal: pct(byYear[years - 1], 0.5),
    p10Terminal: pct(byYear[years - 1], 0.1),
    medianRet: pct(retVals, 0.5),
    medianFailAge: depAges.length ? pct(depAges, 0.5) : null,
  };
}
// run the Monte Carlo for one scenario, or both (medians merged) when comparing
function buildMc(scen, vol, paths, compare, active) {
  if (!compare) return { ...runMC(normalize(scen[active]), vol, paths), scen: active, compare: false };
  const a = runMC(normalize(scen.A), vol, paths), b = runMC(normalize(scen.B), vol, paths);
  const m = new Map();
  a.fan.forEach(r => m.set(r.age, { age: r.age, aP50: r.p50, aBtc: r.p50btc, aSats: r.p50sats }));
  b.fan.forEach(r => { const e = m.get(r.age) || { age: r.age }; e.bP50 = r.p50; e.bBtc = r.p50btc; e.bSats = r.p50sats; m.set(r.age, e); });
  const fanC = [...m.values()].sort((x, y) => x.age - y.age);
  const sum = (res, sc) => ({ successRate: res.successRate, medianTerminal: res.medianTerminal, p10Terminal: res.p10Terminal,
    failAge: res.medianFailAge, endAge: normalize(scen[sc]).endAge });
  return { compare: true, nPaths: paths, fanC, A: sum(a, "A"), B: sum(b, "B") };
}

/* ── New calculation helpers ────────────────────────────────── */
function accumulateBtc(startBtc, monthly, years, model) {
  let btc = startBtc;
  for (let y = 1; y <= years; y++)
    btc += (monthly * 12) / priceAt(y - 0.5, model);
  return btc;
}
function solveMonthlyDCA(startBtc, targetBtc, years, model) {
  if (years <= 0) return Infinity;
  let lo = 0, hi = 50000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    accumulateBtc(startBtc, mid, years, model) < targetBtc ? lo = mid : hi = mid;
  }
  return (lo + hi) / 2;
}
function calcForever(p, model, accBtcIn = null) {
  const y = Math.max(1, p.retireAge - p.age);
  const p0 = priceAt(y, model);
  const endAgeEff = p.endAge ?? 120;
  const WIN = 10;
  const impliedCagr = Math.pow(priceAt(y + WIN, model) / p0, 1 / WIN) - 1;
  const realReturn = impliedCagr - p.infl;
  // Required BTC solved via the same year-by-year depletion model as simulate()
  const reqBtc = solveForeverBtc(p.spend, p.retireAge, p.age, p.infl, model, endAgeEff);
  const reqValue = reqBtc * p0;
  const accBtc = accBtcIn !== null ? accBtcIn : accumulateBtc(p.btc, p.monthly, y, model);
  const neededDCA = reqBtc > accBtc ? solveMonthlyDCA(p.btc, reqBtc, y, model) : null;
  return { possible: true, reqBtc, reqValue, accBtc, neededDCA, impliedCagr, realReturn, p0 };
}
// Earliest retirement age at which the forever stack is self-sustaining for a given income (#11).
function foreverFeasibleAge(p, income, model, endAge) {
  const e = endAge ?? 120;
  const maxAge = Math.min(e - 1, 90);
  for (let ra = p.age + 1; ra <= maxAge; ra++) {
    const accBtc = accumulateBtc(p.btc, p.monthly, ra - p.age, model);
    const reqBtc = solveForeverBtc(income, ra, p.age, p.infl, model, e);
    if (accBtc >= reqBtc) return ra;
  }
  return null;
}
function calcForeverCurve(p, model, endAge) {
  const endAgeEff = endAge ?? 120;
  const ageMax = Math.min(endAgeEff - 1, 85);
  const rows = [];
  for (let ra = p.age + 1; ra <= ageMax; ra++) {
    const accBtc = accumulateBtc(p.btc, p.monthly, ra - p.age, model);
    const reqBtc = solveForeverBtc(p.spend, ra, p.age, p.infl, model, endAgeEff);
    rows.push({ age: ra, reqBtc, accBtc });
  }
  return rows;
}
function solveForeverBtc(income, bridgeEndAge, age0, infl, model, endAge) {
  const survives = (startBtc) => {
    let stack = startBtc;
    for (let a = bridgeEndAge + 1; a <= endAge; a++) {
      const y = a - age0;
      stack -= (income * Math.pow(1 + infl, y)) / priceAt(y, model);
      if (stack <= 0) return false;
    }
    return true;
  };
  let lo = 0, hi = 50;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    survives(mid) ? hi = mid : lo = mid;
  }
  return (lo + hi) / 2;
}
// Inverse of solveForeverBtc: given the BTC accumulated by retirement, find the largest
// inflation-adjusted annual income that still lasts to endAge. Same depletion model. (#2)
function solveSustainableIncome(startBtc, retireAge, age0, infl, model, endAge) {
  const survives = (income) => {
    let stack = startBtc;
    for (let a = retireAge + 1; a <= endAge; a++) {
      const y = a - age0;
      stack -= (income * Math.pow(1 + infl, y)) / priceAt(y, model);
      if (stack <= 0) return false;
    }
    return true;
  };
  let lo = 0, hi = 1e8;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    survives(mid) ? lo = mid : hi = mid;
  }
  return (lo + hi) / 2;
}
// Bridge mode: retireAge is FIXED (when forever income starts).
// We find the earliest earlyRetireAge where DCA covers foreverBtc + bridge cost.
// Bridge cost = sum of annual income from earlyRetireAge to retireAge.
function calcBridge(brd, model, endAge) {
  const endAgeEff = endAge ?? 120;
  const retireAge = brd.retireAge;
  const income = brd.foreverIncome;
  // How much BTC needed at retireAge to sustain income for life
  const foreverBtc = solveForeverBtc(income, retireAge, brd.age, brd.infl, model, endAgeEff);
  const foreverReqValue = foreverBtc * priceAt(retireAge - brd.age, model);
  for (let era = brd.age + 1; era <= retireAge; era++) {
    const accBtc = accumulateBtc(brd.currentBtc, brd.monthly, era - brd.age, model);
    // BTC cost of bridge spending from era up to retireAge
    let bridgeBtc = 0;
    for (let a = era; a < retireAge; a++) {
      const y = a - brd.age;
      bridgeBtc += (income * Math.pow(1 + brd.infl, y)) / priceAt(y, model);
    }
    const reqBtc = foreverBtc + bridgeBtc;
    if (accBtc >= reqBtc) {
      return {
        earlyRetireAge: era,
        retireAge,
        yearsEarly: retireAge - era,
        foreverBtc,
        foreverReqValue,
        bridgeBtc,
        reqBtc,
        accBtc,
        impossible: false,
      };
    }
  }
  return {
    impossible: true,
    reason: `Stack won't reach the forever target by age ${retireAge}. Try increasing your DCA or retirement age.`,
  };
}
function calcSavings(goal, model) {
  const infl = goal.infl ?? 0.02;
  const rows = []; let accBtc = goal.currentBtc;
  for (let y = 0; y <= 50; y++) {
    if (y > 0) {
      for (let k = 0; k < 12; k++) {
        accBtc += goal.monthly / priceAt((y - 1 + (k + 0.5) / 12), model);
      }
    }
    const price = priceAt(y, model);
    const deflator = Math.pow(1 + infl, y);
    rows.push({
      age: goal.age + y, y,
      stackValue: accBtc * price,
      stackValueReal: (accBtc * price) / deflator,
      goalCost: goal.valueToday * Math.pow(1 + goal.goalInfl, y),
      goalCostReal: goal.valueToday * Math.pow(1 + goal.goalInfl, y) / deflator,
      btc: accBtc,
    });
  }
  const crossover = rows.find(r => r.stackValue >= r.goalCost);
  return { rows, crossover, canAffordNow: rows[0].stackValue >= rows[0].goalCost };
}
// Full bridge lifecycle simulation: accumulate → bridge spend → forever spend
// brd.retireAge    = earlyRetireAge (when bridge/spending starts)
// brd.bridgeEndAge = retireAge (when forever income kicks in)
// both phases use brd.foreverIncome (single income target)
function simulateBridgeFull(brd, model, endAge) {
  const rows = [];
  let stack = brd.currentBtc;
  const a0 = brd.age;
  const mkRow = (age, s, kind, cashYr) => {
    const y = age - a0, price = priceAt(y, model);
    s = Math.max(0, s);
    const r = { age, btc: s, price, value: s * price,
      valueReal: (s * price) / Math.pow(1 + brd.infl, y), sats: s * SATS };
    if (kind) { r.flowKind = kind; r.cashYr = cashYr; r.flowSatsYr = (cashYr / price) * SATS; }
    return r;
  };
  rows.push(mkRow(a0, stack));
  for (let age = a0 + 1; age <= brd.retireAge; age++) {
    const y = age - a0;
    for (let k = 0; k < 12; k++) stack += brd.monthly / priceAt(y - 1 + (k + 1) / 12, model);
    rows.push(mkRow(age, stack, "buy", brd.monthly * 12));
  }
  // Bridge phase: income spending from earlyRetireAge to retireAge (same rate as forever)
  for (let age = brd.retireAge + 1; age <= brd.bridgeEndAge; age++) {
    const y = age - a0, spend = brd.foreverIncome * Math.pow(1 + brd.infl, y);
    stack -= spend / priceAt(y, model);
    rows.push(mkRow(age, stack, "sell", spend));
  }
  // Forever phase
  for (let age = brd.bridgeEndAge + 1; age <= endAge; age++) {
    const y = age - a0, spend = brd.foreverIncome * Math.pow(1 + brd.infl, y);
    stack -= spend / priceAt(y, model);
    rows.push(mkRow(age, stack, "sell", spend));
    if (stack <= 0) break;
  }
  return rows;
}

/* ── UI atoms ───────────────────────────────────────────────── */
/* Renders a " · "-joined source label, linking each known source to its primary data (#8). */
function SourceCite({ label, color = C.inkFaint }) {
  const parts = String(label || "").split(" · ").filter(Boolean);
  if (!parts.length) return <span style={{ color }}>—</span>;
  return parts.map((name, i) => {
    const url = sourceUrlFor(name);
    return (
      <React.Fragment key={i}>
        {i > 0 && <span style={{ color }}> · </span>}
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer"
            style={{ color: C.blue, textDecoration: "underline", textUnderlineOffset: 2 }}
            title={`Verify: ${name} primary data ↗`}>{name} ↗</a>
        ) : <span style={{ color }}>{name}</span>}
      </React.Fragment>
    );
  });
}
function Field({ label, suffix, children }) {
  return (
    <label style={{ display: "block", marginBottom: 18 }}>
      <div style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 11, letterSpacing: ".14em",
        textTransform: "uppercase", color: C.inkDim, marginBottom: 7, display: "flex", justifyContent: "space-between" }}>
        <span>{label}</span>{suffix && <span style={{ color: C.inkFaint }}>{suffix}</span>}
      </div>{children}
    </label>
  );
}
// A locale-independent numeric input. Uses type="text" + inputMode="decimal" so the field always
// uses a period as the decimal separator (a browser number input localises to "0,5" in e.g. German
// locales — #17) and keeps a raw text buffer so partial entries like "" / "0." / "1." are editable
// instead of snapping back to a stuck leading zero (#12).
function NumIn({ value, onChange, prefix, step = 1, min = 0, disabled = false }) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);
  // mirror external value changes (live price, presets, auto-income) only while not editing
  useEffect(() => { if (!focused.current) setText(String(value)); }, [value]);
  const handle = (e) => {
    const v = e.target.value;
    if (!/^-?[0-9]*[.,]?[0-9]*$/.test(v)) return;   // reject anything non-numeric, accept , or .
    setText(v);
    const norm = v.replace(",", ".");
    if (norm === "" || norm === "." || norm === "-" || norm === "-.") { onChange(0); return; }
    const n = parseFloat(norm);
    if (isFinite(n)) onChange(n);
  };
  return (
    <div style={{ display: "flex", alignItems: "center", background: C.panel2,
      border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden", opacity: disabled ? 0.4 : 1 }}>
      {prefix && <span style={{ padding: "0 10px", color: C.orange, fontFamily: "'IBM Plex Mono',monospace",
        fontSize: 15, borderRight: `1px solid ${C.line}` }}>{prefix}</span>}
      <input type="text" inputMode="decimal" value={text} disabled={disabled}
        onFocus={() => { focused.current = true; }}
        onBlur={(e) => { focused.current = false; const n = parseFloat(e.target.value.replace(",", ".")); setText(isFinite(n) ? String(n) : "0"); }}
        onChange={handle}
        style={{ flex: 1, width: "100%", background: "transparent", border: "none", outline: "none",
          color: C.ink, fontFamily: "'IBM Plex Mono',monospace", fontSize: 16, padding: "11px 12px",
          cursor: disabled ? "default" : "auto" }} />
    </div>
  );
}
function Slider({ value, onChange, min, max, step, fmt }) {
  return (
    <div>
      <div style={{ fontFamily: "'IBM Plex Mono',monospace", color: C.gold, fontSize: 15, marginBottom: 6 }}>{fmt(value)}</div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} className="btc-range" style={{ width: "100%" }} />
    </div>
  );
}
function Stat({ label, big, sub, color = C.ink }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 11, letterSpacing: ".14em",
        textTransform: "uppercase", color: C.inkDim, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600, fontSize: "clamp(20px,4.5vw,32px)",
        color, lineHeight: 1, letterSpacing: "-.01em" }}>{big}</div>
      {sub && <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, color: C.inkFaint, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}
const Dot = ({ c }) => <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block" }} />;
function CmpRow({ label, a, b, ca, cb }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0", borderTop: `1px solid ${C.line}` }}>
      <div style={{ flex: "1.3 1 0", minWidth: 0, fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 12, letterSpacing: ".06em",
        textTransform: "uppercase", color: C.inkDim }}>{label}</div>
      <div style={{ flex: "1 1 0", minWidth: 0, textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontSize: "clamp(12px,3.4vw,15px)", color: ca }}>{a}</div>
      <div style={{ flex: "1 1 0", minWidth: 0, textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontSize: "clamp(12px,3.4vw,15px)", color: cb }}>{b}</div>
    </div>
  );
}
function TTg({ active, payload, fmt, labelKey = "age" }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const label = labelKey === "year" ? `Year ${Math.round(d.year)}` : `Age ${d.age}`;
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px",
      fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>
      <div style={{ color: C.gold, marginBottom: 4 }}>{label}</div>
      {payload.filter(e => e.value != null).map((e, i) => (
        <div key={i} style={{ color: e.color }}>{e.name}: {fmt(e.value)}</div>
      ))}
    </div>
  );
}

const ttBox = (age, kids) => (
  <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px",
    fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>
    <div style={{ color: C.gold, marginBottom: 4 }}>Age {age}</div>{kids}
  </div>
);
const flowLine = (sell, buy) => sell != null
  ? <span style={{ color: C.red }}>selling {Math.round(sell).toLocaleString()} sats/mo</span>
  : buy != null ? <span style={{ color: C.green }}>buying {Math.round(buy).toLocaleString()} sats/mo</span> : null;

function TTvalue({ active, payload, sym, real, compare }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  if (!compare) return ttBox(d.age, <>
    <div style={{ color: C.orange }}>{fmtMoney(real ? d.valueReal : d.value, sym)}{real ? ` · today's ${sym}` : ""}</div>
    <div style={{ color: C.inkDim }}>{fmtBtc(d.btc)} · {fmtSats(d.sats)}</div>
    {d.price != null && <div style={{ color: C.blue, marginTop: 2 }}>BTC {fmtMoney(d.price, sym)}</div>}
  </>);
  return ttBox(d.age, <>
    <div style={{ color: C.orange }}>A {fmtMoney(real ? d.aVR : d.aV, sym)} · {fmtSats(d.aS)}</div>
    <div style={{ color: C.blue }}>B {fmtMoney(real ? d.bVR : d.bV, sym)} · {fmtSats(d.bS)}</div>
    {d.aPrice != null && <div style={{ color: C.inkDim, marginTop: 2, fontSize: 11 }}>BTC {fmtMoney(d.aPrice, sym)}</div>}
  </>);
}
// Mining chart tooltip — net BTC, stack value, and fiat invested at a given projection year.
function MineTT({ active, payload, real, cur }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px",
      fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>
      <div style={{ color: C.gold, marginBottom: 4 }}>Year {Math.round(d.year)}</div>
      <div style={{ color: C.orange }}>{fmtBtc(d.btcNet)} net{d.btcGross != null ? ` · ${fmtBtc(d.btcGross)} gross` : ""}</div>
      <div style={{ color: C.gold }}>{fmtMoney(real ? d.valueReal : d.value, cur)}{real ? ` · today's ${cur}` : ""}</div>
      <div style={{ color: C.inkDim, marginTop: 2 }}>invested {fmtMoney(d.cost, cur)}</div>
    </div>
  );
}
// Shared age / value / BTC axes for the portfolio + Monte-Carlo charts. Returns an array (not a
// fragment) so recharts' React.Children walk flattens and detects each axis.
const ageValBtcAxes = (cur) => [
  <XAxis key="x" dataKey="age" stroke={C.inkFaint} tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} tickLine={false} />,
  <YAxis key="yv" yAxisId="val" stroke={C.inkFaint} tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} tickLine={false} width={48} tickFormatter={v => fmtMoney(v, cur)} />,
  <YAxis key="yb" yAxisId="btc" orientation="right" stroke={C.gold} tick={{ fontSize: 10, fontFamily: "IBM Plex Mono", fill: C.gold }} tickLine={false} width={46} tickFormatter={v => `₿${v.toFixed(2)}`} opacity={0.7} />,
];
function PortfolioChart({ data, retireAge, pivotAge, pivotLabel, real, cur, onMouseMove, pinCursor, shockOn, shockX2, height }) {
  return (
    <ResponsiveContainer width="100%" height={height ?? 270}>
      <ComposedChart data={data} onMouseMove={onMouseMove} margin={{ top: 14, right: 8, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="pcGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.orange} stopOpacity={0.45} />
            <stop offset="100%" stopColor={C.orange} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={C.line} strokeDasharray="2 4" vertical={false} />
        {ageValBtcAxes(cur)}
        <Tooltip cursor={pinCursor} content={<TTvalue sym={cur} real={real} />} />
        {shockOn && <ReferenceArea yAxisId="val" x1={retireAge} x2={shockX2} fill={C.red} fillOpacity={0.18}
          label={{ value: "⚡ stress", position: "insideTop", fill: C.red, fontSize: 10, fontFamily: "IBM Plex Mono" }} />}
        <ReferenceLine yAxisId="val" x={retireAge} stroke={C.gold} strokeDasharray="3 3"
          label={{ value: "retire", fill: C.gold, fontSize: 10, position: "insideTopRight" }} />
        {pivotAge != null && (
          <ReferenceLine yAxisId="val" x={pivotAge} stroke={C.green} strokeDasharray="3 3"
            label={{ value: pivotLabel ?? "pivot", fill: C.green, fontSize: 10, position: "insideTopRight" }} />
        )}
        <Area yAxisId="val" type="monotone" name="Value" dataKey={real ? "valueReal" : "value"} stroke={C.orange} strokeWidth={2} fill="url(#pcGrad)" />
        <Line yAxisId="val" type="monotone" name="BTC price" dataKey="price" stroke={C.blue} strokeWidth={1.5} dot={false} strokeDasharray="2 4" opacity={0.8} />
        <Line yAxisId="btc" type="monotone" name="BTC" dataKey="btc" stroke={C.gold} strokeWidth={1.5} dot={false} strokeDasharray="5 3" opacity={0.8} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
function TTstack({ active, payload, compare }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  if (!compare) return ttBox(d.age, <>
    <div style={{ color: C.ink }}>{fmtBtc(d.btc)} · {fmtSats(d.sats)}</div>
    <div style={{ marginTop: 2 }}>{flowLine(d.sellSats, d.buySats)}</div>
  </>);
  return ttBox(d.age, <>
    <div style={{ color: C.orange }}>A {fmtBtc(d.aB)} · {fmtSats(d.aS)}</div>
    <div style={{ color: C.inkDim, marginBottom: 5 }}>{flowLine(d.aSell, d.aBuy)}</div>
    <div style={{ color: C.blue }}>B {fmtBtc(d.bB)} · {fmtSats(d.bS)}</div>
    <div style={{ color: C.inkDim }}>{flowLine(d.bSell, d.bBuy)}</div>
  </>);
}

function PinTable({ row, view, real, sym }) {
  if (!row) return null;
  const lab = { fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: C.inkDim };
  const cell = { fontFamily: "'IBM Plex Mono',monospace", fontSize: 14, color: C.ink };
  const note = { color: C.inkFaint, fontSize: 11, fontFamily: "'IBM Plex Mono',monospace" };
  const R = ({ label, children }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "10px 4px", borderTop: `1px solid ${C.line}` }}>
      <span style={lab}>{label}</span><span style={cell}>{children}</span>
    </div>
  );

  const grid = { display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 10, padding: "9px 4px", borderTop: `1px solid ${C.line}` };
  const R2 = ({ label, a, b }) => (
    <div style={grid}><span style={lab}>{label}</span>
      <span style={{ ...cell, textAlign: "right" }}>{a}</span>
      <span style={{ ...cell, textAlign: "right" }}>{b}</span></div>
  );

  if (view === "mccompare") {
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ ...grid, borderTop: "none", paddingBottom: 4 }}>
          <span style={lab}>median · age {row.age}</span>
          <span style={{ ...lab, textAlign: "right", color: C.orange }}>A</span>
          <span style={{ ...lab, textAlign: "right", color: C.blue }}>B</span>
        </div>
        <R2 label="Median value" a={fmtMoney(row.aP50, sym)} b={fmtMoney(row.bP50, sym)} />
        <R2 label="Median balance" a={fmtSats(row.aSats)} b={fmtSats(row.bSats)} />
      </div>
    );
  }

  if (view === "compare") {
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ ...grid, borderTop: "none", paddingBottom: 4 }}>
          <span style={lab}>at age {row.age}</span>
          <span style={{ ...lab, textAlign: "right", color: C.orange }}>A</span>
          <span style={{ ...lab, textAlign: "right", color: C.blue }}>B</span>
        </div>
        <R2 label="Balance" a={fmtSats(row.aS)} b={fmtSats(row.bS)} />
        <R2 label="Value" a={fmtMoney(real ? row.aVR : row.aV, sym)} b={fmtMoney(real ? row.bVR : row.bV, sym)} />
        <R2 label="Flow / yr" a={row.aFlowSats != null ? fmtSats(row.aFlowSats) : "—"} b={row.bFlowSats != null ? fmtSats(row.bFlowSats) : "—"} />
        <R2 label={`Cash / yr · ${real ? `today's ${sym}` : "nominal"}`}
          a={(real ? row.aCashReal : row.aCash) != null ? fmtMoney(real ? row.aCashReal : row.aCash, sym) : "—"}
          b={(real ? row.bCashReal : row.bCash) != null ? fmtMoney(real ? row.bCashReal : row.bCash, sym) : "—"} />
      </div>
    );
  }

  const isMc = view === "mc";
  const sell = row.flowKind === "sell";
  const balance = isMc ? row.p50sats : row.sats;
  const value = isMc ? row.p50 : (real ? row.valueReal : row.value);
  // mc values are always today's money; single/compare follow the toggle — keep income consistent (#15)
  const showReal = isMc || real;
  const cash = showReal ? row.cashYrReal : row.cashYr;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ padding: "8px 4px 4px" }}><span style={lab}>{isMc ? "median at age " : "at age "}{row.age}</span></div>
      <R label="Balance"><span style={{ color: C.orange }}>{fmtSats(balance)}</span></R>
      <R label="Value"><span style={{ color: C.gold }}>{fmtMoney(value, sym)}</span> <span style={note}>{isMc ? `median · today's ${sym}` : real ? `today's ${sym}` : "nominal"}</span></R>
      <R label={sell ? "Selling / yr" : "Buying / yr"}><span style={{ color: sell ? C.red : C.green }}>{row.flowSatsYr != null ? fmtSats(row.flowSatsYr) : "—"}</span></R>
      <R label={sell ? "Income / yr" : "Contributions / yr"}>{cash != null ? fmtMoney(cash, sym) : "—"} <span style={note}>{showReal ? `today's ${sym}` : "nominal"}</span></R>
    </div>
  );
}

function TTmc({ active, payload, sym, compare }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  if (compare) return (
    <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px",
      fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>
      <div style={{ color: C.gold, marginBottom: 4 }}>median at age {d.age}</div>
      <div style={{ color: C.orange }}>A {fmtMoney(d.aP50, sym)} · {fmtSats(d.aSats)}</div>
      <div style={{ color: C.blue }}>B {fmtMoney(d.bP50, sym)} · {fmtSats(d.bSats)}</div>
    </div>
  );
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px",
      fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>
      <div style={{ color: C.gold, marginBottom: 4 }}>Age {d.age}</div>
      <div style={{ color: C.orange }}>Median: {fmtMoney(d.p50, sym)}</div>
      <div style={{ color: C.inkDim }}>10–90%: {fmtMoney(d.b1090[0], sym)} – {fmtMoney(d.b1090[1], sym)}</div>
      {d.p50sats != null && <div style={{ color: C.gold, marginTop: 2 }}>≈ {fmtSats(d.p50sats)} median</div>}
    </div>
  );
}

/* ── defaults ───────────────────────────────────────────────── */
const DEF_A = { age: 34, retireAge: 55, endAge: 120, btc: 0.5, monthly: 400, spend: 60000,
  spot: 61000, infl: 0.03, modelType: "pl-cons", exp: 4.5, tau: 2, gap: 1, cagr: 0.18 };
const DEF_B = { ...DEF_A, monthly: 800, retireAge: 60, exp: 5.2 };

/* ──────────────────────────────────────────────────────────── */
export default function App() {
  const [scen, setScen] = useState({ A: DEF_A, B: DEF_B });
  const [active, setActive] = useState("A");
  const [compare, setCompare] = useState(false);
  const [country, setCountry] = useState("EU");
  const [showCountry, setShowCountry] = useState(false);
  const [geoDetected, setGeoDetected] = useState(null);   // ISO2 from IP, for the picker hint (#4)
  const userTouchedCountry = useRef(false);
  const pickCountry = (k) => { userTouchedCountry.current = true; setCountry(k); };
  const cur = COUNTRIES[country].cur;
  const [tab, setTab] = useState("retirement");
  const [real, setReal] = useState(false);
  const [showAdv, setShowAdv] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [shock, setShock] = useState({ on: false, depth: 0.7, recovery: 3 });
  const [saved, setSaved] = useState([]);
  const [nameInput, setNameInput] = useState("");
  const [mcVol, setMcVol] = useState({ start: 0.50, floor: 0.25, half: 8 });
  const [mcPaths, setMcPaths] = useState(700);
  const [mc, setMc] = useState(null);
  const [mcBusy, setMcBusy] = useState(false);
  const [live, setLive] = useState({ status: "loading" });
  const [showVolOpts, setShowVolOpts] = useState(false);
  const [showSens, setShowSens] = useState(false);
  const [pinAge, setPinAge] = useState(null);

  /* ── Personal inflation state ── */
  const [inflWeights, setInflWeights] = useState(PI_PRESETS.official);
  const [inflStart, setInflStart] = useState(2020);     // averaging-window start year (#6)
  const [inflEnd, setInflEnd] = useState(2025);         // averaging-window end year
  const [inflOverride, setInflOverride] = useState(false);  // user has hand-tuned projection infl (else auto from My Inflation, #5)
  const [euroGeo, setEuroGeo] = useState("DE");         // exact euro-area country for the basket (#3)
  const [cpiLive, setCpiLive] = useState({ status: "loading" });    // World Bank headline, all countries
  const [euroBasket, setEuroBasket] = useState({ status: "idle" }); // Eurostat per-COICOP, per geo

  /* ── Bridge stack state (bridge-specific inputs only; age/btc/monthly/infl from scen.A) ── */
  const [brd, setBrd] = useState({ show: false, foreverIncome: 48000 });
  const upBrd = (k, v) => setBrd(s => ({ ...s, [k]: v }));

  /* ── #2: auto retirement income — solve sustainable income from a fixed retire age ── */
  const [autoIncome, setAutoIncome] = useState(false);
  const [incomeUnit, setIncomeUnit] = useState("yr");   // #13: display retirement income per year or per month

  /* ── Savings goal state ── */
  const [goal, setGoal] = useState({ name:"Dream Car", category:"car", valueToday:50000, goalInfl:0.045, age:34, currentBtc:0.5, monthly:400 });
  const upGoal = (k, v) => setGoal(s => ({ ...s, [k]: v }));

  /* ── Mining state (price model shared from Retirement scenario A) ── */
  const [mine, setMine] = useState({
    mode: "hosted", ths: 100, capexPerTh: 15, wPerTh: 18, elecPrice: 0.06,
    hostFeePerThDay: 0, poolFeePct: 1.5, rigLifeYears: 4, refresh: true,
    rentPerThDay: 0.05, termYears: 4, feeBoost: 3, alpha: HASH_ALPHA_DEFAULT,
    opexFunding: "fiat", horizon: 10,
  });
  const upMine = (k, v) => setMine(s => ({ ...s, [k]: v }));

  const p = scen[active];
  const up = (k, v) => setScen(s => ({ ...s, [active]: { ...s[active], [k]: v } }));
  const setModel = (t) => {
    up("modelType", t);
    if (t === "pl-fair") up("exp", 5.8);
    if (t === "pl-cons") up("exp", 4.5);
  };
  const isPL = p.modelType !== "cagr";

  /* persistent saved-scenario library */
  useEffect(() => {
    try { const v = localStorage.getItem(STORE_KEY); if (v) setSaved(JSON.parse(v)); }
    catch (e) { /* nothing stored yet */ }
  }, []);
  const persist = (next) => {
    setSaved(next);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch (e) { /* in-memory fallback */ }
  };
  const saveCurrent = () => {
    const name = nameInput.trim() || `Scenario ${saved.length + 1}`;
    persist([...saved, { id: Date.now().toString(36), name, params: scen[active] }]);
    setNameInput("");
  };
  const loadInto = (entry) => setScen(s => ({ ...s, [active]: { ...DEF_A, ...entry.params } }));
  const removeSaved = (id) => persist(saved.filter(e => e.id !== id));

  const runMonteCarlo = () => {
    setMcBusy(true);
    setTimeout(() => {
      setMc(buildMc(scen, mcVol, mcPaths, compare, active));
      setMcBusy(false);
    }, 30);
  };

  const localSpotFrom = (prices, ctry) => {
    const code = COUNTRIES[ctry]?.cgCode ?? "usd";
    return prices?.[code] ?? prices?.usd ?? null;
  };
  const fetchLive = async () => {
    setLive(l => ({ ...l, status: "loading" }));
    // CoinGecko multi-currency: one call gets all needed currencies
    try {
      const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,eur,gbp,cad,aud,chf,jpy");
      if (r.ok) {
        const j = await r.json();
        const prices = j.bitcoin;
        if (prices?.usd && isFinite(prices.usd)) {
          setLive({ status: "ok", usd: prices.usd, prices, ts: Date.now(), src: "CoinGecko" });
          return { usd: prices.usd, prices };
        }
      }
    } catch (e) { /* fall through */ }
    // Fallback: USD-only source (fxRate stays 1)
    try {
      const r = await fetch("https://api.coinbase.com/v2/prices/BTC-USD/spot");
      if (r.ok) {
        const usd = parseFloat((await r.json()).data.amount);
        if (usd && isFinite(usd) && usd > 0) {
          setLive({ status: "ok", usd, prices: { usd }, ts: Date.now(), src: "Coinbase" });
          return { usd, prices: { usd } };
        }
      }
    } catch (e) { /* fall through */ }
    setLive({ status: "fail" });
    return null;
  };
  useEffect(() => { (async () => {
    const result = await fetchLive();
    if (result) {
      const local = localSpotFrom(result.prices, country);
      const spotVal = local ? Math.round(local) : DEF_A.spot;
      const fx = result.usd > 0 && local ? local / result.usd : 1;
      setScen(s => ({ A: { ...s.A, spot: spotVal, fxRate: fx }, B: { ...s.B, spot: spotVal, fxRate: fx } }));
      setMc(buildMc({ A: { ...DEF_A, spot: spotVal, fxRate: fx } }, mcVol, mcPaths, false, "A"));
    }
  })(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  // When the user switches country, re-derive spot from the already-fetched prices
  useEffect(() => {
    if (live.status !== "ok" || !live.prices) return;
    const local = localSpotFrom(live.prices, country);
    if (!local) return;
    const fx = live.usd > 0 ? local / live.usd : 1;
    setScen(s => ({ A: { ...s.A, spot: Math.round(local), fxRate: fx }, B: { ...s.B, spot: Math.round(local), fxRate: fx } }));
  }, [country]);  // eslint-disable-line react-hooks/exhaustive-deps
  // keep the Monte Carlo in sync with inputs while the fan is on screen (debounced so dragging stays smooth)
  useEffect(() => {
    if (!mc) return;                       // fan hidden (reset to projection) → nothing to resync
    setMcBusy(true);
    const t = setTimeout(() => {
      setMc(prev => prev ? buildMc(scen, mcVol, mcPaths, compare, active) : prev);
      setMcBusy(false);
    }, 350);
    return () => clearTimeout(t);
    // mc intentionally omitted from deps to avoid a re-run loop
  }, [scen, active, mcVol, mcPaths, compare]);
  const applyLive = () => {
    if (live.status !== "ok") return;
    const local = localSpotFrom(live.prices, country);
    if (!local) return;
    const fx = live.usd > 0 ? local / live.usd : 1;
    setScen(s => ({ A: { ...s.A, spot: Math.round(local), fxRate: fx }, B: { ...s.B, spot: Math.round(local), fxRate: fx } }));
  };

  /* ── #4: auto-select country/currency from IP (unless the user has already chosen) ── */
  useEffect(() => { (async () => {
    const code = await fetchGeoCountry();
    if (!code) return;
    setGeoDetected(code);
    if (userTouchedCountry.current) return;
    if (COUNTRIES[code]) setCountry(code);
    else if (EURO_MEMBERS[code] !== undefined) { setCountry("EU"); if (EURO_MEMBERS[code]) setEuroGeo(EURO_MEMBERS[code]); }
  })(); }, []);

  /* ── Live inflation: World Bank headline CPI for every country + euro member (once) ── */
  useEffect(() => { (async () => {
    const iso3 = [...new Set([
      ...Object.values(COUNTRIES).map(c => c.wb),
      ...Object.values(EURO_GEOS).map(g => g.wb),
    ])];
    try {
      const byIso = await fetchWorldBankCPI(iso3);
      if (Object.keys(byIso).length) { setCpiLive({ status: "ok", byIso, src: "World Bank" }); return; }
      throw new Error("empty");
    } catch (e) { setCpiLive({ status: "fail" }); }
  })(); }, []);

  /* ── Live inflation: Eurostat per-COICOP basket for the selected euro country ── */
  useEffect(() => {
    if (country !== "EU") return;
    const geo = EURO_GEOS[euroGeo]?.geo;
    if (!geo) return;
    if (euroBasket.status === "ok" && euroBasket.geo === euroGeo) return;
    let cancelled = false;
    setEuroBasket({ status: "loading", geo: euroGeo });
    (async () => {
      try {
        const data = await fetchEurostatBasket(geo);
        if (!cancelled) setEuroBasket({ status: "ok", geo: euroGeo, ...data });
      } catch (e) { if (!cancelled) setEuroBasket({ status: "fail", geo: euroGeo }); }
    })();
    return () => { cancelled = true; };
  }, [country, euroGeo]);  // eslint-disable-line react-hooks/exhaustive-deps

  const countryRef = useRef(null);
  useEffect(() => {
    if (!showCountry) return;
    const handler = (e) => { if (countryRef.current && !countryRef.current.contains(e.target)) setShowCountry(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCountry]);

  const rA = useMemo(() => simulate(normalize(scen.A, shock)), [scen.A, shock]);
  const rB = useMemo(() => (compare ? simulate(normalize(scen.B, shock)) : null), [scen.B, compare, shock]);
  const merged = useMemo(() => merge(rA, rB), [rA, rB]);

  /* ── Resolve the inflation data source for the active country (live → fallback) ── */
  const inflData = useMemo(() => {
    const isEuro = !!COUNTRIES[country].euro;
    const wb = isEuro ? EURO_GEOS[euroGeo].wb : COUNTRIES[country].wb;
    // headline CPI index series
    let headline, headSrc, headLive = false;
    const liveSeries = cpiLive.status === "ok" ? cpiLive.byIso[wb] : null;
    if (liveSeries && Object.keys(liveSeries).length >= 2) {
      headline = liveSeries; headSrc = "World Bank"; headLive = true;
    } else if (isEuro && euroGeo === "DE") {
      headline = Object.fromEntries(PI_FALLBACK_YEARS.map((y, i) => [y, PI_FALLBACK_HEADLINE[i]]));
      headSrc = "Destatis (offline)";
    } else {
      const gen = COUNTRIES[country].assetInfl.general;
      headline = Object.fromEntries(PI_FALLBACK_YEARS.map(y => [y, +(100 * Math.pow(1 + gen, y - 2010)).toFixed(2)]));
      headSrc = "estimate (offline)";
    }
    // per-COICOP basket series (euro area only)
    let cats = null, catYears = [], catSrc = null, catLive = false;
    if (isEuro) {
      if (euroBasket.status === "ok" && euroBasket.geo === euroGeo && euroBasket.cats) {
        cats = euroBasket.cats; catYears = euroBasket.years; catSrc = "Eurostat"; catLive = true;
      } else {
        cats = Object.fromEntries(PI_CATS.map(c => [c.code, Object.fromEntries(PI_YEARS.map((y, i) => [y, c.s[i]]))]));
        catYears = PI_YEARS.slice(); catSrc = euroGeo === "DE" ? "Destatis (offline)" : "Destatis DE proxy";
      }
    }
    const headYears = Object.keys(headline).map(Number).sort((a, b) => a - b);
    return { isEuro, wb, headline, headYears, headSrc, headLive, cats, catYears, catSrc, catLive,
      basketLoading: isEuro && euroBasket.status === "loading" };
  }, [country, euroGeo, cpiLive, euroBasket]);

  /* ── Personal inflation derived values (window = [inflStart, inflEnd]) ── */
  const piResult = useMemo(() => {
    const { headline, headYears, cats, catYears } = inflData;
    const yMin = headYears[0], yMax = headYears[headYears.length - 1];
    const end = Math.min(Math.max(inflEnd, yMin + 1), yMax);
    const start = Math.min(Math.max(inflStart, yMin), end - 1);
    const total = Object.values(inflWeights).reduce((a, b) => a + (+b || 0), 0);

    // weighted basket index per year (raw, shared base) where every weighted category has data
    const catSet = new Set(catYears);
    const basketIdx = {};
    if (cats) headYears.forEach(y => {
      if (!catSet.has(y)) return;
      let acc = 0, wsum = 0, ok = true;
      PI_CATS.forEach(c => {
        const v = cats[c.code]?.[y], w = inflWeights[c.code] || 0;
        if (v == null) { if (w > 0) ok = false; return; }
        acc += w * v; wsum += w;
      });
      if (ok && wsum > 0) basketIdx[y] = acc / wsum;
    });
    const basketYears = Object.keys(basketIdx).map(Number).sort((a, b) => a - b);
    const haveBasket = basketYears.length >= 2 && basketIdx[end] != null;
    const bStart = haveBasket ? Math.max(start, basketYears[0]) : start;

    const base = headline[start] || headline[headYears[0]];
    const series = headYears.filter(y => y >= Math.min(start, bStart)).map(y => ({
      year: y,
      official: headline[y] != null && base ? (headline[y] / base) * 100 : null,
      you: haveBasket && basketIdx[y] != null && basketIdx[bStart] ? (basketIdx[y] / basketIdx[bStart]) * 100 : null,
    }));

    const offAnnual = annualizedRate(headline, start, end) * 100;
    const youAnnual = haveBasket ? annualizedRate(basketIdx, bStart, end) * 100 : offAnnual;
    const youIdx = haveBasket && basketIdx[bStart] ? (basketIdx[end] / basketIdx[bStart]) * 100
      : (base ? (headline[end] / base) * 100 : 100);
    const offIdx = base ? (headline[end] / base) * 100 : 100;

    const catStart = (s) => { const ys = Object.keys(s || {}).map(Number); return ys.length ? Math.max(bStart, Math.min(...ys.filter(y => y <= end))) : bStart; };
    const categoryRates = Object.fromEntries(PI_CATS.map(c => {
      const s = cats?.[c.code]; const cs = s ? catStart(s) : bStart;
      return [c.code, s && s[cs] && s[end] != null ? annualizedRate(s, cs, end) * 100 : youAnnual];
    }));
    const contrib = PI_CATS.map(c => {
      const w = total > 0 ? (inflWeights[c.code] || 0) / total : 0;
      const s = cats?.[c.code]; const cs = s ? catStart(s) : bStart;
      const chg = (s && s[cs] && s[end] != null) ? (s[end] / s[cs] - 1) * 100 : 0;
      return { ...c, share: w, weight: inflWeights[c.code] || 0, chg, contribution: w * chg };
    }).sort((a, b) => b.contribution - a.contribution);
    const maxAbs = Math.max(0.01, ...contrib.map(c => Math.abs(c.contribution)));
    // explicit, sane y-range for the CPI index chart (the rebased series sits near 100) so the
    // axis can never auto-scale to a stray/huge value (#14)
    const seriesVals = series.flatMap(r => [r.official, r.you]).filter(v => v != null && isFinite(v));
    const seriesLo = seriesVals.length ? Math.floor(Math.min(...seriesVals) - 2) : 90;
    const seriesHi = seriesVals.length ? Math.ceil(Math.max(...seriesVals) + 2) : 130;
    return { total, series, youIdx, offIdx, youAnnual, offAnnual, categoryRates, contrib, maxAbs,
      start, end, bStart, haveBasket, yMin, yMax, seriesLo, seriesHi };
  }, [inflWeights, inflStart, inflEnd, inflData]);

  // keep the averaging window inside the available data range as the source/country changes.
  // When the end has to be clamped (e.g. live data only runs to 2024 but the default asked for
  // 2025), re-anchor the start to a clean 5-year span so the default matches the "5y" shortcut (#18).
  useEffect(() => {
    const { yMin, yMax } = piResult;
    if (yMax == null) return;
    let end = inflEnd, start = inflStart;
    if (end > yMax || end <= yMin) { end = yMax; start = Math.max(yMin, end - 5); }
    else if (start < yMin || start >= end) { start = Math.max(yMin, end - 5); }
    if (end !== inflEnd) setInflEnd(end);
    if (start !== inflStart) setInflStart(start);
  }, [piResult.yMin, piResult.yMax]);  // eslint-disable-line react-hooks/exhaustive-deps

  /* ── #5: projection inflation auto-tracks the My Inflation rate unless the user overrides ── */
  const autoInfl = useMemo(() => Math.round((piResult.youAnnual / 100) * 1000) / 1000, [piResult.youAnnual]);
  useEffect(() => {
    if (inflOverride) return;
    setScen(s => (s.A.infl === autoInfl && s.B.infl === autoInfl) ? s
      : { A: { ...s.A, infl: autoInfl }, B: { ...s.B, infl: autoInfl } });
  }, [autoInfl, inflOverride]);
  const setInfl = (v) => { setInflOverride(true); up("infl", v); };
  const resetInflAuto = () => { setInflOverride(false); setScen(s => ({ A: { ...s.A, infl: autoInfl }, B: { ...s.B, infl: autoInfl } })); };

  /* ── #2: when auto-income is on, drive each scenario's spend from its accumulated stack.
     Accumulation is independent of spend, so the rounded solution is a fixed point (no loop). ── */
  useEffect(() => {
    if (!autoIncome) return;
    setScen(s => {
      let changed = false; const next = { ...s };
      for (const key of compare ? ["A", "B"] : [active]) {
        const sc = s[key], m = modelOf(sc), n = normalize(sc);
        const accBtc = accumulateBtc(sc.btc, sc.monthly, n.retireAge - n.age, m);
        const inc = Math.round(solveSustainableIncome(accBtc, n.retireAge, n.age, sc.infl, m, n.endAge));
        if (sc.spend !== inc) { next[key] = { ...sc, spend: inc }; changed = true; }
      }
      return changed ? next : s;
    });
  }, [autoIncome, active, compare, scen]);
  const toggleAutoIncome = () => { setAutoIncome(v => !v); if (!autoIncome && brd.show) upBrd("show", false); };
  const toggleBridge = () => { const next = !brd.show; upBrd("show", next); if (next && autoIncome) setAutoIncome(false); };

  /* ── Forever stack ── */
  const sharedModel = useMemo(() => modelOf(scen.A), [scen.A]);
  // Pass rA.retStack so "You'll have" in the Forever card uses the same monthly-granularity
  // accumulation as the main simulation rather than the coarser annual approximation
  const fvrA = useMemo(() => calcForever(normalize(scen.A), sharedModel, rA.retStack), [scen.A, sharedModel, rA]);
  const fvrB = useMemo(() => compare && rB ? calcForever(normalize(scen.B), modelOf(scen.B), rB.retStack) : null, [scen.B, compare, rB]);
  const fvrCurve = useMemo(() => calcForeverCurve(normalize(scen.A), sharedModel, scen.A.endAge), [scen.A, sharedModel]);
  // #11: how the earliest forever-feasible retirement age moves with the target income
  const foreverTable = useMemo(() => {
    const base = scen.A.spend, n = normalize(scen.A);
    return [0.5, 0.75, 1, 1.25, 1.5].map(mult => {
      const income = Math.max(0, Math.round(base * mult / 500) * 500);
      return { income, mult, current: mult === 1, age: foreverFeasibleAge(n, income, sharedModel, scen.A.endAge) };
    });
  }, [scen.A, sharedModel]);

  /* ── Bridge stack (always computed; inherits age/btc/monthly/infl from scen.A) ── */
  const brdInput = useMemo(() => ({
    age: scen.A.age, currentBtc: scen.A.btc, monthly: scen.A.monthly, infl: scen.A.infl,
    retireAge: scen.A.retireAge, foreverIncome: brd.foreverIncome,
  }), [scen.A, brd.foreverIncome]);
  const brdResult = useMemo(() => calcBridge(brdInput, sharedModel, scen.A.endAge), [brdInput, sharedModel, scen.A.endAge]);
  const brdTimeline = useMemo(() => {
    if (!brdResult || brdResult.impossible) return null;
    // earlyRetireAge = bridge start; retireAge = forever start (bridgeEndAge in sim)
    const brdEff = { ...brdInput, retireAge: brdResult.earlyRetireAge, bridgeEndAge: brdResult.retireAge };
    return simulateBridgeFull(brdEff, sharedModel, scen.A.endAge);
  }, [brdInput, sharedModel, brdResult, scen.A.endAge]);

  /* ── Savings goal ── */
  const goalWithInfl = useMemo(() => ({ ...goal, infl: scen.A.infl }), [goal, scen.A.infl]);
  const goalResult = useMemo(() => tab === "savings" ? calcSavings(goalWithInfl, sharedModel) : null, [goalWithInfl, sharedModel, tab]);
  const mineResult = useMemo(() => tab === "mining"
    ? simulateMining({ ...mine, model: sharedModel, infl: scen.A.infl })
    : null, [mine, sharedModel, scen.A.infl, tab]);

  const curLocalSpot = scen[active].spot;
  // the actual live price in local currency (distinct from the model's spot, which the user can edit) (#25)
  const liveLocal = live.status === "ok" && live.prices ? localSpotFrom(live.prices, country) : null;
  const modelOutOfSync = liveLocal != null && Math.round(liveLocal) !== Math.round(curLocalSpot);
  const curUSDSpot = live.status === "ok" ? live.usd : curLocalSpot / (scen[active].fxRate ?? 1);
  const posRatio = curUSDSpot / fvToday;            // curve position always in USD

  const lens = useMemo(() => {
    const horizon = Math.max(normalize(scen.A).endAge, compare ? normalize(scen.B).endAge : 0) - scen.A.age;
    const startYear = 2011, endYear = Math.ceil(nowYear) + Math.min(12, Math.max(0, horizon));
    const histMap = new Map(BTC_HISTORY);
    const spotNow = live.status === "ok" ? live.usd : curUSDSpot;
    // anchor the whole power-law family at the first data point, so exponents fan out over time
    const daysAt = (year) => daysNow + (year - nowYear) * 365.25;
    const anchorP = BTC_HISTORY[0][1], anchorD = daysAt(BTC_HISTORY[0][0]);
    const curveN = (year, n) => anchorP * Math.pow(daysAt(year) / anchorD, n);
    const isPLA = scen.A.modelType !== "cagr", isPLB = scen.B.modelType !== "cagr";
    let maxV = spotNow, minV = anchorP;
    const rows = [];
    const push = (year) => {
      const r = { year, n4: curveN(year, 4), n5: curveN(year, 5), n6: curveN(year, 6) };
      if (isPLA) r.aLine = curveN(year, scen.A.exp);
      if (compare && isPLB) r.bLine = curveN(year, scen.B.exp);
      if (year <= nowYear && histMap.has(Math.round(year))) r.hist = histMap.get(Math.round(year));
      maxV = Math.max(maxV, r.n6, r.aLine || 0, r.bLine || 0, r.hist || 0);
      minV = Math.min(minV, r.n4, r.hist || Infinity);
      rows.push(r);
    };
    for (let y = startYear; y <= endYear; y++) push(y);
    const nowR = { year: nowYear, n4: curveN(nowYear, 4), n5: curveN(nowYear, 5), n6: curveN(nowYear, 6), hist: spotNow };
    if (isPLA) nowR.aLine = curveN(nowYear, scen.A.exp);
    if (compare && isPLB) nowR.bLine = curveN(nowYear, scen.B.exp);
    rows.push(nowR);
    rows.sort((a, b) => a.year - b.year);
    // the power-law fit is computed in USD (USD price history); convert to the active currency so the
    // axis matches the rest of the app instead of always reading in $ (#22)
    const fx = scen.A.fxRate ?? 1;
    const keys = ["n4", "n5", "n6", "aLine", "bLine", "hist"];
    if (fx !== 1) rows.forEach(r => keys.forEach(k => { if (r[k] != null) r[k] *= fx; }));
    let mn = Infinity, mx = 0;
    rows.forEach(r => keys.forEach(k => { if (r[k] != null && isFinite(r[k])) { mn = Math.min(mn, r[k]); mx = Math.max(mx, r[k]); } }));
    mn = Math.max(0.5, mn);
    const lo = Math.pow(10, Math.floor(Math.log10(mn)));
    const hi = Math.pow(10, Math.ceil(Math.log10(mx)));
    const ticks = []; for (let t = lo; t <= hi; t *= 10) ticks.push(t);
    return { rows, lo, hi, ticks, endYear, expA: scen.A.exp };
  }, [scen.A, scen.B, compare, live]);

  const VK = real ? "VR" : "V";

  // persistent hover readout: which dataset/row is pinned (defaults to retirement age)
  const pinView = mc ? (mc.compare ? "mccompare" : "mc") : compare ? "compare" : "single";
  const pinData = mc ? (mc.compare ? mc.fanC : mc.fan) : compare ? merged : rA.timeline;
  const pinTarget = pinAge != null ? pinAge : normalize(scen[mc && !mc.compare ? mc.scen : active]).retireAge;
  const pinRow = pinData.find(r => r.age === pinTarget)
    || pinData.find(r => r.age >= pinTarget) || pinData[pinData.length - 1];
  const pinCursor = { stroke: C.inkFaint, strokeWidth: 1, strokeDasharray: "3 3" };
  const onPin = (s) => { if (s && s.activeLabel != null) setPinAge(s.activeLabel); };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "'IBM Plex Sans',sans-serif",
      backgroundImage: `radial-gradient(900px 500px at 85% -10%, rgba(247,147,26,.10), transparent 60%),
        radial-gradient(700px 500px at -10% 110%, rgba(95,176,201,.05), transparent 60%)` }}>
      <style>{`
        * { box-sizing: border-box; }
        html, body { overflow-x: hidden; max-width: 100%; }
        input[type=number]::-webkit-inner-spin-button { opacity:.25; }
        .btc-range { -webkit-appearance:none; appearance:none; height:3px; background:${C.line}; border-radius:3px; outline:none; }
        .btc-range::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:18px; height:18px; border-radius:50%; background:${C.orange}; cursor:pointer; box-shadow:0 0 0 4px rgba(247,147,26,.18); }
        .btc-range::-moz-range-thumb { width:18px; height:18px; border:none; border-radius:50%; background:${C.orange}; cursor:pointer; box-shadow:0 0 0 4px rgba(247,147,26,.18); }
        .seg { font-family:'IBM Plex Sans',sans-serif; font-size:12px; letter-spacing:.04em; padding:8px 12px; border-radius:7px; cursor:pointer; border:1px solid transparent; background:transparent; color:${C.inkDim}; transition:all .15s; }
        .seg.on { background:${C.panel2}; color:${C.ink}; border-color:${C.line}; }
        .card { background:${C.panel}; border:1px solid ${C.line}; border-radius:14px; min-width:0; overflow:hidden; }
        .grid-wrap { min-width:0; }
        .grid-wrap > * { min-width:0; }
        .fade { animation: fade .5s ease both; }
        @keyframes fade { from { opacity:0; transform:translateY(8px);} to {opacity:1; transform:none;} }
        @media (max-width:820px){ .grid-wrap{ grid-template-columns:1fr !important; } }
        @media (max-width:640px){
          .header-main { flex-direction: column; }
          .header-market { width: 100%; justify-content: flex-start; }
        }
      `}</style>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "clamp(20px,4vw,44px)", overflowX: "hidden" }}>
        <header className="fade header-main" style={{ marginBottom: 26, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div className="header-brand">
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.orange,
              fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, letterSpacing: ".22em", textTransform: "uppercase" }}>
              <span style={{ width: 26, height: 26, borderRadius: "50%", background: C.orange, color: C.bg,
                display: "grid", placeItems: "center", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>₿</span>
              Sound Money · Retirement Engine
            </div>
            <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: "clamp(34px,6vw,60px)",
              lineHeight: 1.02, margin: "16px 0 8px", letterSpacing: "-.02em" }}>
              Stacking Sats<br /><span style={{ color: C.orange, fontStyle: "italic" }}>to Sunset.</span>
            </h1>
            <p style={{ color: C.inkDim, maxWidth: 560, fontSize: 15, lineHeight: 1.5 }}>
              Project a Bitcoin plan into retirement, compare two strategies, stress-test them against
              a crash, and see what the power-law exponent does to the curve.
            </p>
          </div>
          {/* Live market + currency picker — single row */}
          <div className="header-market" style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, paddingTop: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "4px 10px", flexWrap: "wrap",
              padding: "7px 12px", background: "rgba(255,255,255,.03)", borderRadius: 8,
              fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: C.inkDim }}>
              <span title={live.status === "ok" ? `Live price · ${live.src || "exchange"}` : "Price feed offline"}
                style={{ color: live.status === "ok" ? C.green : C.inkDim }}>●</span>
              <span style={{ color: C.ink, fontWeight: 600 }}>
                {live.status === "ok" && liveLocal ? `${cur}${Math.round(liveLocal).toLocaleString()}` : "—"}
              </span>
              <span>· fair {cur}{Math.round(fvToday * (scen[active].fxRate ?? 1)).toLocaleString()}</span>
              <span style={{ color: posRatio > 1.2 ? C.red : posRatio > 0.8 ? C.gold : C.green }}>
                · {Math.round(posRatio * 100)}%
              </span>
              {live.status === "ok" && live.ts && (
                <span style={{ color: C.inkFaint }}>· as of {new Date(live.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              )}
              <button className="seg" title="Refresh live price" onClick={() => fetchLive()} style={{ fontSize: 11, padding: "2px 8px" }}>↻</button>
              {modelOutOfSync && (
                <button className="seg" title={`The model uses ${cur}${Math.round(curLocalSpot).toLocaleString()} — click to use the live price`}
                  onClick={() => {
                    const spot = Math.round(liveLocal);
                    setScen(s => ({ ...s, A: { ...s.A, spot }, B: { ...s.B, spot } }));
                  }} style={{ fontSize: 11, padding: "2px 8px", color: C.orange }}>Use live ↑</button>
              )}
            </div>
            <div ref={countryRef} style={{ position: "relative" }}>
              <button className="seg on" onClick={() => setShowCountry(v => !v)}
                style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, padding: "9px 14px" }}>
                <span>{COUNTRIES[country].flag}</span>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>{COUNTRIES[country].cur}</span>
                <span style={{ color: C.inkDim, fontSize: 10 }}>▾</span>
              </button>
              {showCountry && (
                <div className="card fade" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 100, minWidth: 170, padding: 6 }}>
                  {Object.entries(COUNTRIES).map(([k, v]) => (
                    <button key={k} className={`seg ${country === k ? "on" : ""}`}
                      onClick={() => { pickCountry(k); setShowCountry(false); }}
                      style={{ display: "flex", gap: 9, width: "100%", textAlign: "left", marginBottom: 2 }}>
                      {v.flag} {v.label} <span style={{ marginLeft: "auto", color: C.inkDim }}>{v.cur}</span>
                      {geoDetected && (COUNTRIES[geoDetected] === v || (k === "EU" && EURO_MEMBERS[geoDetected] !== undefined)) &&
                        <span style={{ color: C.green, fontSize: 9, marginLeft: 4 }}>📍</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Tab bar ── */}
        <div style={{ display: "flex", gap: 6, marginBottom: 26, flexWrap: "wrap" }}>
          {[["inflation","My Inflation"],["retirement","Retirement"],["savings","Savings Goal"],["mining","Mining"]].map(([k, label]) => (
            <button key={k} className={`seg ${tab === k ? "on" : ""}`} style={{ padding: "9px 18px" }} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>

        {tab === "retirement" && <div className="grid-wrap" style={{ display: "grid", gap: 22, gridTemplateColumns: "minmax(0,340px) minmax(0,1fr)" }}>

          {/* ── INPUTS ── */}
          <section className="card fade" style={{ padding: 22, alignSelf: "start" }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              <button className={`seg ${!compare ? "on" : ""}`} style={{ flex: 1 }}
                onClick={() => { setCompare(false); setActive("A"); }}>Single</button>
              <button className={`seg ${compare ? "on" : ""}`} style={{ flex: 1 }} onClick={() => setCompare(true)}>Compare A / B</button>
            </div>

            {compare && (
              <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
                <button className={`seg ${active === "A" ? "on" : ""}`} style={{ flex: 1, display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}
                  onClick={() => setActive("A")}><Dot c={C.orange} /> Edit A</button>
                <button className={`seg ${active === "B" ? "on" : ""}`} style={{ flex: 1, display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}
                  onClick={() => setActive("B")}><Dot c={C.blue} /> Edit B</button>
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginBottom: 18, alignItems: "flex-end" }}>
              <label style={{ flex: 1, display: "block" }}>
                <div style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 11, letterSpacing: ".14em",
                  textTransform: "uppercase", color: C.inkDim, marginBottom: 7 }}>Age now</div>
                <NumIn value={p.age} onChange={(v) => up("age", v)} />
              </label>
              <label style={{ flex: 1, display: "block" }}>
                <div style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 11, letterSpacing: ".14em",
                  textTransform: "uppercase", color: C.inkDim, marginBottom: 7,
                  display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Retire at</span>
                  <button onClick={toggleBridge} style={{
                    background: brd.show ? "rgba(127,176,105,.18)" : "rgba(255,255,255,.06)",
                    border: `1px solid ${brd.show ? C.green : C.line}`,
                    borderRadius: 4, padding: "1px 8px", fontSize: 10,
                    fontFamily: "'IBM Plex Mono',monospace", letterSpacing: ".08em",
                    color: brd.show ? C.green : C.inkDim, cursor: "pointer", lineHeight: 1.8,
                    whiteSpace: "nowrap"
                  }}>
                    {brd.show ? "● auto" : "○ auto"}
                  </button>
                </div>
                <NumIn value={p.retireAge} onChange={(v) => up("retireAge", v)} disabled={brd.show} />
              </label>
            </div>
            <Field label="Bitcoin you hold today" suffix="BTC"><NumIn value={p.btc} onChange={(v) => up("btc", v)} prefix="₿" step={0.01} /></Field>
            <Field label="Monthly buy (DCA)" suffix="per month"><NumIn value={p.monthly} onChange={(v) => up("monthly", v)} prefix={cur} step={50} /></Field>
            <label style={{ display: "block", marginBottom: 18 }}>
              <div style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 11, letterSpacing: ".14em",
                textTransform: "uppercase", color: C.inkDim, marginBottom: 7, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span>{autoIncome ? "Income your stack supports" : "Retirement income wanted"}</span>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {/* #13: per-year / per-month unit toggle (income stored internally as annual) */}
                  <div style={{ display: "flex", border: `1px solid ${C.line}`, borderRadius: 4, overflow: "hidden" }}>
                    {[["yr", "/yr"], ["mo", "/mo"]].map(([u, lab]) => (
                      <button key={u} onClick={() => setIncomeUnit(u)} style={{
                        background: incomeUnit === u ? C.panel2 : "transparent",
                        border: "none", padding: "2px 7px", fontSize: 10,
                        fontFamily: "'IBM Plex Mono',monospace", letterSpacing: ".06em",
                        color: incomeUnit === u ? C.ink : C.inkFaint, cursor: "pointer", lineHeight: 1.8 }}>{lab}</button>
                    ))}
                  </div>
                  <button onClick={toggleAutoIncome} style={{
                    background: autoIncome ? "rgba(127,176,105,.18)" : "rgba(255,255,255,.06)",
                    border: `1px solid ${autoIncome ? C.green : C.line}`,
                    borderRadius: 4, padding: "1px 8px", fontSize: 10,
                    fontFamily: "'IBM Plex Mono',monospace", letterSpacing: ".08em",
                    color: autoIncome ? C.green : C.inkDim, cursor: "pointer", lineHeight: 1.8, whiteSpace: "nowrap"
                  }}>{autoIncome ? "● auto" : "○ auto"}</button>
                </div>
              </div>
              <NumIn
                value={incomeUnit === "mo" ? Math.round(p.spend / 12) : p.spend}
                onChange={(v) => up("spend", incomeUnit === "mo" ? Math.round(v * 12) : v)}
                prefix={cur} step={incomeUnit === "mo" ? 100 : 1000} disabled={autoIncome} />
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: autoIncome ? C.green : C.inkFaint, lineHeight: 1.5, marginTop: 6 }}>
                {autoIncome
                  ? `Max inflation-adjusted income this stack sustains to age ${normalize(p).endAge}${incomeUnit === "mo" ? " (shown per month)" : ""}.`
                  : `today's money / ${incomeUnit === "mo" ? "mo" : "yr"} — or switch on auto to solve income from your retire age.`}
              </div>
            </label>

            <div style={{ height: 1, background: C.line, margin: "6px 0 18px" }} />

            <Field label="Price model">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[["pl-fair", "Power law"], ["pl-cons", "PL · conservative"], ["cagr", "Flat return"]].map(([k, lab]) => (
                  <button key={k} className={`seg ${p.modelType === k ? "on" : ""}`} onClick={() => setModel(k)}>{lab}</button>
                ))}
              </div>
            </Field>
            <button onClick={() => setShowAdv(s => !s)} style={{ display: "block", background: "none", border: "none", color: C.inkDim, cursor: "pointer",
              fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 12, letterSpacing: ".08em", padding: "4px 0", marginTop: 4 }}>
              {showAdv ? "− Hide advanced" : "⚙ Advanced settings"}</button>
            {showAdv && (
              <div className="fade" style={{ marginTop: 14 }}>
                {isPL ? (
                  <>
                    <Field label="Power-law exponent" suffix="growth shape">
                      <Slider value={p.exp} onChange={(v) => up("exp", v)} min={3} max={6.5} step={0.1} fmt={(v) => `n = ${v.toFixed(1)}`} /></Field>
                    <Field label="Reversion to fair value" suffix="speed">
                      <Slider value={p.tau} onChange={(v) => up("tau", v)} min={0.5} max={8} step={0.5} fmt={(v) => `≈ ${v} yr${v === 1 ? "" : "s"} to close the gap`} /></Field>
                    <Field label="Gap closure to fair value" suffix={p.gap === 0 ? "stays cheap" : p.gap === 1 ? "full" : "partial"}>
                      <Slider value={p.gap} onChange={(v) => up("gap", v)} min={0} max={1} step={0.05}
                        fmt={(v) => v === 0 ? "0% · tracks today's discount forward" : v === 1 ? "100% · returns to fair value" : `${(v * 100).toFixed(0)}% of the gap closes`} /></Field>
                    <div style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 11, letterSpacing: ".14em",
                      textTransform: "uppercase", color: C.inkDim, marginBottom: 2, marginTop: 6 }}>Power law · history &amp; fit</div>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.inkFaint, marginBottom: 8, lineHeight: 1.45 }}>
                      White is BTC's real price; dashed are fair value at n = 4 / 5 / 6, anchored at 2011.
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={lens.rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke={C.line} strokeDasharray="2 4" vertical={false} />
                        <XAxis dataKey="year" type="number" domain={[2011, lens.endYear]} allowDecimals={false}
                          stroke={C.inkFaint} tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} tickLine={false} tickFormatter={(v) => `'${String(Math.round(v)).slice(2)}`} />
                        <YAxis scale="log" domain={[lens.lo, lens.hi]} ticks={lens.ticks} allowDataOverflow
                          stroke={C.inkFaint} tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} tickLine={false} width={46}
                          tickFormatter={(v) => (v < 1000 ? `${cur}${v}` : fmtMoney(v, cur))} />
                        <Tooltip content={<TTg fmt={(v) => fmtMoney(v, cur)} labelKey="year" />} />
                        <ReferenceLine x={nowYear} stroke={C.gold} strokeDasharray="3 3"
                          label={{ value: "now", fill: C.gold, fontSize: 10, position: "insideTopRight" }} />
                        <Line type="monotone" name="n=4" dataKey="n4" stroke={C.inkFaint} strokeWidth={1} dot={false} strokeDasharray="4 4" connectNulls />
                        <Line type="monotone" name="n=5" dataKey="n5" stroke={C.inkFaint} strokeWidth={1} dot={false} strokeDasharray="4 4" connectNulls />
                        <Line type="monotone" name="n=6" dataKey="n6" stroke={C.inkFaint} strokeWidth={1} dot={false} strokeDasharray="4 4" connectNulls />
                        <Line type="monotone" name="actual" dataKey="hist" stroke={C.ink} strokeWidth={2} dot={false} connectNulls />
                        <Line type="monotone" name={compare ? "A" : `n=${lens.expA.toFixed(1)}`} dataKey="aLine" stroke={C.orange} strokeWidth={2.5} dot={false} connectNulls />
                        {compare && <Line type="monotone" name="B" dataKey="bLine" stroke={C.blue} strokeWidth={2.5} dot={false} connectNulls />}
                      </LineChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "4px 0 12px",
                      fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: C.inkDim }}>
                      <span style={{ display: "flex", gap: 5, alignItems: "center" }}><span style={{ width: 12, height: 0, borderTop: `2px solid ${C.ink}` }} />actual</span>
                      <span style={{ display: "flex", gap: 5, alignItems: "center" }}><span style={{ width: 12, height: 0, borderTop: `2px solid ${C.orange}` }} />{compare ? "A" : "your n"}</span>
                      {compare && <span style={{ display: "flex", gap: 5, alignItems: "center" }}><span style={{ width: 12, height: 0, borderTop: `2px solid ${C.blue}` }} />B</span>}
                      <span style={{ display: "flex", gap: 5, alignItems: "center" }}><span style={{ width: 12, height: 0, borderTop: `1px dashed ${C.inkFaint}` }} />n=4/5/6</span>
                    </div>
                  </>
                ) : (
                  <Field label="Annual return" suffix="flat CAGR">
                    <Slider value={p.cagr} onChange={(v) => up("cagr", v)} min={0} max={0.4} step={0.01} fmt={(v) => `${(v * 100).toFixed(0)}% / yr`} /></Field>
                )}
                <Field label="Current BTC price" suffix={cur}><NumIn value={p.spot} onChange={(v) => up("spot", v)} prefix={cur} step={1000} /></Field>
                <Field label="Inflation" suffix={inflOverride ? "manual override" : "auto · My Inflation"}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7,
                    fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: inflOverride ? C.inkFaint : C.green }}>
                    {inflOverride ? (
                      <>↳ My Inflation rate: {(autoInfl * 100).toFixed(1)}%/yr
                        <button className="seg" style={{ padding: "3px 9px", fontSize: 11 }} onClick={resetInflAuto}>↺ Auto</button></>
                    ) : (
                      <>↳ Tracking your {COUNTRIES[country].label} basket · {(autoInfl * 100).toFixed(1)}%/yr</>
                    )}
                  </div>
                  <Slider value={p.infl} onChange={setInfl} min={0} max={0.12} step={0.001} fmt={(v) => `${(v * 100).toFixed(1)}% / yr`} />
                </Field>
                <Field label="Plan until age"><Slider value={p.endAge} onChange={(v) => up("endAge", v)} min={70} max={120} step={1} fmt={(v) => `${v} yrs old`} /></Field>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.inkFaint, lineHeight: 1.5, marginBottom: 16 }}>
                  Currency set by country selector (top right).
                </div>
              </div>
            )}

            {/* SAVED SCENARIOS */}
            <button onClick={() => setShowSaved(s => !s)} style={{ display: "block", width: "100%", textAlign: "left",
              background: "none", border: "none", borderTop: `1px solid ${C.line}`, color: C.inkDim, cursor: "pointer",
              fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 12, letterSpacing: ".08em", padding: "12px 0 4px", marginTop: 14 }}>
              {showSaved ? "− Hide saved scenarios" : "+ Saved scenarios"}{saved.length ? ` (${saved.length})` : ""}</button>
            {showSaved && (
              <div className="fade" style={{ marginTop: 12 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  <input value={nameInput} onChange={(e) => setNameInput(e.target.value)}
                    placeholder={`Name scenario ${active}…`}
                    style={{ flex: 1, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8,
                      color: C.ink, fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 13, padding: "9px 11px", outline: "none" }} />
                  <button className="seg on" onClick={saveCurrent} style={{ whiteSpace: "nowrap" }}>Save {active}</button>
                </div>
                {saved.length === 0 ? (
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: C.inkFaint }}>
                    No saved scenarios yet. Tune the inputs, name it, and save — it persists across sessions.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {saved.map(e => (
                      <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, background: C.panel2,
                        border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px" }}>
                        <span style={{ flex: 1, fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 13, color: C.ink,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
                        <button className="seg" onClick={() => loadInto(e)} style={{ padding: "4px 9px" }}>Load → {active}</button>
                        <button className="seg" onClick={() => removeSaved(e.id)} style={{ padding: "4px 8px", color: C.red }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Bridge Stack inputs ── */}
            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 16, marginTop: 4 }}>
              <button className="seg" style={{ width: "100%", textAlign: "left", padding: "8px 12px",
                border: `1px solid ${brd.show ? C.green : C.line}`, color: brd.show ? C.green : C.inkDim }}
                onClick={toggleBridge}>
                {brd.show ? "− Hide" : "+ Bridge Stack"} · two-phase retirement
              </button>
              {brd.show && (
                <div style={{ marginTop: 14 }}>
                  <Field label="Target income" suffix="today's money / yr">
                    <NumIn value={brd.foreverIncome} onChange={v => upBrd("foreverIncome", v)} prefix={cur} step={1000} />
                  </Field>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.inkFaint, lineHeight: 1.6 }}>
                    DCA fills the forever bucket first. Surplus sats form the bridge — shifting retirement earlier than the "Retire at" age.
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── RESULTS ── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 22 }}>

            {/* ① PORTFOLIO + SNAPSHOT (merged) */}
            <div className="card fade" style={{ padding: "20px 18px 16px",
              borderLeft: brd.show ? `3px solid ${C.green}` : !compare ? (rA.lasts ? `3px solid ${C.green}` : `3px solid ${C.red}`) : undefined }}>
              {brd.show && (
                brdResult.impossible ? (
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, color: C.red, lineHeight: 1.5 }}>
                    {brdResult.reason}
                  </div>
                ) : (
                  <div className="fade">
                    <div style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 11, letterSpacing: ".14em",
                      textTransform: "uppercase", color: C.green, marginBottom: 14 }}>Bridge Stack</div>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600,
                      fontSize: "clamp(22px,4.5vw,38px)", color: C.green, marginBottom: 4 }}>
                      Retire at {brdResult.earlyRetireAge}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, color: C.inkDim, marginBottom: 18 }}>
                      {brdResult.yearsEarly > 0
                        ? `${brdResult.yearsEarly} yr${brdResult.yearsEarly > 1 ? "s" : ""} earlier than planned · bridge to age ${brdResult.retireAge}, then forever income`
                        : `On target — forever income starts at age ${brdResult.retireAge}`}
                    </div>
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 18 }}>
                      <Stat label="Bridge BTC" big={fmtBtc(brdResult.bridgeBtc)}
                        sub={brdResult.yearsEarly > 0
                          ? `${cur}${brd.foreverIncome.toLocaleString()}/yr · ages ${brdResult.earlyRetireAge}–${brdResult.retireAge}`
                          : "no bridge needed"} color={C.gold} />
                      <Stat label="Forever BTC" big={fmtBtc(brdResult.foreverBtc)}
                        sub={`${cur}${brd.foreverIncome.toLocaleString()}/yr from age ${brdResult.retireAge}`} color={C.green} />
                      <Stat label="Total needed" big={fmtBtc(brdResult.reqBtc)}
                        sub={`at age ${brdResult.earlyRetireAge}`} color={C.orange} />
                    </div>
                    {brdTimeline && (
                      <PortfolioChart
                        data={brdTimeline}
                        retireAge={brdResult.earlyRetireAge}
                        pivotAge={brdResult.retireAge}
                        pivotLabel="forever"
                        real={real} cur={cur}
                        height={260}
                      />
                    )}
                  </div>
                )
              )}
              {!brd.show && <>
              {/* Status + key stats */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                {!compare ? (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
                    fontFamily: "'IBM Plex Mono',monospace", fontSize: 13,
                    color: rA.lasts ? C.green : C.red }}>
                    <Dot c={rA.lasts ? C.green : C.red} />
                    {rA.lasts
                      ? `Plan holds · survives past age ${normalize(scen.A).endAge}${mc ? " (central projection)" : ""}`
                      : `Stack runs dry at age ${rA.depletedAge}${mc ? " (central projection)" : ""}`}
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: C.orange }}><Dot c={C.orange} /> A {rA.lasts ? <span style={{ color: C.green }}>holds</span> : <span style={{ color: C.red }}>dry @{rA.depletedAge}</span>}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: C.blue }}><Dot c={C.blue} /> B {rB && (rB.lasts ? <span style={{ color: C.green }}>holds</span> : <span style={{ color: C.red }}>dry @{rB.depletedAge}</span>)}</span>
                  </div>
                )}
                {!mc ? (
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button className={`seg ${!real ? "on" : ""}`} onClick={() => setReal(false)}>Nominal</button>
                    <button className={`seg ${real ? "on" : ""}`} onClick={() => setReal(true)}>{`Today's ${cur}`}</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 10, alignItems: "center", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.inkDim }}>
                    <span>volatility · {mc.nPaths} paths · {mc.compare ? "A vs B median" : `today's ${cur}`}</span>
                    {compare && !mc.compare && <span style={{ color: mc.scen === "A" ? C.orange : C.blue, display: "flex", gap: 6, alignItems: "center" }}>
                      <Dot c={mc.scen === "A" ? C.orange : C.blue} /> {mc.scen}</span>}
                  </div>
                )}
              </div>
              {/* Inflation assumption is shared with the My Inflation tab — surface it so changes
                  there aren't invisible here (#19) */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14,
                fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.inkFaint }}>
                <span>Inflation assumption:</span>
                <span style={{ color: C.ink }}>{(p.infl * 100).toFixed(1)}%/yr</span>
                <span style={{ color: inflOverride ? C.inkFaint : C.green }}>
                  · {inflOverride ? "manual override" : `auto from My Inflation (${COUNTRIES[country].label})`}
                </span>
                <button className="seg" onClick={() => setTab("inflation")}
                  style={{ padding: "2px 8px", fontSize: 10 }}>adjust ↗</button>
              </div>
              {!mc && !compare ? (
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 4 }}>
                  <Stat label="Stack at retirement" big={fmtBtc(rA.retStack)} sub={`from ₿${p.btc} + DCA`} color={C.orange} />
                  <Stat label={`Value at ${p.retireAge}`} big={fmtMoney(rA.retValue, cur)}
                    sub={`≈ ${fmtMoney(rA.retValueReal, cur)} today`} color={C.gold} />
                  <Stat label="BTC price then" big={fmtMoney(rA.retPrice, cur)}
                    sub={`${cur}${Math.round(p.spot).toLocaleString()} today`} />
                </div>
              ) : !mc && compare ? (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 4 }}>
                    <div style={{ flex: "1.3 1 0" }} />
                    <div style={{ flex: "1 1 0", textAlign: "right", color: C.orange, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}>A</div>
                    <div style={{ flex: "1 1 0", textAlign: "right", color: C.blue, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}>B</div>
                  </div>
                  <CmpRow label="Stack at retirement" a={fmtBtc(rA.retStack)} b={fmtBtc(rB.retStack)} ca={C.orange} cb={C.blue} />
                  <CmpRow label="Value at retirement" a={fmtMoney(rA.retValue, cur)} b={fmtMoney(rB.retValue, cur)} ca={C.orange} cb={C.blue} />
                  <CmpRow label="… in today's money" a={fmtMoney(rA.retValueReal, cur)} b={fmtMoney(rB.retValueReal, cur)} ca={C.inkDim} cb={C.inkDim} />
                </div>
              ) : null}

              {!mc ? (
                <>
                  {!compare ? (
                    <PortfolioChart
                      data={rA.timeline}
                      retireAge={p.retireAge}
                      real={real} cur={cur}
                      onMouseMove={onPin} pinCursor={pinCursor}
                      shockOn={shock.on} shockX2={Math.min(p.endAge, p.retireAge + shock.recovery)}
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height={270}>
                      <ComposedChart data={merged} onMouseMove={onPin} margin={{ top: 14, right: 8, left: 4, bottom: 0 }}>
                        <CartesianGrid stroke={C.line} strokeDasharray="2 4" vertical={false} />
                        {ageValBtcAxes(cur)}
                        <Tooltip cursor={pinCursor} content={<TTvalue sym={cur} real={real} compare />} />
                        <ReferenceLine yAxisId="val" x={normalize(scen.A).retireAge} stroke={C.gold} strokeDasharray="3 3" />
                        <Line yAxisId="val" type="monotone" name="A value" dataKey={"a" + VK} stroke={C.orange} strokeWidth={2} dot={false} connectNulls />
                        <Line yAxisId="val" type="monotone" name="B value" dataKey={"b" + VK} stroke={C.blue} strokeWidth={2} dot={false} connectNulls />
                        <Line yAxisId="val" type="monotone" name="BTC price" dataKey="aPrice" stroke={C.inkDim} strokeWidth={1.5} dot={false} strokeDasharray="2 4" opacity={0.7} connectNulls />
                        <Line yAxisId="btc" type="monotone" name="A BTC" dataKey="aB" stroke={C.orange} strokeWidth={1.5} dot={false} strokeDasharray="5 3" opacity={0.6} connectNulls />
                        <Line yAxisId="btc" type="monotone" name="B BTC" dataKey="bB" stroke={C.blue} strokeWidth={1.5} dot={false} strokeDasharray="5 3" opacity={0.6} connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </>
              ) : mc.compare ? (
                <div className="fade">
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap", padding: "14px 4px 14px" }}>
                    <Stat label={<span><Dot c={C.orange} /> A · survives to {mc.A.endAge}</span>}
                      big={`${(mc.A.successRate * 100).toFixed(0)}%`}
                      color={mc.A.successRate >= 0.8 ? C.green : mc.A.successRate >= 0.5 ? C.gold : C.red}
                      sub={`median ${fmtMoney(mc.A.medianTerminal, cur)}`} />
                    <Stat label={<span><Dot c={C.blue} /> B · survives to {mc.B.endAge}</span>}
                      big={`${(mc.B.successRate * 100).toFixed(0)}%`}
                      color={mc.B.successRate >= 0.8 ? C.green : mc.B.successRate >= 0.5 ? C.gold : C.red}
                      sub={`median ${fmtMoney(mc.B.medianTerminal, cur)}`} />
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={mc.fanC} onMouseMove={onPin} margin={{ top: 10, right: 8, left: 4, bottom: 0 }}>
                      <CartesianGrid stroke={C.line} strokeDasharray="2 4" vertical={false} />
                      {ageValBtcAxes(cur)}
                      <Tooltip cursor={pinCursor} content={<TTmc sym={cur} compare />} />
                      <ReferenceLine yAxisId="val" x={normalize(scen.A).retireAge} stroke={C.orange} strokeDasharray="3 3" opacity={0.5} />
                      <ReferenceLine yAxisId="val" x={normalize(scen.B).retireAge} stroke={C.blue} strokeDasharray="3 3" opacity={0.5} />
                      <Line yAxisId="val" type="monotone" name="A median" dataKey="aP50" stroke={C.orange} strokeWidth={2} dot={false} connectNulls />
                      <Line yAxisId="val" type="monotone" name="B median" dataKey="bP50" stroke={C.blue} strokeWidth={2} dot={false} connectNulls />
                      <Line yAxisId="btc" type="monotone" name="A BTC" dataKey="aBtc" stroke={C.orange} strokeWidth={1.5} dot={false} strokeDasharray="5 3" opacity={0.55} connectNulls />
                      <Line yAxisId="btc" type="monotone" name="B BTC" dataKey="bBtc" stroke={C.blue} strokeWidth={1.5} dot={false} strokeDasharray="5 3" opacity={0.55} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "8px 4px 0",
                    fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.inkDim }}>
                    <span style={{ display: "flex", gap: 6, alignItems: "center" }}><span style={{ width: 14, height: 0, borderTop: `2px solid ${C.orange}` }} />A · B median value</span>
                    <span style={{ display: "flex", gap: 6, alignItems: "center" }}><span style={{ width: 14, height: 0, borderTop: `2px dashed ${C.gold}` }} />BTC balance (right)</span>
                  </div>
                </div>
              ) : (
                <div className="fade">
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap", padding: "14px 4px 14px" }}>
                    <Stat label={`Survives to ${normalize(scen[mc.scen]).endAge}`}
                      big={`${(mc.successRate * 100).toFixed(0)}%`}
                      color={mc.successRate >= 0.8 ? C.green : mc.successRate >= 0.5 ? C.gold : C.red}
                      sub={`of ${mc.nPaths} paths`} />
                    <Stat label={`Median at age ${normalize(scen[mc.scen]).retireAge}`} big={fmtMoney(mc.medianRet, cur)}
                      sub={`today's ${cur} · at retirement`} color={C.gold} />
                    <Stat label={`Median at age ${normalize(scen[mc.scen]).endAge}`} big={fmtMoney(mc.medianTerminal, cur)}
                      sub={mc.medianTerminal > 0 ? `today's ${cur} · what's left`
                        : mc.medianFailAge ? `depleted — most run dry ~age ${mc.medianFailAge}` : `today's ${cur}`}
                      color={mc.medianTerminal > 0 ? C.gold : C.red} />
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={mc.fan} onMouseMove={onPin} margin={{ top: 10, right: 8, left: 4, bottom: 0 }}>
                      <CartesianGrid stroke={C.line} strokeDasharray="2 4" vertical={false} />
                      {ageValBtcAxes(cur)}
                      <Tooltip cursor={pinCursor} content={<TTmc sym={cur} />} />
                      <ReferenceLine yAxisId="val" x={normalize(scen[mc.scen]).retireAge} stroke={C.gold} strokeDasharray="3 3"
                        label={{ value: "retire", fill: C.gold, fontSize: 10, position: "insideTopRight" }} />
                      <Area yAxisId="val" dataKey="b1090" stroke="none" fill={C.orange} fillOpacity={0.12} />
                      <Area yAxisId="val" dataKey="b2575" stroke="none" fill={C.orange} fillOpacity={0.22} />
                      <Line yAxisId="val" dataKey="p50" stroke={C.orange} strokeWidth={2} dot={false} />
                      <Line yAxisId="btc" type="monotone" name="Median BTC" dataKey="p50btc" stroke={C.gold} strokeWidth={1.5} dot={false} strokeDasharray="5 3" opacity={0.8} />
                    </ComposedChart>
                  </ResponsiveContainer>
                  {mc.medianFailAge && <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.red, padding: "8px 4px 0", lineHeight: 1.5 }}>
                    Across simulations, the failing paths run dry around age {mc.medianFailAge} (median).{" "}
                    <span style={{ color: C.inkFaint }}>
                      {rA.lasts
                        ? `The central projection (no volatility) survives to ${normalize(scen.A).endAge}.`
                        : `The central projection runs dry at ${rA.depletedAge} — the spread reflects volatility.`}
                    </span></div>}
                </div>
              )}

              <PinTable row={pinRow} view={pinView} real={real} sym={cur} />

              {/* Stress test */}
              {!compare && !mc && (
                <div style={{ marginTop: 12, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: shock.on ? 12 : 0 }}>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11,
                      color: shock.on ? C.red : C.inkDim, letterSpacing: ".06em", flex: 1 }}>⚡ stress test</span>
                    <button className={`seg ${!shock.on ? "on" : ""}`}
                      onClick={() => setShock(s => ({ ...s, on: false }))}
                      style={{ padding: "3px 10px", fontSize: 11 }}>Off</button>
                    <button className={`seg ${shock.on ? "on" : ""}`}
                      onClick={() => setShock(s => ({ ...s, on: true }))}
                      style={{ padding: "3px 10px", fontSize: 11 }}>On</button>
                  </div>
                  {shock.on && (() => {
                    const base = simulate(normalize(scen.A, { ...shock, on: false }));
                    return (
                      <div className="fade">
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
                          <div style={{ flex: 1, minWidth: 120 }}>
                            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: C.inkFaint, marginBottom: 4 }}>
                              Crash: −{(shock.depth * 100).toFixed(0)}%
                            </div>
                            <input type="range" min={0.3} max={0.9} step={0.05} value={shock.depth}
                              onChange={(e) => setShock(s => ({ ...s, depth: parseFloat(e.target.value) }))}
                              className="btc-range" style={{ width: "100%" }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 120 }}>
                            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: C.inkFaint, marginBottom: 4 }}>
                              Recovery: {shock.recovery} yr{shock.recovery > 1 ? "s" : ""}
                            </div>
                            <input type="range" min={1} max={10} step={1} value={shock.recovery}
                              onChange={(e) => setShock(s => ({ ...s, recovery: parseFloat(e.target.value) }))}
                              className="btc-range" style={{ width: "100%" }} />
                          </div>
                        </div>
                        <div style={{ padding: "10px 12px", background: "rgba(217,104,91,.08)",
                          border: `1px solid ${C.red}`, borderRadius: 8 }}>
                          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                            <div>
                              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: C.inkFaint,
                                marginBottom: 3, textTransform: "uppercase", letterSpacing: ".1em" }}>Value at retirement</div>
                              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>
                                <span style={{ color: C.inkDim, textDecoration: "line-through" }}>{fmtMoney(base.retValue, cur)}</span>
                                <span style={{ color: C.red, marginLeft: 8 }}>→ {fmtMoney(rA.retValue, cur)}</span>
                              </div>
                            </div>
                            <div>
                              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: C.inkFaint,
                                marginBottom: 3, textTransform: "uppercase", letterSpacing: ".1em" }}>Outlook</div>
                              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>
                                <span style={{ color: C.inkDim, textDecoration: "line-through" }}>
                                  {base.lasts ? `holds to ${normalize(scen.A).endAge}` : `dry @ ${base.depletedAge}`}
                                </span>
                                <span style={{ color: rA.lasts ? C.green : C.red, marginLeft: 8 }}>
                                  → {rA.lasts ? `holds to ${normalize(scen.A).endAge}` : `dry @ ${rA.depletedAge}`}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* volatility calculation — bottom disclosure */}
              <div style={{ marginTop: 16, borderTop: `1px solid ${C.line}`, paddingTop: 6 }}>
                <button onClick={() => setShowVolOpts(s => !s)} style={{ width: "100%", display: "flex",
                  justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer",
                  fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase",
                  color: mc ? C.orange : C.inkDim, padding: "8px 4px" }}>
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {mc && <Dot c={C.orange} />} Volatility {mc ? (mcBusy ? "· syncing…" : "· showing") : "calculation"}
                  </span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>{showVolOpts ? "▾" : "▸"}</span>
                </button>
                {showVolOpts && (
                  <div className="fade" style={{ paddingTop: 6 }}>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: C.inkFaint, padding: "0 4px 14px" }}>
                      Replaces the projection with random paths from today's position on the curve, reverting toward fair value by your gap-closure over τ, with volatility decaying toward a floor.{compare ? ` Runs on scenario ${active}.` : ""}
                    </div>
                    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr", padding: "0 4px" }}>
                      <Field label="Volatility today" suffix="annualized">
                        <Slider value={mcVol.start} onChange={(v) => setMcVol(s => ({ ...s, start: v }))} min={0.2} max={0.9} step={0.05} fmt={(v) => `${(v * 100).toFixed(0)}%`} /></Field>
                      <Field label="Long-run floor" suffix="annualized">
                        <Slider value={mcVol.floor} onChange={(v) => setMcVol(s => ({ ...s, floor: v }))} min={0.1} max={0.5} step={0.05} fmt={(v) => `${(v * 100).toFixed(0)}%`} /></Field>
                    </div>
                    <div style={{ padding: "0 4px" }}>
                      <Field label="Volatility decay half-life">
                        <Slider value={mcVol.half} onChange={(v) => setMcVol(s => ({ ...s, half: v }))} min={2} max={20} step={1} fmt={(v) => `${v} yrs to halve the gap`} /></Field>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "0 4px", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        {[[300, "Fast"], [700, "Balanced"], [1500, "Fine"]].map(([n, lab]) => (
                          <button key={n} className={`seg ${mcPaths === n ? "on" : ""}`} onClick={() => setMcPaths(n)}>{lab}</button>
                        ))}
                      </div>
                      <button onClick={runMonteCarlo} disabled={mcBusy} style={{
                        flex: 1, minWidth: 110, background: C.orange, color: C.bg, border: "none", borderRadius: 8,
                        padding: "11px 14px", cursor: mcBusy ? "default" : "pointer", opacity: mcBusy ? 0.6 : 1,
                        fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: ".04em" }}>
                        {mcBusy ? "Running…" : mc ? `Re-run ${mcPaths} paths` : `Run ${mcPaths} paths`}
                      </button>
                      <button onClick={() => setMc(null)} disabled={!mc} style={{
                        background: "transparent", color: mc ? C.ink : C.inkFaint, border: `1px solid ${C.line}`, borderRadius: 8,
                        padding: "11px 16px", cursor: mc ? "pointer" : "default", opacity: mc ? 1 : 0.5,
                        fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: ".04em" }}>
                        Reset
                      </button>
                    </div>
                  </div>
                )}
              </div>
              </>}
            </div>

            {/* ③ FOREVER STACK */}
            <div className="card fade" style={{ padding: 22, borderLeft: `3px solid ${C.green}` }}>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", color: C.green, marginBottom: 10 }}>
                Forever Stack
              </div>
              {/* #11: state the income this card is solving for, and whether it's auto */}
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: C.inkDim, marginBottom: 16, lineHeight: 1.5 }}>
                Solving for <span style={{ color: C.ink, fontWeight: 600 }}>{cur}{p.spend.toLocaleString()}/yr</span> in today's money
                {autoIncome ? <span style={{ color: C.green }}> · auto-solved from your stack</span> : " · your target retirement income"}.
              </div>
              <>
                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 10 }}>
                    <Stat label="Required BTC" big={fmtBtc(fvrA.reqBtc)} sub={`to survive to age ${normalize(scen.A).endAge}`} color={C.orange} />
                    <Stat label="You'll have" big={fmtBtc(fvrA.accBtc)} sub={fvrA.accBtc >= fvrA.reqBtc ? "surplus ✓" : "short of target"} color={fvrA.accBtc >= fvrA.reqBtc ? C.green : C.red} />
                    <Stat label="Implied real return" big={`${(fvrA.realReturn * 100).toFixed(1)}%/yr`} sub="BTC CAGR − inflation" color={C.gold} />
                  </div>
                  {/* #20: clarify "You'll have" is the deterministic projected stack, not the MC median */}
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.inkFaint, marginBottom: 18, lineHeight: 1.5 }}>
                    “You'll have” is your projected stack at age {normalize(scen.A).retireAge} on the central price path (same as “Stack at retirement” above). The Monte-Carlo median balance can differ — it's the midpoint of many volatile paths.
                  </div>
                  {fvrA.neededDCA && (
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: C.inkDim, marginBottom: 18, padding: "10px 12px", background: C.panel2, borderRadius: 8 }}>
                      To close the gap: DCA <span style={{ color: C.orange }}>{cur}{Math.round(fvrA.neededDCA).toLocaleString()}/mo</span> instead of {cur}{p.monthly.toLocaleString()}/mo
                    </div>
                  )}
                  {!compare ? (
                    <>
                    <div style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: C.inkDim, marginBottom: 6 }}>
                      BTC needed vs. BTC accumulated, by retirement age
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <ComposedChart data={fvrCurve} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                        <defs>
                          <linearGradient id="grnFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={C.green} stopOpacity={0.25} />
                            <stop offset="95%" stopColor={C.green} stopOpacity={0.03} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke={C.line} vertical={false} />
                        <XAxis dataKey="age" stroke={C.inkFaint} tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} tickLine={false}
                          label={{ value: "Retirement age", position: "insideBottom", offset: -2, fill: C.inkFaint, fontSize: 10, fontFamily: "IBM Plex Mono" }} />
                        <YAxis stroke={C.inkFaint} tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} tickLine={false} width={40}
                          tickFormatter={v => v >= 1 ? `₿${v.toFixed(0)}` : v >= 0.01 ? `₿${v.toFixed(2)}` : `₿${v.toFixed(3)}`}
                          label={{ value: "BTC (₿)", angle: -90, position: "insideLeft", fill: C.inkFaint, fontSize: 10, fontFamily: "IBM Plex Mono", style: { textAnchor: "middle" } }} />
                        <Tooltip
                          contentStyle={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 12, fontFamily: "IBM Plex Mono" }}
                          labelFormatter={l => `Age ${l}`}
                          formatter={(v, name) => [fmtBtc(v), name]}
                        />
                        <Area type="monotone" dataKey="accBtc" name="Projected stack" fill="url(#grnFill)" stroke={C.green} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="reqBtc" name="Required to last" stroke={C.orange} strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls={false} />
                        <ReferenceLine x={p.retireAge} stroke={C.gold} strokeDasharray="3 3" label={{ value: `retire ${p.retireAge}`, position: "insideTopRight", fill: C.gold, fontSize: 10, fontFamily: "IBM Plex Mono" }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "6px 4px 0",
                      fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.inkDim }}>
                      <span style={{ display: "flex", gap: 6, alignItems: "center" }}><span style={{ width: 14, height: 0, borderTop: `2px solid ${C.green}` }} />Projected stack (you'll have)</span>
                      <span style={{ display: "flex", gap: 6, alignItems: "center" }}><span style={{ width: 14, height: 0, borderTop: `2px dashed ${C.orange}` }} />Required to last to {normalize(scen.A).endAge}</span>
                    </div>
                    {/* #11: how the feasible retirement age shifts with target income */}
                    <div style={{ marginTop: 18, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
                      <div style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: C.inkDim, marginBottom: 6 }}>
                        Income → earliest forever-feasible retirement
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                        <div style={{ display: "contents", fontFamily: "'IBM Plex Mono',monospace" }}>
                          <span style={{ fontSize: 10, color: C.inkFaint, padding: "4px 0", textTransform: "uppercase", letterSpacing: ".1em" }}>Income / yr</span>
                          <span style={{ fontSize: 10, color: C.inkFaint, padding: "4px 0", textAlign: "right", textTransform: "uppercase", letterSpacing: ".1em" }}>Retire by</span>
                        </div>
                        {foreverTable.map((r, i) => (
                          <div key={i} style={{ display: "contents" }}>
                            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, padding: "6px 0", borderTop: `1px solid ${C.line}`,
                              color: r.current ? C.green : C.ink }}>
                              {cur}{r.income.toLocaleString()}{r.current ? " ←" : ""}
                            </span>
                            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, padding: "6px 0", borderTop: `1px solid ${C.line}`, textAlign: "right",
                              color: r.age == null ? C.red : r.current ? C.green : C.gold }}>
                              {r.age != null ? `age ${r.age}` : `not by ${Math.min(scen.A.endAge - 1, 90)}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    </>
                  ) : fvrB && fvrB.possible ? (
                    <>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 4 }}>
                        <div style={{ flex: "1.3 1 0" }} />
                        <div style={{ flex: "1 1 0", textAlign: "right", color: C.orange, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}>A</div>
                        <div style={{ flex: "1 1 0", textAlign: "right", color: C.blue, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}>B</div>
                      </div>
                      <CmpRow label="Req. BTC" a={fmtBtc(fvrA.reqBtc)} b={fmtBtc(fvrB.reqBtc)} ca={C.orange} cb={C.blue} />
                      <CmpRow label="You'll have" a={fmtBtc(fvrA.accBtc)} b={fmtBtc(fvrB.accBtc)} ca={fvrA.accBtc >= fvrA.reqBtc ? C.green : C.red} cb={fvrB.accBtc >= fvrB.reqBtc ? C.green : C.red} />
                      <CmpRow label="Real return" a={`${(fvrA.realReturn*100).toFixed(1)}%`} b={`${(fvrB.realReturn*100).toFixed(1)}%`} ca={C.gold} cb={C.gold} />
                    </>
                  ) : fvrB && !fvrB.possible ? (
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: C.red }}>Scenario B: real return ≤ inflation — perpetual income not achievable.</div>
                  ) : null}
              </>
            </div>

          </section>
        </div>}

        {/* ══════════════════════════════════════════
            TAB: MY INFLATION
        ══════════════════════════════════════════ */}
        {tab === "inflation" && (() => {
          const { isEuro, headSrc, catSrc, basketLoading, headLive } = inflData;
          const haveBasket = piResult.haveBasket;
          const winYears = []; for (let y = piResult.yMin; y <= piResult.yMax; y++) winYears.push(y);
          const sourceLabel = [headSrc, isEuro && catSrc].filter(Boolean).join(" · ");
          const catChg = Object.fromEntries(piResult.contrib.map(c => [c.code, c.chg]));
          const setWindow = (span) => { setInflEnd(piResult.yMax); setInflStart(Math.max(piResult.yMin, piResult.yMax - span)); };
          return (
          <div className="fade">
            {/* ── Header: country, source, averaging window (#6) ── */}
            <div className="card" style={{ padding: "16px 20px", marginBottom: 22, display: "flex", flexWrap: "wrap",
              alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: C.inkDim, marginBottom: 6 }}>
                  {COUNTRIES[country].flag} {COUNTRIES[country].label} · live CPI{!headLive ? " (offline)" : ""}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.inkFaint }}>
                  Source: <SourceCite label={sourceLabel} /> · index back to {piResult.yMin}
                </div>
                {isEuro && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
                    {Object.entries(EURO_GEOS).map(([k, g]) => (
                      <button key={k} className={`seg ${euroGeo === k ? "on" : ""}`} onClick={() => setEuroGeo(k)}
                        style={{ fontSize: 11, padding: "5px 9px" }}>{g.label}</button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: C.inkDim }}>
                  <span>Average</span>
                  <select value={piResult.start} onChange={e => setInflStart(+e.target.value)}
                    style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 6, color: C.ink, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, padding: "5px 7px" }}>
                    {winYears.filter(y => y < piResult.end).map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <span>→</span>
                  <select value={piResult.end} onChange={e => setInflEnd(+e.target.value)}
                    style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 6, color: C.ink, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, padding: "5px 7px" }}>
                    {winYears.filter(y => y > piResult.start).map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  <button className={`seg ${piResult.end - piResult.start === 5 ? "on" : ""}`} onClick={() => setWindow(5)} style={{ fontSize: 11 }}>5y</button>
                  <button className={`seg ${piResult.end - piResult.start === 10 ? "on" : ""}`} onClick={() => setWindow(10)} style={{ fontSize: 11 }}>10y</button>
                  <button className={`seg ${piResult.start === piResult.yMin ? "on" : ""}`} onClick={() => setWindow(999)} style={{ fontSize: 11 }}>Since {piResult.yMin}</button>
                </div>
              </div>
            </div>

            <div className="grid-wrap" style={{ display: "grid", gap: 22, gridTemplateColumns: haveBasket ? "minmax(0,1fr) minmax(0,1fr)" : "minmax(0,1fr)" }}>
              {/* Left: readout */}
              <section className="card" style={{ padding: 22 }}>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600, fontSize: "clamp(48px,9vw,78px)", color: C.orange, lineHeight: 0.9, marginBottom: 6 }}>
                  {piResult.youAnnual >= 0 ? "+" : ""}{piResult.youAnnual.toFixed(1)}%
                </div>
                <div style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 12, color: C.inkDim, marginBottom: 22 }}>
                  per year · {haveBasket ? "your basket" : "headline CPI"} · {piResult.start}–{piResult.end}
                </div>
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 22 }}>
                  <Stat label="Official headline" big={`${piResult.offAnnual.toFixed(1)}%/yr`} color={C.inkDim} />
                  {haveBasket && <Stat label="Gap vs official" big={`${piResult.youAnnual - piResult.offAnnual >= 0 ? "+" : ""}${(piResult.youAnnual - piResult.offAnnual).toFixed(1)}%`}
                    color={piResult.youAnnual > piResult.offAnnual ? C.red : C.green} />}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: C.inkDim, marginBottom: 20, lineHeight: 1.55 }}>
                  What cost <span style={{ color: C.ink }}>{cur}100</span> in {piResult.start} now costs{" "}
                  <span style={{ color: C.orange, fontWeight: 600 }}>{cur}{(haveBasket ? piResult.youIdx : piResult.offIdx).toFixed(2)}</span>
                  {haveBasket && <> — official basket says <span style={{ color: C.inkDim }}>{cur}{piResult.offIdx.toFixed(2)}</span></>}.
                </div>
                <ResponsiveContainer width="100%" height={210}>
                  <LineChart data={piResult.series} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke={C.line} vertical={false} />
                    <XAxis dataKey="year" stroke={C.inkFaint} tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} tickLine={false} />
                    <YAxis domain={[piResult.seriesLo, piResult.seriesHi]} allowDataOverflow allowDecimals={false}
                      stroke={C.inkFaint} tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} tickLine={false} tickFormatter={v => Math.round(v)} />
                    <Tooltip content={<TTg fmt={v => v.toFixed(1)} />} />
                    <ReferenceLine x={piResult.start} stroke={C.inkFaint} strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="official" stroke={C.inkDim} strokeWidth={1.5} dot={false} strokeDasharray="4 3" name="Official" connectNulls />
                    {haveBasket && <Line type="monotone" dataKey="you" stroke={C.orange} strokeWidth={2.5} dot={false} name="You" connectNulls />}
                    <ReferenceDot x={piResult.end} y={haveBasket ? piResult.youIdx : piResult.offIdx} r={4} fill={C.orange} stroke={C.bg} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
                {haveBasket && (
                  <div style={{ marginTop: 16, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", color: C.inkDim, marginBottom: 8 }}>
                      Contribution to your inflation · {piResult.start}–{piResult.end}
                    </div>
                    {piResult.contrib.map(c => {
                      const pos = c.contribution >= 0;
                      const wpx = (Math.abs(c.contribution) / piResult.maxAbs) * 44;
                      return (
                        <div key={c.code} style={{ display: "grid", gridTemplateColumns: "22px 1fr 80px 52px", gap: 8, alignItems: "center", padding: "5px 0", borderTop: `1px solid ${C.line}` }}>
                          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.inkFaint }}>{c.code}</span>
                          <span style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 12 }}>{c.en}</span>
                          <div style={{ position: "relative", height: 14 }}>
                            <div style={{ position: "absolute", left: pos ? "50%" : `${50 - wpx}%`, width: `${wpx}%`, top: 2, height: 10, borderRadius: 2, background: pos ? C.red : C.green, opacity: c.weight === 0 ? 0.2 : 0.8 }} />
                            <div style={{ position: "absolute", left: "50%", top: -1, bottom: -1, width: 1, background: C.line }} />
                          </div>
                          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, textAlign: "right", color: pos ? C.red : C.green }}>
                            {pos ? "+" : "−"}{Math.abs(c.contribution).toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Right: spending-mix controls (euro basket only) */}
              {haveBasket ? (
                <section className="card" style={{ padding: 22, alignSelf: "start" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", color: C.inkDim, marginBottom: 14 }}>
                    Set your spending mix · {EURO_GEOS[euroGeo].label}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                    {[["official","Official basket"],["foodrent","Food & rent heavy"],["car","Car commuter"],["even","Even split"]].map(([k, lab]) => (
                      <button key={k} className="seg" onClick={() => setInflWeights(PI_PRESETS[k])} style={{ fontSize: 11 }}>{lab}</button>
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10,
                    fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: C.inkDim }}>
                    <span>Total: <span style={{ color: Math.abs(piResult.total - 100) < 0.5 ? C.ink : C.orange, fontWeight: 600 }}>{piResult.total.toFixed(1)}%</span></span>
                    <button className="seg" onClick={() => {
                      if (piResult.total > 0) setInflWeights(s => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, +((+v / piResult.total) * 100).toFixed(1)])));
                    }}>Normalise to 100%</button>
                  </div>
                  {PI_CATS.map(c => (
                    <div key={c.code} style={{ padding: "8px 0", borderTop: `1px solid ${C.line}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                        <span style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 12 }}>
                          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: C.inkFaint, marginRight: 6 }}>{c.code}</span>
                          {c.en}
                        </span>
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, whiteSpace: "nowrap", marginLeft: 8,
                          color: (catChg[c.code] || 0) >= 0 ? C.red : C.green }}>
                          {(catChg[c.code] || 0) >= 0 ? "+" : ""}{(catChg[c.code] || 0).toFixed(1)}%
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 56px", gap: 8, alignItems: "center" }}>
                        <input type="range" min="0" max="50" step="0.5" className="btc-range"
                          value={inflWeights[c.code] || 0}
                          onChange={(e) => setInflWeights(s => ({ ...s, [c.code]: Math.max(0, parseFloat(e.target.value)) }))} />
                        <input type="number" min="0" step="0.5" value={inflWeights[c.code] || 0}
                          onChange={(e) => setInflWeights(s => ({ ...s, [c.code]: Math.max(0, parseFloat(e.target.value) || 0) }))}
                          style={{ width: 56, textAlign: "right", background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 6,
                            color: C.ink, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, padding: "4px 6px", outline: "none" }} />
                      </div>
                    </div>
                  ))}
                </section>
              ) : (
                <section className="card" style={{ padding: 22, alignSelf: "start", display: isEuro ? "block" : "none" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, color: C.inkDim, lineHeight: 1.6 }}>
                    {basketLoading ? "Loading the per-category basket…" : "Detailed per-category basket weighting is available for euro-area countries. Other regions use the live headline CPI above."}
                  </div>
                </section>
              )}
            </div>

            {/* CTA — projection inflation now auto-tracks this rate (#5) */}
            <div className="card" style={{ marginTop: 22, padding: "18px 22px", border: `1px solid ${C.orange}`,
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", color: C.orange, marginBottom: 4 }}>Your inflation rate · feeds the projection</div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 26, fontWeight: 600, color: C.ink }}>
                  {piResult.youAnnual.toFixed(1)}% / yr
                  {!inflOverride && <span style={{ fontSize: 12, color: C.green, marginLeft: 14 }}>✓ auto-applied</span>}
                  {inflOverride && <span style={{ fontSize: 12, color: C.inkFaint, marginLeft: 14 }}>projection overridden</span>}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.inkFaint, marginTop: 4 }}>
                  <SourceCite label={sourceLabel} /> · {piResult.start}–{piResult.end}{haveBasket ? ` · ${piResult.total.toFixed(0)}% weight allocated` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {inflOverride && (
                  <button onClick={resetInflAuto} className="seg" style={{ border: `1px solid ${C.line}` }}>↺ Re-link projection</button>
                )}
                <button onClick={() => setTab("retirement")}
                  style={{ background: C.orange, color: C.bg, border: "none", borderRadius: 8, padding: "11px 20px",
                    fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  See projection ↓
                </button>
              </div>
            </div>
          </div>
          );
        })()}

        {/* ══════════════════════════════════════════
            TAB: SAVINGS GOAL
        ══════════════════════════════════════════ */}
        {tab === "savings" && (
          <div className="grid-wrap fade" style={{ display: "grid", gap: 22, gridTemplateColumns: "minmax(0,340px) minmax(0,1fr)" }}>
            <section className="card" style={{ padding: 22, alignSelf: "start" }}>
              <Field label="Goal name">
                <div style={{ display: "flex", alignItems: "center", background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
                  <input type="text" value={goal.name} onChange={e => upGoal("name", e.target.value)}
                    style={{ flex: 1, background: "transparent", border: "none", outline: "none",
                      color: C.ink, fontFamily: "'IBM Plex Mono',monospace", fontSize: 15, padding: "11px 12px" }} />
                </div>
              </Field>
              <Field label="Category">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {Object.entries(GOAL_PRESETS).map(([k, v]) => (
                    <button key={k} className={`seg ${goal.category === k ? "on" : ""}`}
                      onClick={() => {
                        const coicop = v.coicop;
                        const newInfl = (country === "EU" && coicop && piResult.categoryRates[coicop] != null)
                          ? piResult.categoryRates[coicop] / 100
                          : (COUNTRIES[country].assetInfl[k] ?? COUNTRIES[country].assetInfl.general);
                        upGoal("category", k);
                        if (k !== "custom") upGoal("goalInfl", newInfl);
                      }}
                      style={{ fontSize: 11, padding: "7px 6px" }}>
                      {v.emoji} {v.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Goal value today"><NumIn value={goal.valueToday} onChange={v => upGoal("valueToday", v)} prefix={cur} step={1000} /></Field>
              <Field label="Asset inflation rate"
                suffix={goal.category !== "custom" && country === "EU" && GOAL_PRESETS[goal.category]?.coicop
                  ? `Basket: ${PI_CATS.find(c => c.code === GOAL_PRESETS[goal.category]?.coicop)?.en || "overall"}`
                  : `Preset · ${COUNTRIES[country].label}`}>
                <Slider value={goal.goalInfl} onChange={v => upGoal("goalInfl", v)} min={0} max={0.12} step={0.005} fmt={v => `${(v*100).toFixed(1)}% / yr`} />
              </Field>
              <div style={{ height: 1, background: C.line, margin: "6px 0 18px" }} />
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}><Field label="Age now"><NumIn value={goal.age} onChange={v => upGoal("age", v)} /></Field></div>
                <div style={{ flex: 1 }}><Field label="Current BTC"><NumIn value={goal.currentBtc} onChange={v => upGoal("currentBtc", v)} prefix="₿" step={0.01} /></Field></div>
              </div>
              <Field label="Monthly DCA" suffix="per month"><NumIn value={goal.monthly} onChange={v => upGoal("monthly", v)} prefix={cur} step={50} /></Field>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.inkFaint, lineHeight: 1.5, marginTop: 8 }}>
                BTC model: {scen.A.modelType === "cagr" ? `CAGR ${(scen.A.cagr*100).toFixed(0)}%` : `Power law n=${scen.A.exp.toFixed(1)}`} — edit in Retirement tab
              </div>
            </section>

            <section style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {goalResult && (
                <>
                  <div className="card fade" style={{ padding: 22,
                    border: `1px solid ${goalResult.canAffordNow ? C.green : goalResult.crossover ? C.orange : C.red}`,
                    background: goalResult.canAffordNow ? "rgba(127,176,105,.06)" : goalResult.crossover ? "rgba(247,147,26,.06)" : "rgba(217,104,91,.06)" }}>
                    {goalResult.canAffordNow ? (
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 15, color: C.green }}>
                        ✓ You can afford <strong>{goal.name}</strong> today.
                      </div>
                    ) : goalResult.crossover ? (
                      <>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: C.orange, marginBottom: 10 }}>
                          You can afford {goal.name}
                        </div>
                        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                          <Stat label="In" big={`${goalResult.crossover.y} yrs`} color={C.orange} />
                          <Stat label="At age" big={`${goalResult.crossover.age}`} color={C.orange} />
                          <Stat label="Goal cost then" big={fmtMoney(goalResult.crossover.goalCost, cur)} sub="inflation-adjusted" color={C.gold} />
                          <Stat label="Stack value then" big={fmtMoney(goalResult.crossover.stackValue, cur)} color={C.ink} />
                        </div>
                      </>
                    ) : (
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, color: C.red, lineHeight: 1.5 }}>
                        At current DCA, your stack doesn't reach <strong>{goal.name}</strong> within 50 years. Try increasing your monthly DCA.
                      </div>
                    )}
                  </div>
                  {!goalResult.canAffordNow && (() => {
                    const horizon = goalResult.crossover
                      ? Math.min(goalResult.crossover.y + 8, 50)
                      : Math.min(25, 50);
                    const chartRows = goalResult.rows.filter(r => r.y <= horizon);
                    const vk = real ? "Real" : "";
                    const stackKey = "stackValue" + vk;
                    const goalKey = "goalCost" + vk;
                    const crossoverAge = goalResult.crossover?.age;
                    return (
                      <div className="card fade" style={{ padding: "20px 18px 16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                          <div style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: C.inkDim }}>
                            Stack vs goal cost
                          </div>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className={`seg ${!real ? "on" : ""}`} onClick={() => setReal(false)}>Nominal</button>
                            <button className={`seg ${real ? "on" : ""}`} onClick={() => setReal(true)}>{`Today's ${cur}`}</button>
                          </div>
                        </div>
                        <ResponsiveContainer width="100%" height={280}>
                          <ComposedChart data={chartRows} margin={{ top: 14, right: 20, left: 4, bottom: 0 }}>
                            <defs>
                              <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={C.orange} stopOpacity={0.45} /><stop offset="100%" stopColor={C.orange} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid stroke={C.line} strokeDasharray="2 4" vertical={false} />
                            <XAxis dataKey="age" stroke={C.inkFaint} tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} tickLine={false} />
                            <YAxis stroke={C.inkFaint} tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} tickLine={false} width={52} tickFormatter={v => fmtMoney(v, cur)} />
                            <Tooltip content={<TTg fmt={v => fmtMoney(v, cur)} />} />
                            {crossoverAge && (
                              <ReferenceArea x1={crossoverAge} x2={chartRows[chartRows.length - 1].age}
                                fill={C.green} fillOpacity={0.05} />
                            )}
                            {crossoverAge && (
                              <ReferenceLine x={crossoverAge} stroke={C.green} strokeDasharray="3 3"
                                label={{ value: `${goal.name} affordable`, fill: C.green, fontSize: 10, position: "insideTopRight" }} />
                            )}
                            <Area type="monotone" dataKey={stackKey} name="BTC stack" stroke={C.orange} strokeWidth={2} fill="url(#sg)" />
                            <Line type="monotone" dataKey={goalKey} name="Goal cost" stroke={C.gold} strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
                          </ComposedChart>
                        </ResponsiveContainer>
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "8px 4px 0",
                          fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.inkDim }}>
                          <span style={{ display: "flex", gap: 6, alignItems: "center" }}><span style={{ width: 14, height: 0, borderTop: `2px solid ${C.orange}` }} />BTC stack value</span>
                          <span style={{ display: "flex", gap: 6, alignItems: "center" }}><span style={{ width: 14, height: 0, borderTop: `2px dashed ${C.gold}` }} />Goal cost{real ? " · today's money" : ""}</span>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </section>
          </div>
        )}

        {tab === "mining" && (
          <div className="grid-wrap fade" style={{ display: "grid", gap: 22, gridTemplateColumns: "minmax(0,340px) minmax(0,1fr)" }}>
            {/* ── INPUTS ── */}
            <section className="card" style={{ padding: 22, alignSelf: "start" }}>
              <Field label="Mining setup">
                <div style={{ display: "flex", gap: 6 }}>
                  <button className={`seg ${mine.mode === "hosted" ? "on" : ""}`} style={{ flex: 1 }} onClick={() => upMine("mode", "hosted")}>Hosted rig</button>
                  <button className={`seg ${mine.mode === "rented" ? "on" : ""}`} style={{ flex: 1 }} onClick={() => upMine("mode", "rented")}>Rented hashrate</button>
                </div>
              </Field>
              <Field label="Your hashrate" suffix="TH/s"><NumIn value={mine.ths} onChange={v => upMine("ths", v)} step={10} /></Field>

              {mine.mode === "hosted" ? (
                <>
                  <Field label="Hardware cost" suffix="per TH/s"><NumIn value={mine.capexPerTh} onChange={v => upMine("capexPerTh", v)} prefix={cur} step={1} /></Field>
                  <Field label="Efficiency" suffix="watts per TH/s"><NumIn value={mine.wPerTh} onChange={v => upMine("wPerTh", v)} step={1} /></Field>
                  <Field label="Electricity price" suffix="per kWh"><NumIn value={mine.elecPrice} onChange={v => upMine("elecPrice", v)} prefix={cur} step={0.01} /></Field>
                  <Field label="Hosting fee" suffix="per TH/s / day (extra)"><NumIn value={mine.hostFeePerThDay} onChange={v => upMine("hostFeePerThDay", v)} prefix={cur} step={0.005} /></Field>
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: 1 }}><Field label="Rig lifetime" suffix="yrs"><NumIn value={mine.rigLifeYears} onChange={v => upMine("rigLifeYears", v)} step={1} /></Field></div>
                    <div style={{ flex: 1.3 }}><Field label="At end of life">
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className={`seg ${mine.refresh ? "on" : ""}`} style={{ flex: 1 }} onClick={() => upMine("refresh", true)}>Replace</button>
                        <button className={`seg ${!mine.refresh ? "on" : ""}`} style={{ flex: 1 }} onClick={() => upMine("refresh", false)}>Retire</button>
                      </div>
                    </Field></div>
                  </div>
                </>
              ) : (
                <>
                  <Field label="Rental rate" suffix="per TH/s / day"><NumIn value={mine.rentPerThDay} onChange={v => upMine("rentPerThDay", v)} prefix={cur} step={0.005} /></Field>
                  <Field label="Contract length" suffix="yrs"><NumIn value={mine.termYears} onChange={v => upMine("termYears", v)} step={1} /></Field>
                </>
              )}

              <Field label="Pool fee"><Slider value={mine.poolFeePct} onChange={v => upMine("poolFeePct", v)} min={0} max={5} step={0.1} fmt={v => `${v.toFixed(1)}%`} /></Field>
              <div style={{ height: 1, background: C.line, margin: "6px 0 18px" }} />

              <Field label="Running costs" suffix={mine.opexFunding === "fiat" ? "keep all mined BTC" : "self-funding"}>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className={`seg ${mine.opexFunding === "fiat" ? "on" : ""}`} style={{ flex: 1 }} onClick={() => upMine("opexFunding", "fiat")}>Pay from pocket</button>
                  <button className={`seg ${mine.opexFunding === "sell" ? "on" : ""}`} style={{ flex: 1 }} onClick={() => upMine("opexFunding", "sell")}>Sell mined BTC</button>
                </div>
              </Field>
              <Field label="Tx-fee boost" suffix="% on top of subsidy"><Slider value={mine.feeBoost} onChange={v => upMine("feeBoost", v)} min={0} max={20} step={0.5} fmt={v => `${v.toFixed(1)}%`} /></Field>
              <Field label="Hashrate ↔ price coupling" suffix="α  ·  hashrate ∝ priceᵃ"><Slider value={mine.alpha} onChange={v => upMine("alpha", v)} min={0.5} max={3} step={0.1} fmt={v => `α = ${v.toFixed(1)}`} /></Field>
              <Field label="Projection horizon"><Slider value={mine.horizon} onChange={v => upMine("horizon", v)} min={1} max={20} step={1} fmt={v => `${v} yrs`} /></Field>

              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.inkFaint, lineHeight: 1.5, marginTop: 8 }}>
                BTC price model: {scen.A.modelType === "cagr" ? `CAGR ${(scen.A.cagr*100).toFixed(0)}%` : `Power law n=${scen.A.exp.toFixed(1)}`} — edit in Retirement tab. Network hashrate is projected from it (≈{Math.round(NET_HASH_NOW/1e18)} EH/s today).
              </div>
            </section>

            {/* ── RESULTS ── */}
            <section style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {mineResult && (
                <>
                  <div className="card fade" style={{ padding: 22 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                      <div style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: C.inkDim }}>
                        {mine.horizon}-year mining outlook
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className={`seg ${!real ? "on" : ""}`} onClick={() => setReal(false)}>Nominal</button>
                        <button className={`seg ${real ? "on" : ""}`} onClick={() => setReal(true)}>{`Today's ${cur}`}</button>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                      <Stat label="BTC mined (net)" big={fmtBtc(mineResult.totalBtcNet)} sub={`${fmtBtc(mineResult.totalBtcGross)} before costs`} color={C.orange} />
                      <Stat label={`Value at year ${mine.horizon}`} big={fmtMoney(real ? mineResult.valueEndReal : mineResult.valueEnd, cur)} sub={real ? "today's money" : "nominal"} color={C.gold} />
                      <Stat label="Total invested" big={fmtMoney(mineResult.totalOutlay, cur)} sub={mine.opexFunding === "sell" ? "capex (costs paid from output)" : "capex + running costs"} color={C.ink} />
                      <Stat label="Fiat breakeven"
                        big={mineResult.breakevenY != null ? `${mineResult.breakevenY.toFixed(1)} yrs` : "—"}
                        sub={mineResult.breakevenY != null ? "net BTC value ≥ invested" : "not within horizon"}
                        color={mineResult.breakevenY != null ? C.green : C.red} />
                      <Stat label="Total ROI"
                        big={mineResult.roi != null ? `${(mineResult.roi*100).toFixed(0)}%` : "—"}
                        color={mineResult.roi != null && mineResult.roi >= 0 ? C.green : C.red} />
                    </div>
                  </div>

                  <div className="card fade" style={{ padding: "20px 18px 16px" }}>
                    <div style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: C.inkDim, marginBottom: 14 }}>
                      BTC accumulated &amp; value
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart data={mineResult.rows} margin={{ top: 14, right: 8, left: 4, bottom: 0 }}>
                        <defs>
                          <linearGradient id="mineVal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={C.gold} stopOpacity={0.35} /><stop offset="100%" stopColor={C.gold} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke={C.line} strokeDasharray="2 4" vertical={false} />
                        <XAxis dataKey="year" stroke={C.inkFaint} tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} tickLine={false}
                          tickFormatter={v => `Y${v}`} />
                        <YAxis yAxisId="fiat" stroke={C.inkFaint} tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} tickLine={false} width={52} tickFormatter={v => fmtMoney(v, cur)} />
                        <YAxis yAxisId="btc" orientation="right" stroke={C.inkFaint} tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} tickLine={false} width={48} tickFormatter={v => `₿${v.toFixed(2)}`} />
                        <Tooltip content={<MineTT real={real} cur={cur} />} />
                        <Area yAxisId="fiat" type="monotone" dataKey={real ? "valueReal" : "value"} name="Value" stroke={C.gold} strokeWidth={2} fill="url(#mineVal)" />
                        <Line yAxisId="fiat" type="monotone" dataKey="cost" name="Invested" stroke={C.inkDim} strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
                        <Line yAxisId="btc" type="monotone" dataKey="btcNet" name="Net BTC" stroke={C.orange} strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "8px 4px 0",
                      fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.inkDim }}>
                      <span style={{ display: "flex", gap: 6, alignItems: "center" }}><span style={{ width: 14, height: 0, borderTop: `2px solid ${C.orange}` }} />Net BTC (right)</span>
                      <span style={{ display: "flex", gap: 6, alignItems: "center" }}><span style={{ width: 14, height: 0, borderTop: `2px solid ${C.gold}` }} />Stack value</span>
                      <span style={{ display: "flex", gap: 6, alignItems: "center" }}><span style={{ width: 14, height: 0, borderTop: `2px dashed ${C.inkDim}` }} />Fiat invested</span>
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.inkFaint, lineHeight: 1.5, marginTop: 12 }}>
                      Difficulty is projected by coupling network hashrate to the price power law (hashrate ∝ priceᵃ, α≈2), with the halving schedule (3.125 → 1.5625 BTC in 2028, …) applied to block rewards. As the network grows, your share — and BTC mined per day — shrinks. Sources:{" "}
                      <a href="https://hashrateindex.com/blog/difficulty-forecasting-101-for-bitcoin-miners-hosters-lenders-and-hashrate-traders/" target="_blank" rel="noopener noreferrer" style={{ color: C.blue }}>Hashrate Index ↗</a>,{" "}
                      <a href="https://medium.com/@fulgur.ventures/bitcoin-power-law-theory-executive-summary-report-837e6f00347e" target="_blank" rel="noopener noreferrer" style={{ color: C.blue }}>Power Law theory ↗</a>.
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        <footer style={{ marginTop: 30, paddingTop: 18, borderTop: `1px solid ${C.line}`,
          color: C.inkFaint, fontSize: 12, lineHeight: 1.6, maxWidth: 760 }}>
          {/* #10: support / source badges */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
            <a href="https://github.com/robinbenito/btc-retirement-calculator" target="_blank" rel="noopener noreferrer">
              <img alt="GitHub repository"
                src="https://img.shields.io/badge/GitHub-Source-181717?logo=github&logoColor=white&style=social" />
            </a>
            <a href="https://www.buymeacoffee.com/rgaston" target="_blank" rel="noopener noreferrer">
              <img alt="Buy Me a Coffee"
                src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?logo=buy-me-a-coffee&logoColor=black&style=social" />
            </a>
            <a href="https://buymeabitcoffee.vercel.app/btc/bc1p6nrgd38nmx09lm2j8ql8wg58nlfsmsh2zxyapss7ljxxvj636c0swhuqdm?identifier=Buy+Me+a+BitCoffee&lightning=civicdrone297%40walletofsatoshi.com"
              target="_blank" rel="noopener noreferrer">
              <img alt="Buy Me a BitCoffee"
                src="https://img.shields.io/badge/Buy%20Me%20a%20BitCoffee-f7931a?logo=bitcoin&logoColor=black&color=f7931a&style=social&label=Useful%3F" />
            </a>
          </div>
          <strong style={{ color: C.inkDim }}>Not financial advice.</strong> The power-law option extrapolates
          BTC's historical price-vs-time trend (price ∝ daysⁿ) forward from today's spot — a thesis, not a fact.
          The Monte Carlo wraps that trend in random, mean-reverting volatility that decays as you set it; it's a
          model of one possible volatility future, not a prediction, and real bear markets can stay down far longer
          than the mean reversion assumes. Nothing here accounts for taxes, fees, or your actual risk tolerance.
          Treat every number as a sketch of one assumption.
        </footer>
      </div>
    </div>
  );
}
