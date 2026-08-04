//+------------------------------------------------------------------+
//|                                              GoldSilverBot.mq5    |
//|                    MT5 Expert Advisor for Gold & Silver trading   |
//|                                                                  |
//|  Strategy: EMA crossover + RSI filter with ATR-based risk mgmt.  |
//|  Symbols : XAUUSD (Gold), XAGUSD (Silver) — ya koi bhi symbol.    |
//|                                                                  |
//|  WARNING: Trading me capital loss ka risk hota hai. Pehle DEMO   |
//|  account par test karein. Ye educational purpose ke liye hai.    |
//+------------------------------------------------------------------+
#property copyright "GoldSilverBot"
#property version   "1.00"
#property strict

#include <Trade/Trade.mqh>
#include <Trade/PositionInfo.mqh>

//--- Trade objects
CTrade         trade;
CPositionInfo  position;

//==================================================================
//  INPUT PARAMETERS (MT5 me EA settings se change kar sakte hain)
//==================================================================

//--- General
input long     InpMagicNumber   = 20260804;   // Magic Number (EA identity)
input string   InpComment       = "GoldSilverBot"; // Order comment

//--- Risk Management
input double   InpRiskPercent   = 1.0;    // Har trade par risk (% of balance)
input double   InpFixedLot      = 0.0;    // Fixed lot (>0 ho to RiskPercent ignore)
input double   InpMaxLot        = 5.0;    // Maximum lot size (safety cap)
input int      InpMaxSpreadPts  = 50;     // Max spread (points) — is se zyada ho to trade nahi
input int      InpMaxPositions  = 1;      // Ek waqt me kitni positions allowed

//--- Stop Loss / Take Profit (ATR-based)
input int      InpATRPeriod     = 14;     // ATR period
input double   InpSL_ATR        = 2.0;    // Stop Loss = SL_ATR x ATR
input double   InpTP_ATR        = 3.0;    // Take Profit = TP_ATR x ATR
input bool     InpUseTrailing   = true;   // Trailing stop on/off
input double   InpTrail_ATR     = 1.5;    // Trailing distance = Trail_ATR x ATR

//--- Strategy (EMA crossover + RSI filter)
input int      InpFastEMA       = 20;     // Fast EMA period
input int      InpSlowEMA       = 50;     // Slow EMA period
input int      InpRSIPeriod     = 14;     // RSI period
input int      InpRSIUpper      = 70;     // RSI overbought level
input int      InpRSILower      = 30;     // RSI oversold level
input ENUM_TIMEFRAMES InpTimeframe = PERIOD_M15; // Trading timeframe

//--- Trading hours filter (server time, 24h)
input bool     InpUseTimeFilter = false;  // Time filter on/off
input int      InpStartHour     = 8;      // Start hour (server time)
input int      InpEndHour       = 22;     // End hour (server time)

//==================================================================
//  GLOBALS
//==================================================================
int      hFastEMA = INVALID_HANDLE;
int      hSlowEMA = INVALID_HANDLE;
int      hRSI     = INVALID_HANDLE;
int      hATR     = INVALID_HANDLE;
datetime lastBarTime = 0;

//+------------------------------------------------------------------+
//| Expert initialization                                            |
//+------------------------------------------------------------------+
int OnInit()
{
   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(20);
   trade.SetTypeFillingBySymbol(_Symbol);

   //--- Create indicator handles
   hFastEMA = iMA(_Symbol, InpTimeframe, InpFastEMA, 0, MODE_EMA, PRICE_CLOSE);
   hSlowEMA = iMA(_Symbol, InpTimeframe, InpSlowEMA, 0, MODE_EMA, PRICE_CLOSE);
   hRSI     = iRSI(_Symbol, InpTimeframe, InpRSIPeriod, PRICE_CLOSE);
   hATR     = iATR(_Symbol, InpTimeframe, InpATRPeriod);

   if(hFastEMA == INVALID_HANDLE || hSlowEMA == INVALID_HANDLE ||
      hRSI == INVALID_HANDLE || hATR == INVALID_HANDLE)
   {
      Print("ERROR: Indicator handle create nahi ho saka.");
      return(INIT_FAILED);
   }

   if(InpFastEMA >= InpSlowEMA)
      Print("WARNING: FastEMA slow se choti honi chahiye behtar results ke liye.");

   Print("GoldSilverBot initialized on ", _Symbol, " / ", EnumToString(InpTimeframe));
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization                                          |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   if(hFastEMA != INVALID_HANDLE) IndicatorRelease(hFastEMA);
   if(hSlowEMA != INVALID_HANDLE) IndicatorRelease(hSlowEMA);
   if(hRSI     != INVALID_HANDLE) IndicatorRelease(hRSI);
   if(hATR     != INVALID_HANDLE) IndicatorRelease(hATR);
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   //--- Trailing stop har tick par manage karein
   if(InpUseTrailing)
      ManageTrailing();

   //--- Sirf naye bar par decision lein (over-trading se bachne ke liye)
   if(!IsNewBar())
      return;

   //--- Filters
   if(InpUseTimeFilter && !IsTradingHour())
      return;

   if(!IsSpreadOK())
      return;

   //--- Signal generate karein
   int signal = GetSignal(); // 1 = buy, -1 = sell, 0 = none
   if(signal == 0)
      return;

   int openCount = CountOpenPositions();

   //--- Agar opposite direction ka signal ho to purani positions close karein
   if(openCount > 0)
   {
      if(HasOppositePosition(signal))
         CloseAllPositions();
      else
         return; // pehle se same direction me position hai
   }

   //--- Naya limit check
   if(CountOpenPositions() >= InpMaxPositions)
      return;

   //--- Trade execute karein
   if(signal == 1)
      OpenTrade(ORDER_TYPE_BUY);
   else if(signal == -1)
      OpenTrade(ORDER_TYPE_SELL);
}

