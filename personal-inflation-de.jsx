import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot,
} from "recharts";

/* ----------------------------------------------------------------------------
   DATA — German CPI (Verbraucherpreisindex), Destatis, base 2020 = 100.
   Annual averages by COICOP division, 2020–2025 (table "Gesamtindex und 12
   Abteilungen", Stand 12 May 2026). Official weights = Wägungsschema 2020.
   Headline reconstructed from weights x indices = 121.91 vs actual 121.9.
---------------------------------------------------------------------------- */
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];

const CATS = [
  { code: "01", en: "Food & non-alcoholic drinks", de: "Nahrungsmittel & alkoholfreie Getränke", w: 11.9, s: [100, 103.1, 116.0, 130.3, 132.8, 136.2] },
  { code: "02", en: "Alcohol & tobacco",            de: "Alkohol & Tabakwaren",                  w: 3.7,  s: [100, 103.5, 107.9, 117.1, 122.3, 126.3] },
  { code: "03", en: "Clothing & footwear",          de: "Bekleidung & Schuhe",                   w: 4.0,  s: [100, 101.5, 102.3, 106.1, 109.3, 110.2] },
  { code: "04", en: "Housing, water & energy",      de: "Wohnung, Wasser, Strom, Gas",           w: 25.9, s: [100, 101.7, 109.1, 114.5, 115.9, 117.5] },
  { code: "05", en: "Furnishings & household",      de: "Möbel & Haushaltszubehör",              w: 6.8,  s: [100, 102.7, 110.5, 117.6, 118.0, 118.0] },
  { code: "06", en: "Health",                       de: "Gesundheit",                            w: 5.5,  s: [100, 100.5, 101.8, 104.9, 107.8, 110.8] },
  { code: "07", en: "Transport",                    de: "Verkehr",                               w: 13.8, s: [100, 107.7, 120.0, 123.6, 124.8, 127.1] },
  { code: "08", en: "Post & telecom",               de: "Post & Telekommunikation",              w: 2.3,  s: [100, 99.4,  99.4,  99.8,  99.1,  98.4]  },
  { code: "09", en: "Recreation & culture",         de: "Freizeit, Unterhaltung & Kultur",       w: 10.8, s: [100, 102.9, 107.9, 114.0, 116.1, 117.6] },
  { code: "10", en: "Education",                    de: "Bildungswesen",                         w: 0.9,  s: [100, 102.5, 104.9, 108.9, 114.3, 119.8] },
  { code: "11", en: "Restaurants & hotels",         de: "Gaststätten & Beherbergung",            w: 4.5,  s: [100, 102.7, 110.5, 119.5, 126.9, 131.7] },
  { code: "12", en: "Other goods & services",       de: "Andere Waren & Dienstleistungen",       w: 9.9,  s: [100, 103.8, 106.1, 113.0, 120.2, 127.0] },
];
const HEADLINE = [100, 103.1, 110.2, 116.7, 119.3, 121.9];

const PRESETS = {
  official: Object.fromEntries(CATS.map((c) => [c.code, c.w])),
  foodrent: { "01": 22, "02": 3, "03": 3, "04": 34, "05": 5, "06": 5, "07": 6, "08": 3, "09": 7, "10": 1, "11": 2, "12": 9 },
  car:      { "01": 12, "02": 3, "03": 4, "04": 24, "05": 6, "06": 5, "07": 22, "08": 2, "09": 9, "10": 1, "11": 4, "12": 8 },
  even:     Object.fromEntries(CATS.map((c) => [c.code, +(100 / 12).toFixed(2)])),
};

