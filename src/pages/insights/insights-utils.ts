/**
 * Pure helpers for the Performance and Risk Tools tabs. No React in here, so they are easy to test.
 * Trades are always oldest first, newest last.
 */

export type TRange = 'today' | '7d' | '30d' | 'all' | 'max';

export type TTrade = {
    id: number;
    time: number; // seconds since 1970
    symbol: string;
    type: string;
    stake: number;
    payout: number;
    profit: number;
};

type TRawTrade = {
    contract_id?: number;
    transaction_id?: number;
    buy_price?: number;
    sell_price?: number;
    payout?: number;
    sell_time?: number;
    purchase_time?: number;
    shortcode?: string;
};

// ---------- reading the Deriv profit table ----------

/** "DIGITEVEN_R_100_0.50_1700000000_1T" gives type DIGITEVEN and symbol R_100. */
export const parseShortcode = (shortcode = ''): { type: string; symbol: string } => {
    const p = shortcode.split('_');
    const type = p[0] || 'OTHER';
    const symbol = p[1] === 'R' && /^\d+$/.test(p[2] || '') ? `R_${p[2]}` : p[1] || 'Unknown';
    return { type, symbol };
};

export const marketName = (symbol: string): string => {
    let m = /^R_(\d+)$/.exec(symbol);
    if (m) return `Volatility ${m[1]} Index`;
    m = /^1HZ(\d+)V$/.exec(symbol);
    if (m) return `Volatility ${m[1]} (1s) Index`;
    m = /^(BOOM|CRASH)(\d+)$/.exec(symbol);
    if (m) return `${m[1][0]}${m[1].slice(1).toLowerCase()} ${m[2]} Index`;
    m = /^JD(\d+)$/.exec(symbol);
    if (m) return `Jump ${m[1]} Index`;
    if (symbol.startsWith('frx')) return symbol.slice(3);
    return symbol;
};

export const tradeKind = (type: string): string => {
    if (type === 'DIGITEVEN' || type === 'DIGITODD') return 'Even/Odd';
    if (type === 'DIGITOVER' || type === 'DIGITUNDER') return 'Over/Under';
    if (type === 'DIGITMATCH' || type === 'DIGITDIFF') return 'Match/Differ';
    if (['CALL', 'PUT', 'CALLE', 'PUTE'].includes(type)) return 'Rise/Fall';
    return 'Other';
};

export const toTrades = (rows: TRawTrade[]): TTrade[] =>
    rows
        .map((r, i) => {
            const { type, symbol } = parseShortcode(r.shortcode);
            const stake = Number(r.buy_price);
            const sold = Number(r.sell_price);
            return {
                id: Number(r.contract_id ?? r.transaction_id ?? i),
                time: Number(r.sell_time ?? r.purchase_time),
                symbol,
                type,
                stake,
                payout: Number(r.payout ?? 0),
                profit: Math.round((sold - stake) * 100) / 100,
            };
        })
        .filter(t => Number.isFinite(t.profit) && Number.isFinite(t.time))
        .sort((a, b) => a.time - b.time);

// ---------- performance numbers ----------

export type TSummary = {
    trades: number;
    wins: number;
    losses: number;
    winRate: number; // percent
    net: number;
    grossWin: number;
    grossLoss: number; // positive number
    avgWin: number;
    avgLoss: number; // positive number
    profitFactor: number | null; // null when there are no losing trades
    expectancy: number; // average result per trade
    best: number;
    worst: number;
    longestLossStreak: number;
    maxDrawdown: number; // biggest peak-to-trough fall, positive number
};

export const summarize = (trades: TTrade[]): TSummary => {
    const wins = trades.filter(t => t.profit > 0);
    const losses = trades.filter(t => t.profit < 0);
    const grossWin = wins.reduce((s, t) => s + t.profit, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.profit, 0));
    const net = grossWin - grossLoss;

    let streak = 0;
    let longestLossStreak = 0;
    let run = 0;
    let peak = 0;
    let maxDrawdown = 0;
    trades.forEach(t => {
        streak = t.profit < 0 ? streak + 1 : 0;
        longestLossStreak = Math.max(longestLossStreak, streak);
        run += t.profit;
        peak = Math.max(peak, run);
        maxDrawdown = Math.max(maxDrawdown, peak - run);
    });

    const n = trades.length;
    return {
        trades: n,
        wins: wins.length,
        losses: losses.length,
        winRate: n ? (wins.length / n) * 100 : 0,
        net,
        grossWin,
        grossLoss,
        avgWin: wins.length ? grossWin / wins.length : 0,
        avgLoss: losses.length ? grossLoss / losses.length : 0,
        profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
        expectancy: n ? net / n : 0,
        best: n ? Math.max(...trades.map(t => t.profit)) : 0,
        worst: n ? Math.min(...trades.map(t => t.profit)) : 0,
        longestLossStreak,
        maxDrawdown,
    };
};