//+------------------------------------------------------------------+
//| Signal logic: EMA crossover + RSI filter                         |
//+------------------------------------------------------------------+
int GetSignal()
{
   double fast[3], slow[3], rsi[2];

   if(CopyBuffer(hFastEMA, 0, 0, 3, fast) < 3) return 0;
   if(CopyBuffer(hSlowEMA, 0, 0, 3, slow) < 3) return 0;
   if(CopyBuffer(hRSI,     0, 0, 2, rsi)  < 2) return 0;

   // Index 1 = last closed bar, Index 2 = bar before that
   bool bullishCross = (fast[2] <= slow[2]) && (fast[1] > slow[1]);
   bool bearishCross = (fast[2] >= slow[2]) && (fast[1] < slow[1]);

   double rsiVal = rsi[1];

   // BUY: fast EMA slow ko upar cross kare aur RSI overbought na ho
   if(bullishCross && rsiVal < InpRSIUpper)
      return 1;

   // SELL: fast EMA slow ko neeche cross kare aur RSI oversold na ho
   if(bearishCross && rsiVal > InpRSILower)
      return -1;

   return 0;
}

//+------------------------------------------------------------------+
//| Open a trade with ATR-based SL/TP and risk-based lot             |
//+------------------------------------------------------------------+
void OpenTrade(ENUM_ORDER_TYPE type)
{
   double atr = GetATR();
   if(atr <= 0)
   {
      Print("ATR value invalid, trade skip.");
      return;
   }

   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double price, sl, tp;

   if(type == ORDER_TYPE_BUY)
   {
      price = ask;
      sl = price - InpSL_ATR * atr;
      tp = price + InpTP_ATR * atr;
   }
   else
   {
      price = bid;
      sl = price + InpSL_ATR * atr;
      tp = price - InpTP_ATR * atr;
   }

   //--- Normalize to symbol digits & respect stop level
   sl = NormalizePrice(sl);
   tp = NormalizePrice(tp);

   double slDistance = MathAbs(price - sl);
   double lot = CalculateLot(slDistance);
   if(lot <= 0)
   {
      Print("Lot calculation 0 aya, trade skip.");
      return;
   }

   bool ok;
   if(type == ORDER_TYPE_BUY)
      ok = trade.Buy(lot, _Symbol, 0.0, sl, tp, InpComment);
   else
      ok = trade.Sell(lot, _Symbol, 0.0, sl, tp, InpComment);

   if(ok)
      PrintFormat("%s opened: lot=%.2f price=%.5f SL=%.5f TP=%.5f",
                  (type == ORDER_TYPE_BUY ? "BUY" : "SELL"), lot, price, sl, tp);
   else
      PrintFormat("Trade fail: %d - %s", trade.ResultRetcode(), trade.ResultRetcodeDescription());
}

//+------------------------------------------------------------------+
//| Risk-based position sizing                                       |
//+------------------------------------------------------------------+
double CalculateLot(double slDistancePrice)
{
   //--- Agar fixed lot set hai
   if(InpFixedLot > 0.0)
      return NormalizeLot(InpFixedLot);

   double balance   = AccountInfoDouble(ACCOUNT_BALANCE);
   double riskMoney = balance * InpRiskPercent / 100.0;

   double tickValue = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   if(tickSize <= 0 || tickValue <= 0)
      return NormalizeLot(InpFixedLot > 0 ? InpFixedLot : 0.01);

   //--- Loss per 1 lot agar SL hit ho
   double lossPerLot = (slDistancePrice / tickSize) * tickValue;
   if(lossPerLot <= 0)
      return 0.0;

   double lot = riskMoney / lossPerLot;
   return NormalizeLot(lot);
}