/* ---- palette: pale sage paper, near-black ink, oxblood "you" vs slate "official" */
const C = {
  bg: "#E7E8E2", card: "#F7F7F3", ink: "#1F2421", muted: "#73766C",
  hair: "#CFD0C8", you: "#9E2A3B", off: "#3B4A52", up: "#9E2A3B", down: "#3F6B4F",
};
const fmtPct = (n) => (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(1) + "%";
const fmtEur = (n) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

function useAnimatedNumber(target, ms = 600) {
  const [val, setVal] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setVal(target); from.current = target; return; }
    let raf, t0; const start = from.current;
    const tick = (t) => {
      if (!t0) t0 = t;
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setVal(start + (target - start) * e);
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return val;
}

export default function PersonalInflation() {
  const [weights, setWeights] = useState(PRESETS.official);
  const [endYear, setEndYear] = useState(2025);

  const total = useMemo(() => Object.values(weights).reduce((a, b) => a + (+b || 0), 0), [weights]);
  const yi = YEARS.indexOf(endYear);

  // normalized personal index per year
  const series = useMemo(() => {
    return YEARS.map((yr, i) => {
      let acc = 0;
      CATS.forEach((c) => { acc += (weights[c.code] || 0) * c.s[i]; });
      return { year: yr, you: total > 0 ? acc / total : 100, official: HEADLINE[i] };
    });
  }, [weights, total]);

  const youIdx = series[yi].you;
  const offIdx = HEADLINE[yi];
  const youCum = youIdx - 100;
  const offCum = offIdx - 100;
  const span = endYear - 2020;
  const youAnnual = span > 0 ? (Math.pow(youIdx / 100, 1 / span) - 1) * 100 : 0;
  const offAnnual = span > 0 ? (Math.pow(offIdx / 100, 1 / span) - 1) * 100 : 0;

  const contrib = useMemo(() => {
    return CATS.map((c) => {
      const w = total > 0 ? (weights[c.code] || 0) / total : 0;
      const chg = c.s[yi] - 100;
      return { ...c, share: w, weight: weights[c.code] || 0, chg, contribution: w * chg };
    }).sort((a, b) => b.contribution - a.contribution);
  }, [weights, total, yi]);
  const maxAbs = Math.max(0.01, ...contrib.map((c) => Math.abs(c.contribution)));

  const aYou = useAnimatedNumber(youCum);
  const aGap = useAnimatedNumber(youCum - offCum);
  const aEur = useAnimatedNumber(youIdx);

  const setW = (code, v) => setWeights((p) => ({ ...p, [code]: Math.max(0, +v) }));
  const normalize = () => { if (total > 0) setWeights((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, +((v / total) * 100).toFixed(1)]))); };

  return (
    <div className="pi-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        .pi-root{background:${C.bg};color:${C.ink};font-family:'IBM Plex Sans',system-ui,sans-serif;
          min-height:100vh;padding:clamp(16px,4vw,44px);box-sizing:border-box;-webkit-font-smoothing:antialiased;}
        .pi-root *{box-sizing:border-box;}
        .pi-wrap{max-width:1080px;margin:0 auto;}
        .pi-mono{font-family:'IBM Plex Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;}
        .pi-eyebrow{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:${C.muted};}
        .pi-h1{font-size:clamp(28px,5vw,46px);font-weight:600;line-height:1.02;margin:.32em 0 .15em;letter-spacing:-.01em;}
        .pi-sub{color:${C.muted};font-size:14px;max-width:60ch;line-height:1.5;}
        .pi-grid{display:grid;grid-template-columns:1.05fr 1fr;gap:18px;margin-top:26px;}
        @media(max-width:860px){.pi-grid{grid-template-columns:1fr;}}
        .pi-card{background:${C.card};border:1px solid ${C.hair};border-radius:4px;padding:clamp(16px,2.4vw,26px);}
        .pi-readout{display:flex;align-items:flex-end;gap:6px;}
        .pi-big{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;font-weight:500;
          font-size:clamp(54px,11vw,92px);line-height:.86;color:${C.you};letter-spacing:-.03em;}
        .pi-cmp{display:flex;gap:26px;margin-top:22px;flex-wrap:wrap;}
        .pi-cmp .lbl{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${C.muted};}
        .pi-cmp .num{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;font-size:23px;font-weight:500;margin-top:3px;}
        .pi-rule{height:1px;background:${C.hair};margin:20px 0;border:0;}
        .pi-eur{font-size:14px;line-height:1.55;color:${C.ink};}
        .pi-eur b{font-family:'IBM Plex Mono',monospace;font-weight:600;font-variant-numeric:tabular-nums;}
        .pi-presets{display:flex;gap:7px;flex-wrap:wrap;margin:2px 0 16px;}
        .pi-btn{font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.02em;padding:7px 11px;border-radius:3px;
          border:1px solid ${C.hair};background:transparent;color:${C.ink};cursor:pointer;transition:.15s;}
        .pi-btn:hover{background:${C.ink};color:${C.card};border-color:${C.ink};}
        .pi-btn:focus-visible{outline:2px solid ${C.you};outline-offset:2px;}
        .pi-total{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;}
        .pi-total .v{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;font-weight:600;}
        .pi-row{display:grid;grid-template-columns:22px 1fr auto;gap:10px;align-items:center;padding:7px 0;border-top:1px solid ${C.hair};}
        .pi-code{font-family:'IBM Plex Mono',monospace;font-size:12px;color:${C.muted};}
        .pi-name{font-size:13px;line-height:1.15;}
        .pi-name small{display:block;color:${C.muted};font-size:10.5px;}
        .pi-chg{font-family:'IBM Plex Mono',monospace;font-size:11px;}
        .pi-srow{display:grid;grid-template-columns:1fr 56px;gap:10px;align-items:center;}
        .pi-num-in{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;width:56px;text-align:right;
          border:1px solid ${C.hair};background:${C.bg};color:${C.ink};border-radius:3px;padding:4px 6px;font-size:13px;}
        input[type=range].pi-rg{-webkit-appearance:none;appearance:none;width:100%;height:3px;border-radius:2px;background:${C.hair};outline:none;}
        input[type=range].pi-rg::-webkit-slider-thumb{-webkit-appearance:none;width:15px;height:15px;border-radius:50%;
          background:${C.you};cursor:pointer;border:2px solid ${C.card};box-shadow:0 0 0 1px ${C.you};}
        input[type=range].pi-rg::-moz-range-thumb{width:13px;height:13px;border-radius:50%;background:${C.you};cursor:pointer;border:2px solid ${C.card};}
        .pi-yr{display:inline-flex;gap:4px;margin-left:8px;}
        .pi-yr button{font-family:'IBM Plex Mono',monospace;font-size:12px;padding:3px 8px;border-radius:3px;border:1px solid ${C.hair};
          background:transparent;color:${C.muted};cursor:pointer;}
        .pi-yr button[data-on=true]{background:${C.ink};color:${C.card};border-color:${C.ink};}
        .pi-bar-track{position:relative;height:18px;background:transparent;}
        .pi-bar{position:absolute;top:2px;height:14px;border-radius:2px;}
        .pi-foot{margin-top:24px;font-size:11.5px;color:${C.muted};line-height:1.55;}
        .pi-foot a{color:${C.muted};}
        .pi-section-h{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:${C.muted};margin:0 0 12px;}
      `}</style>

      <div className="pi-wrap">
        <div className="pi-eyebrow">Destatis · Verbraucherpreisindex · 2020 = 100</div>
        <h1 className="pi-h1">Your personal inflation</h1>
        <p className="pi-sub">
          German consumer prices don't hit everyone equally. Set how your spending splits across the
          twelve categories of the official basket (the Warenkorb) and see what inflation looked like
          for <em>you</em> — measured against the headline rate everyone hears about.
        </p>

        <div className="pi-grid">
          {/* ---------- left: readout ---------- */}
          <div className="pi-card">
            <div className="pi-section-h">
              Your basket, 2020 →
              <span className="pi-yr">
                {[2021, 2022, 2023, 2024, 2025].map((y) => (
                  <button key={y} data-on={endYear === y} onClick={() => setEndYear(y)}>{y}</button>
                ))}
              </span>
            </div>
            <div className="pi-readout">
              <span className="pi-big">{fmtPct(aYou)}</span>
            </div>
            <div className="pi-cmp">
              <div>
                <div className="lbl">Official headline</div>
                <div className="num" style={{ color: C.off }}>{fmtPct(offCum)}</div>
              </div>
              <div>
                <div className="lbl">Gap vs official</div>
                <div className="num" style={{ color: (youCum - offCum) >= 0 ? C.up : C.down }}>
                  {fmtPct(aGap)}
                </div>
              </div>
              <div>
                <div className="lbl">Per year (you)</div>
                <div className="num">{youAnnual.toFixed(1)}%</div>
              </div>
            </div>

            <hr className="pi-rule" />
            <div className="pi-eur">
              What cost <b>100,00 €</b> in 2020 now costs you <b style={{ color: C.you }}>{fmtEur(aEur)}</b>
              {"  "}— the official basket says <b style={{ color: C.off }}>{fmtEur(offIdx)}</b>.
            </div>

            <div style={{ height: 230, marginTop: 18 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke={C.hair} vertical={false} />
                  <XAxis dataKey="year" stroke={C.muted} tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} tickLine={false} />
                  <YAxis domain={["dataMin - 2", "dataMax + 2"]} stroke={C.muted} tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: C.ink, border: "none", borderRadius: 4, fontFamily: "IBM Plex Mono", fontSize: 12 }}
                    labelStyle={{ color: C.card }} itemStyle={{ color: C.card }}
                    formatter={(v, n) => [v.toFixed(1), n === "you" ? "You" : "Official"]}
                  />
                  <Line type="monotone" dataKey="official" stroke={C.off} strokeWidth={1.6} dot={false} strokeDasharray="4 3" />
                  <Line type="monotone" dataKey="you" stroke={C.you} strokeWidth={2.4} dot={false} />
                  <ReferenceDot x={endYear} y={youIdx} r={4} fill={C.you} stroke={C.card} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <hr className="pi-rule" />
            <div className="pi-section-h">Where your inflation came from · {endYear}</div>
            <div>
              {contrib.map((c) => {
                const wpx = (Math.abs(c.contribution) / maxAbs) * 50; // % of half-width
                const pos = c.contribution >= 0;
                return (
                  <div key={c.code} className="pi-row" style={{ gridTemplateColumns: "22px 1fr 96px 58px" }}>
                    <span className="pi-code">{c.code}</span>
                    <span className="pi-name">{c.en}</span>
                    <span className="pi-bar-track">
                      <span className="pi-bar" style={{
                        left: pos ? "50%" : `${50 - wpx}%`, width: `${wpx}%`,
                        background: pos ? C.up : C.down, opacity: c.weight === 0 ? 0.18 : 0.85,
                      }} />
                      <span style={{ position: "absolute", left: "50%", top: -1, bottom: -1, width: 1, background: C.hair }} />
                    </span>
                    <span className="pi-chg pi-mono" style={{ textAlign: "right", color: pos ? C.up : C.down }}>
                      {fmtPct(c.contribution)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }} className="pi-mono">
              Bars show each category's contribution (weight × price change). They sum to {fmtPct(youCum)}.
            </div>
          </div>

          {/* ---------- right: controls ---------- */}
          <div className="pi-card">
            <div className="pi-section-h">Set your spending mix</div>
            <div className="pi-presets">
              <button className="pi-btn" onClick={() => setWeights(PRESETS.official)}>Official basket</button>
              <button className="pi-btn" onClick={() => setWeights(PRESETS.foodrent)}>Food & rent heavy</button>
              <button className="pi-btn" onClick={() => setWeights(PRESETS.car)}>Car commuter</button>
              <button className="pi-btn" onClick={() => setWeights(PRESETS.even)}>Even split</button>
            </div>
            <div className="pi-total">
              <span style={{ fontSize: 12, color: C.muted }} className="pi-mono">
                TOTAL <span className="v" style={{ color: Math.abs(total - 100) < 0.5 ? C.ink : C.you }}>{total.toFixed(1)}%</span>
                {Math.abs(total - 100) >= 0.5 && <span style={{ color: C.muted }}> · auto-normalised</span>}
              </span>
              <button className="pi-btn" onClick={normalize}>Normalise to 100%</button>
            </div>

            {CATS.map((c) => (
              <div key={c.code} style={{ padding: "9px 0", borderTop: `1px solid ${C.hair}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <span className="pi-name">
                    <span className="pi-code" style={{ marginRight: 8 }}>{c.code}</span>{c.en}
                    <small>{c.de}</small>
                  </span>
                  <span className="pi-chg pi-mono" style={{ color: c.s[yi] - 100 >= 0 ? C.up : C.down, whiteSpace: "nowrap", marginLeft: 8 }}>
                    {fmtPct(c.s[yi] - 100)}
                  </span>
                </div>
                <div className="pi-srow">
                  <input className="pi-rg" type="range" min="0" max="50" step="0.5"
                    value={weights[c.code] || 0} onChange={(e) => setW(c.code, e.target.value)}
                    aria-label={`Weight for ${c.en}`} />
                  <input className="pi-num-in pi-mono" type="number" min="0" step="0.5"
                    value={weights[c.code] || 0} onChange={(e) => setW(c.code, e.target.value)} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pi-foot">
          Source: Statistisches Bundesamt (Destatis), Verbraucherpreisindex für Deutschland, Gesamtindex und
          12 Abteilungen, base 2020 = 100, annual averages 2020–2025 (Stand 12 May 2026). Category weights:
          Wägungsschema für das Basisjahr 2020 (housing 25.9%, transport 13.8%, food 11.9% confirmed from
          source; a few smaller divisions are best-available approximations and total exactly 100%). The
          model uses the official COICOP-division indices, so it captures divergence between categories, not
          within them — e.g. it can't tell a long-term tenant from someone who just signed a new market-rate
          lease, since both sit inside division 04. 2015–2020 ran near 0.5%/yr and is excluded by the 2020
          base. General economic information, not financial advice.
        </div>
      </div>
    </div>
  );
}
