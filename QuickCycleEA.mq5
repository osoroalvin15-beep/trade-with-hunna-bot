//+------------------------------------------------------------------+
//| QuickCycleEA.mq5                                                 |
//| Opens a trade, closes it as soon as profit >= InpTakeProfitUsd   |
//| or loss >= InpMaxLossUsd, then opens the next one.               |
//| Direction = EMA trend. Has spread filter, cooldown, daily guard. |
//+------------------------------------------------------------------+
#property copyright "QuickCycleEA"
#property version   "1.00"
#property strict

#include <Trade/Trade.mqh>
CTrade trade;

input group "Cycle rules (account currency, per trade)"
input double InpTakeProfitUsd = 0.30;   // Close when profit reaches this (must be > spread cost!)
input double InpMaxLossUsd    = 1.00;   // Close when loss reaches this
input double InpLots          = 0.01;
input long   InpMagic         = 20261021;

input group "Entry direction"
input ENUM_TIMEFRAMES InpTF   = PERIOD_M1;
input int    InpFastEMA       = 9;
input int    InpSlowEMA       = 21;

input group "Cost / churn control"
input double InpMaxSpreadUsd  = 0.15;   // Skip opening if spread costs more than this (per position)
input int    InpCooldownSec   = 5;      // Wait after a close before opening again
input int    InpMaxTradesDay  = 200;    // Hard cap on trades per day (0 = off)

input group "Account guard (percent of day-start equity, 0 = off)"
input double InpDailyProfitPct = 5.0;   // Stop for the day at this gain
input double InpDailyLossPct   = 3.0;   // Stop for the day at this loss

int      hFast = INVALID_HANDLE, hSlow = INVALID_HANDLE;
datetime lastCloseTime = 0, dayStart = 0;
double   dayStartEquity = 0;
int      tradesToday = 0;
bool     halted = false;

//+------------------------------------------------------------------+
int OnInit()
  {
   trade.SetExpertMagicNumber(InpMagic);
   trade.SetTypeFillingBySymbol(_Symbol);
   trade.SetDeviationInPoints(30);
   hFast = iMA(_Symbol, InpTF, InpFastEMA, 0, MODE_EMA, PRICE_CLOSE);
   hSlow = iMA(_Symbol, InpTF, InpSlowEMA, 0, MODE_EMA, PRICE_CLOSE);
   if(hFast == INVALID_HANDLE || hSlow == INVALID_HANDLE) return INIT_FAILED;
   CheckNewDay();
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   IndicatorRelease(hFast);
   IndicatorRelease(hSlow);
  }

//+------------------------------------------------------------------+
void OnTick()
  {
   CheckNewDay();
   if(halted) return;
   if(!AccountGuardOK()) return;

   ulong ticket = 0;
   if(FindMyPosition(ticket))
      ManagePosition(ticket);
   else
      OpenNext();
  }

//+------------------------------------------------------------------+
bool FindMyPosition(ulong &ticket)
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong t = PositionGetTicket(i);
      if(t == 0) continue;
      if(PositionGetString(POSITION_SYMBOL) == _Symbol &&
         PositionGetInteger(POSITION_MAGIC) == InpMagic)
        { ticket = t; return true; }
     }
   return false;
  }

// Close on dollar profit / dollar loss (profit figure includes spread and swap)
void ManagePosition(ulong ticket)
  {
   if(!PositionSelectByTicket(ticket)) return;
   double pl = PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);

   if(pl >= InpTakeProfitUsd || pl <= -InpMaxLossUsd)
     {
      if(trade.PositionClose(ticket))
         lastCloseTime = TimeCurrent();
     }
  }

//+------------------------------------------------------------------+
// money lost per 1 point of price movement for 1 lot
double ValuePerPointPerLot()
  {
   double tv = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double ts = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   if(ts <= 0) return 0;
   return tv * (_Point / ts);
  }

void OpenNext()
  {
   if(TimeCurrent() - lastCloseTime < InpCooldownSec) return;
   if(InpMaxTradesDay > 0 && tradesToday >= InpMaxTradesDay) return;

   double vpp = ValuePerPointPerLot();
   if(vpp <= 0) return;

   // spread filter in account currency
   double spreadPts = (double)SymbolInfoInteger(_Symbol, SYMBOL_SPREAD);
   if(spreadPts * vpp * InpLots > InpMaxSpreadUsd) return;

   double f[], s[];
   ArraySetAsSeries(f, true);
   ArraySetAsSeries(s, true);
   if(CopyBuffer(hFast, 0, 0, 2, f) < 2 || CopyBuffer(hSlow, 0, 0, 2, s) < 2) return;
   bool buy = (f[1] > s[1]);

   double step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   double lots = MathMax(SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN),
                         MathFloor(InpLots / step) * step);
   lots = NormalizeDouble(lots, 2);

   // Emergency broker-side stop at 3x the dollar loss (protects against gaps / lost connection)
   double emergencyPts = (InpMaxLossUsd * 3.0) / (lots * vpp);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);

   bool ok;
   if(buy) ok = trade.Buy (lots, _Symbol, ask, NormalizeDouble(ask - emergencyPts * _Point, _Digits), 0, "QuickCycle");
   else    ok = trade.Sell(lots, _Symbol, bid, NormalizeDouble(bid + emergencyPts * _Point, _Digits), 0, "QuickCycle");

   if(ok) tradesToday++;
  }

//+------------------------------------------------------------------+
void CheckNewDay()
  {
   datetime today = StringToTime(TimeToString(TimeCurrent(), TIME_DATE));
   if(today != dayStart)
     {
      dayStart = today;
      dayStartEquity = AccountInfoDouble(ACCOUNT_EQUITY);
      tradesToday = 0;
      halted = false;
     }
  }

bool AccountGuardOK()
  {
   if(dayStartEquity <= 0) return true;
   double pct = (AccountInfoDouble(ACCOUNT_EQUITY) - dayStartEquity) / dayStartEquity * 100.0;

   if((InpDailyProfitPct > 0 && pct >= InpDailyProfitPct) ||
      (InpDailyLossPct   > 0 && pct <= -InpDailyLossPct))
     {
      ulong t;
      while(FindMyPosition(t)) { if(!trade.PositionClose(t)) break; }
      PrintFormat("Daily limit reached (%.2f%%). Paused until tomorrow.", pct);
      halted = true;
      return false;
     }
   return true;
  }
//+------------------------------------------------------------------+
