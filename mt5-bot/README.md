# GoldSilverBot — MT5 Trading Bot (Gold & Silver)

MetaTrader 5 ke liye ek Expert Advisor (EA) jo **Gold (XAUUSD)** aur **Silver (XAGUSD)**
par automatic trades karta hai. Strategy: **EMA crossover + RSI filter**, saath me
proper **risk management** (ATR-based Stop Loss/Take Profit, risk-based lot sizing,
trailing stop, spread filter).

> ⚠️ **Zaroori Warning:** Trading me paisa doob sakta hai. Ye bot educational purpose
> ke liye hai aur profit ki koi guarantee nahi. **Pehle hamesha DEMO account par
> test karein.** Real account par tabhi lagayein jab aap results se satisfied hon
> aur risk samajhte hon.

---

## Strategy kaise kaam karti hai

- **Fast EMA (20)** jab **Slow EMA (50)** ko **upar** cross kare → **BUY** signal
  (agar RSI overbought na ho).
- **Fast EMA** jab **Slow EMA** ko **neeche** cross kare → **SELL** signal
  (agar RSI oversold na ho).
- Har trade ka **Stop Loss** aur **Take Profit** market ki volatility (ATR) ke
  hisab se set hota hai.
- **Trailing stop** profit ko lock karta hai jab trade favor me jaye.
- Sirf **naye candle** par decision hota hai (over-trading se bachne ke liye).

---

## Install karne ka tarika (Step by Step)

1. **MetaTrader 5** open karein.
2. Menu se **Tools → MetaQuotes Language Editor** kholein (ya `F4` dabayein).
3. MetaEditor me left panel me **Experts** folder par right-click → **New File**
   ... ya seedha `GoldSilverBot.mq5` file ko is folder me copy karein:
   ```
   <MT5 Data Folder>/MQL5/Experts/GoldSilverBot.mq5
   ```
   > Data folder khone ke liye MT5 me: **File → Open Data Folder**.
4. MetaEditor me file kholein aur **Compile** button dabayein (ya `F7`).
   "0 errors, 0 warnings" aana chahiye.
5. MT5 par wapas jayein. **Navigator** panel (Ctrl+N) → **Expert Advisors** me
   `GoldSilverBot` dikhega.
6. Gold ya Silver ka chart kholein (jaise **XAUUSD**, timeframe **M15**).
7. `GoldSilverBot` ko chart par **drag & drop** karein.
8. Settings window me:
   - **Common tab** → "Allow Algo Trading" tick karein.
   - **Inputs tab** → apni marzi ke parameters set karein (neeche dekhein).
9. Toolbar me **Algo Trading** button green hona chahiye (on).

Bot ab automatically trade karega. 🎯

---

## Settings (Inputs) samjhein

| Setting | Default | Matlab |
|---|---|---|
| `InpRiskPercent` | 1.0 | Har trade par balance ka kitna % risk (1% recommended) |
| `InpFixedLot` | 0.0 | Fixed lot chahiye to yahan set karein (0 = auto risk-based) |
| `InpMaxLot` | 5.0 | Maximum lot size (safety cap) |
| `InpMaxSpreadPts` | 50 | Is se zyada spread ho to trade nahi (Gold ke liye important) |
| `InpMaxPositions` | 1 | Ek waqt me kitni positions |
| `InpATRPeriod` | 14 | ATR (volatility) period |
| `InpSL_ATR` | 2.0 | Stop Loss = 2 x ATR |
| `InpTP_ATR` | 3.0 | Take Profit = 3 x ATR |
| `InpUseTrailing` | true | Trailing stop on/off |
| `InpFastEMA` | 20 | Fast EMA period |
| `InpSlowEMA` | 50 | Slow EMA period |
| `InpRSIPeriod` | 14 | RSI period |
| `InpTimeframe` | M15 | Kis timeframe par trade kare |
| `InpUseTimeFilter` | false | Sirf specific hours me trade karna ho to on karein |

> **Note:** Gold/Silver ke symbols har broker par thoda alag ho sakte hain
> (`XAUUSD`, `GOLD`, `XAUUSD.m` waghera). Bot us chart ke symbol par kaam karta
> hai jis par aap use lagate hain — bas sahi chart kholein.

---

## Pehle Backtest zaroor karein (Strategy Tester)

1. MT5 me **View → Strategy Tester** kholein (`Ctrl+R`).
2. Expert: `GoldSilverBot` select karein.
3. Symbol: `XAUUSD` (ya aapka gold symbol), Timeframe: `M15`.
4. Date range aur "Every tick based on real ticks" model choose karein.
5. **Start** dabayein aur results (profit, drawdown, win rate) dekhein.
6. Parameters ko optimize karein, phir DEMO par live test karein.

---

## Risk Management Tips

- Shuru me **RiskPercent 0.5–1%** rakhein.
- Ek hi waqt me bahut zyada positions na khulne dein (`InpMaxPositions`).
- Gold bohot volatile hai — spread filter (`InpMaxSpreadPts`) zaroori hai.
- Kabhi bhi utna paisa na lagayein jitna aap kho nahi sakte.

---

## Disclaimer

Ye software "as-is" diya gaya hai bina kisi guarantee ke. Trading decisions aur
un ke natije aap ki apni zimmedari hain. Author kisi bhi financial nuksan ka
zimmedar nahi hai.
