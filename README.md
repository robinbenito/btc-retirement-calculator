# Bitcoin Retirement Calculator

A personal finance tool for planning retirement around a Bitcoin stack. Models accumulation via monthly DCA, drawdown spending, and long-run BTC price using a power-law curve anchored to today's spot price.

**Live:** https://btc-retirement-calculator.vercel.app

[![Buy Me a BitCoffee](https://img.shields.io/badge/Buy%20Me%20a%20BitCoffee-f7931a?logo=bitcoin&logoColor=black&color=f7931a&style=social&label=Useful%3F)](https://buymeabitcoffee.vercel.app/btc/bc1p6nrgd38nmx09lm2j8ql8wg58nlfsmsh2zxyapss7ljxxvj636c0swhuqdm?identifier=Buy+Me+a+BitCoffee&lightning=civicdrone297%40walletofsatoshi.com)  [![Regular Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?logo=buy-me-a-coffee&logoColor=black&style=social)](https://www.buymeacoffee.com/rgaston)

---

## Features

### Retirement tab
- **Portfolio chart** — year-by-year BTC balance and fiat value from now to plan-until age, with BTC price curve overlay and stress-test mode (simulated crash + recovery)
- **Forever Stack** — minimum BTC needed at retirement to sustain your spending until plan-until age, solved via the same depletion model as the portfolio chart; chart shows required vs. accumulated BTC across all possible retirement ages
- **Auto income mode** — the inverse of the Forever Stack: fix a retire age, BTC, and DCA, and the tool solves the largest inflation-adjusted income the stack sustains to your plan-until age
- **Bridge Stack** — two-phase retirement: DCA fills the "forever" bucket first; surplus sats shift your retirement age earlier
- **Monte Carlo** — volatility bands around the power-law trend (mean-reverting log-normal paths, configurable vol decay)
- **Compare mode** — run two scenarios side by side
- **Inflation auto-link** — the projection's inflation rate tracks the *My Inflation* rate automatically; drag the slider to override, one click to re-link

### Price models
| Model | Description |
|---|---|
| Power law | BTC price follows `fairValue × (days/genesisDay)^exp`; today's spot closes the gap to fair value over a configurable half-life |
| PL · conservative | Same shape, lower exponent |
| Flat CAGR | Simple compound annual growth rate |

### Other tabs
- **My Inflation** — live CPI for every supported country (World Bank, back to 2010) with a movable averaging window (default 5-year); euro-area users pick their exact country (Eurostat per-COICOP basket) and weight their own spending mix. Falls back to embedded Destatis data when offline.
- **Savings Goal** — reach a target fiat value (e.g. a house) via BTC appreciation + DCA, with real/nominal toggle and clipped chart window

### Localization
- Country/currency auto-detected by IP on first load (manual picks always win); the detected region is flagged in the picker.

### Live data sources
- **BTC spot** — CoinGecko (multi-currency), with USD exchange fallbacks
- **Headline CPI** — World Bank `FP.CPI.TOTL` (annual, 2010→present)
- **Euro-area COICOP basket** — Eurostat `prc_hicp_aind`
- **IP geolocation** — ipwho.is → ipapi.co → geojs.io

All external feeds are best-effort and degrade gracefully to embedded data.

---

## Stack

- React 18 + Vite
- Recharts for all charts
- No backend — all calculations run in the browser
- Single-file component: `bitcoin-retirement-calculator.jsx`

---

## Local development

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build → dist/
```

---

## Calculation model

**Accumulation** (`accumulateBtc`): monthly DCA purchases at mid-month price for each year up to retirement.

**Depletion** (`simulate`): annual inflation-adjusted spending converted to BTC at the model price for each year post-retirement. Stack hits zero → depleted age.

**Forever Stack** (`solveForeverBtc`): bisection solver — finds the minimum BTC at retirement where the depletion simulation survives to plan-until age. Identical model to `simulate`.

**Bridge Stack** (`calcBridge`): fixes a target retirement age, solves for the forever BTC target, then finds the earliest age where DCA accumulation covers forever BTC + bridge spending (income between early retire and target retire age).

**Power-law price** (`priceAt`): starts at today's spot position on the curve and closes the gap to fair value exponentially over a configurable half-life (`tau`).