export type TGroupRow = { key: string; trades: number; wins: number; winRate: number; net: number };

export const groupBy = (trades: TTrade[], keyOf: (t: TTrade) => string): TGroupRow[] => {
    const map = new Map<string, TTrade[]>();
    trades.forEach(t => map.set(keyOf(t), [...(map.get(keyOf(t)) || []), t]));
    return [...map.entries()]
        .map(([key, list]) => {
            const s = summarize(list);
            return { key, trades: s.trades, wins: s.wins, winRate: s.winRate, net: s.net };
        })
        .sort((a, b) => b.trades - a.trades);
};

const dayKey = (seconds: number) => {
    const d = new Date(seconds * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const dailyNet = (trades: TTrade[]): { day: string; net: number }[] => {
    const map = new Map<string, number>();
    trades.forEach(t => map.set(dayKey(t.time), (map.get(dayKey(t.time)) || 0) + t.profit));
    return [...map.entries()]
        .map(([day, net]) => ({ day, net: Math.round(net * 100) / 100 }))
        .sort((a, b) => (a.day < b.day ? -1 : 1));
};

/** Start of the chosen range in epoch seconds, or undefined for "latest 500 trades". */
export const rangeStart = (range: TRange, now = new Date()): number | undefined => {
    if (range === 'all' || range === 'max') return undefined;
    if (range === 'today')
        return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000);
    const days = range === '7d' ? 7 : 30;
    return Math.floor(now.getTime() / 1000) - days * 86400;
};

// ---------- risk calculators ----------

export const stakeFromRisk = (balance: number, riskPercent: number): number => (balance * riskPercent) / 100;
export const dailyLimit = (balance: number, limitPercent: number): number => (balance * limitPercent) / 100;
export const exposure = (stake: number, openTrades: number): number => stake * openTrades;

export type TMartingaleRow = { step: number; stake: number; totalAtRisk: number };

/** Stake at each step if every trade loses and the stake is multiplied after each loss. */
export const martingaleTable = (baseStake: number, multiplier: number, steps: number): TMartingaleRow[] => {
    const rows: TMartingaleRow[] = [];
    let stake = baseStake;
    let total = 0;
    for (let step = 1; step <= steps; step += 1) {
        total += stake;
        rows.push({ step, stake: Math.round(stake * 100) / 100, totalAtRisk: Math.round(total * 100) / 100 });
        stake *= multiplier;
    }
    return rows;
};

/** The win rate (percent) a trade must reach just to break even. `payout` includes the stake. */
export const breakevenWinRate = (stake: number, payout: number): number => (payout > 0 ? (stake / payout) * 100 : 0);

/** Average result per trade at a given win rate (percent). */
export const expectedValue = (stake: number, payout: number, winRatePercent: number): number => {
    const w = winRatePercent / 100;
    return w * (payout - stake) - (1 - w) * stake;
};

/** How much you win for every 1 you risk. */
export const rewardToRisk = (stake: number, payout: number): number => (stake > 0 ? (payout - stake) / stake : 0);

/** Results grouped by the hour of the day (your local time), earliest hour first. */
export const byHour = (trades: TTrade[]): TGroupRow[] =>
    groupBy(trades, t => `${String(new Date(t.time * 1000).getHours()).padStart(2, '0')}:00`).sort((a, b) =>
        a.key < b.key ? -1 : 1
    );

const csvCell = (v: string | number) => {
    const text = String(v);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** The trades as CSV text, newest first, ready to download. */
export const tradesToCsv = (trades: TTrade[]): string => {
    const head = 'time,market,trade_type,stake,payout,profit';
    const rows = [...trades]
        .sort((a, b) => b.time - a.time)
        .map(t =>
            [new Date(t.time * 1000).toISOString(), marketName(t.symbol), t.type, t.stake, t.payout, t.profit]
                .map(csvCell)
                .join(',')
        );
    return [head, ...rows].join('\n');
};