//+------------------------------------------------------------------+
//| Trailing stop management                                         |
//+------------------------------------------------------------------+
void ManageTrailing()
{
   double atr = GetATR();
   if(atr <= 0) return;
   double trailDist = InpTrail_ATR * atr;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(!position.SelectByIndex(i)) continue;
      if(position.Symbol() != _Symbol) continue;
      if(position.Magic() != InpMagicNumber) continue;

      double curSL = position.StopLoss();
      double openP = position.PriceOpen();

      if(position.PositionType() == POSITION_TYPE_BUY)
      {
         double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
         double newSL = NormalizePrice(bid - trailDist);
         // Sirf tab move karein jab profit me ho aur SL upar ja raha ho
         if(newSL > openP && (curSL == 0 || newSL > curSL))
            trade.PositionModify(position.Ticket(), newSL, position.TakeProfit());
      }
      else if(position.PositionType() == POSITION_TYPE_SELL)
      {
         double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
         double newSL = NormalizePrice(ask + trailDist);
         if(newSL < openP && (curSL == 0 || newSL < curSL))
            trade.PositionModify(position.Ticket(), newSL, position.TakeProfit());
      }
   }
}

//==================================================================
//  HELPER FUNCTIONS
//==================================================================

//--- Naya bar aya ya nahi
bool IsNewBar()
{
   datetime t[1];
   if(CopyTime(_Symbol, InpTimeframe, 0, 1, t) < 1) return false;
   if(t[0] != lastBarTime)
   {
      lastBarTime = t[0];
      return true;
   }
   return false;
}

//--- Current ATR value (last closed bar)
double GetATR()
{
   double atr[1];
   if(CopyBuffer(hATR, 0, 1, 1, atr) < 1) return 0.0;
   return atr[0];
}

//--- Spread acceptable hai?
bool IsSpreadOK()
{
   long spread = SymbolInfoInteger(_Symbol, SYMBOL_SPREAD);
   if(spread > InpMaxSpreadPts)
   {
      // Optional: PrintFormat("Spread %d > max %d, skip.", spread, InpMaxSpreadPts);
      return false;
   }
   return true;
}

//--- Trading hours ke andar hain?
bool IsTradingHour()
{
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   if(InpStartHour <= InpEndHour)
      return (dt.hour >= InpStartHour && dt.hour < InpEndHour);
   else // overnight session (e.g. 22 -> 6)
      return (dt.hour >= InpStartHour || dt.hour < InpEndHour);
}

//--- EA ki apni khuli positions ginti
int CountOpenPositions()
{
   int count = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(!position.SelectByIndex(i)) continue;
      if(position.Symbol() == _Symbol && position.Magic() == InpMagicNumber)
         count++;
   }
   return count;
}

//--- Opposite direction ki position khuli hai?
bool HasOppositePosition(int signal)
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(!position.SelectByIndex(i)) continue;
      if(position.Symbol() != _Symbol || position.Magic() != InpMagicNumber) continue;

      if(signal == 1 && position.PositionType() == POSITION_TYPE_SELL) return true;
      if(signal == -1 && position.PositionType() == POSITION_TYPE_BUY)  return true;
   }
   return false;
}

//--- EA ki saari positions close karein
void CloseAllPositions()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(!position.SelectByIndex(i)) continue;
      if(position.Symbol() == _Symbol && position.Magic() == InpMagicNumber)
         trade.PositionClose(position.Ticket());
   }
}

//--- Price ko symbol digits par normalize karein
double NormalizePrice(double price)
{
   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   return NormalizeDouble(price, digits);
}

//--- Lot ko broker ke min/max/step ke hisab se adjust karein
double NormalizeLot(double lot)
{
   double minLot  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxLot  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double lotStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);

   if(lotStep <= 0) lotStep = 0.01;

   lot = MathFloor(lot / lotStep) * lotStep;
   if(lot < minLot) lot = minLot;
   if(lot > maxLot) lot = maxLot;
   if(lot > InpMaxLot) lot = InpMaxLot;

   //--- Step ke decimals ke hisab se round
   int lotDigits = (int)MathRound(-MathLog10(lotStep));
   if(lotDigits < 0) lotDigits = 2;
   return NormalizeDouble(lot, lotDigits);
}
//+------------------------------------------------------------------+
