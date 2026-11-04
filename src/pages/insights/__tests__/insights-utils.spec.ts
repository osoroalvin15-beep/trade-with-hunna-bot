import {
    breakevenWinRate,
    dailyLimit,
    dailyNet,
    expectedValue,
    exposure,
    groupBy,
    marketName,
    martingaleTable,
    parseShortcode,
    rangeStart,
    rewardToRisk,
    stakeFromRisk,
    summarize,
    toTrades,
    tradeKind,
    TTrade,
} from '../insights-utils';

const t = (id: number, profit: number, time = id * 3600, symbol = 'R_100', type = 'DIGITEVEN'): TTrade => ({
    id,
    time,
    symbol,
    type,
    stake: 1,
    payout: 1.95,
    profit,
});

describe('reading the profit table', () => {
    it('splits a shortcode into type and market', () => {
        expect(parseShortcode('DIGITEVEN_R_100_0.50_1700000000_1T')).toEqual({ type: 'DIGITEVEN', symbol: 'R_100' });
        expect(parseShortcode('CALL_1HZ100V_1.00_1700000000_5T')).toEqual({ type: 'CALL', symbol: '1HZ100V' });
        expect(parseShortcode('')).toEqual({ type: 'OTHER', symbol: 'Unknown' });
    });

    it('gives markets readable names', () => {
        expect(marketName('R_100')).toBe('Volatility 100 Index');
        expect(marketName('1HZ10V')).toBe('Volatility 10 (1s) Index');
        expect(marketName('BOOM500')).toBe('Boom 500 Index');
        expect(marketName('frxEURUSD')).toBe('EURUSD');
    });

    it('groups contract types', () => {
        expect(tradeKind('DIGITODD')).toBe('Even/Odd');
        expect(tradeKind('DIGITUNDER')).toBe('Over/Under');
        expect(tradeKind('DIGITDIFF')).toBe('Match/Differ');
        expect(tradeKind('PUT')).toBe('Rise/Fall');
        expect(tradeKind('ACCU')).toBe('Other');
    });

    it('turns raw rows into trades, oldest first, and drops broken rows', () => {
        const rows = [
            {
                contract_id: 2,
                buy_price: 1,
                sell_price: 1.95,
                sell_time: 200,
                shortcode: 'DIGITEVEN_R_100_1_1_1T',
                payout: 1.95,
            },
            {
                contract_id: 1,
                buy_price: 1,
                sell_price: 0,
                sell_time: 100,
                shortcode: 'DIGITODD_R_100_1_1_1T',
                payout: 1.95,
            },
            { contract_id: 3, buy_price: 1, shortcode: 'x' },
        ];
        const out = toTrades(rows);
        expect(out.map(x => x.id)).toEqual([1, 2]);
        expect(out.map(x => x.profit)).toEqual([-1, 0.95]);
    });
});

describe('summarize', () => {
    it('works out win rate, net, profit factor and streaks', () => {
        const s = summarize([t(1, 0.95), t(2, -1), t(3, -1), t(4, -1), t(5, 0.95), t(6, 0.95)]);
        expect(s.trades).toBe(6);
        expect(s.wins).toBe(3);
        expect(s.losses).toBe(3);
        expect(s.winRate).toBe(50);
        expect(s.net).toBeCloseTo(-0.15);
        expect(s.profitFactor).toBeCloseTo(2.85 / 3);
        expect(s.longestLossStreak).toBe(3);
        expect(s.best).toBe(0.95);
        expect(s.worst).toBe(-1);
    });

    it('measures the biggest fall from a peak', () => {
        // running total: +2, +1, -1, 0, +3  -> peak 2, low -1, drawdown 3
        expect(summarize([t(1, 2), t(2, -1), t(3, -2), t(4, 1), t(5, 3)]).maxDrawdown).toBe(3);
    });

    it('handles no trades and no losses', () => {
        expect(summarize([]).winRate).toBe(0);
        expect(summarize([t(1, 1)]).profitFactor).toBeNull();
    });
});

describe('grouping', () => {
    it('groups by market with win rate and net', () => {
        const rows = groupBy([t(1, 1, 1, 'R_100'), t(2, -1, 2, 'R_100'), t(3, 1, 3, 'R_10')], x => x.symbol);
        expect(rows[0]).toMatchObject({ key: 'R_100', trades: 2, wins: 1, winRate: 50, net: 0 });
        expect(rows[1]).toMatchObject({ key: 'R_10', trades: 1, net: 1 });
    });

    it('adds up each day', () => {
        const day = new Date(2026, 9, 5, 12).getTime() / 1000;
        const out = dailyNet([t(1, 1, day), t(2, -0.5, day + 60), t(3, 2, day + 86400)]);
        expect(out.map(d => d.net)).toEqual([0.5, 2]);
    });

    it('finds the start of each range', () => {
        const now = new Date(2026, 9, 5, 15, 30);
        expect(rangeStart('all', now)).toBeUndefined();
        expect(rangeStart('today', now)).toBe(Math.floor(new Date(2026, 9, 5).getTime() / 1000));
        expect(rangeStart('7d', now)).toBe(Math.floor(now.getTime() / 1000) - 7 * 86400);
    });
});

describe('risk calculators', () => {
    it('sizes a stake from a risk percentage', () => {
        expect(stakeFromRisk(200, 1)).toBe(2);
        expect(dailyLimit(200, 5)).toBe(10);
        expect(exposure(2, 3)).toBe(6);
    });

    it('shows how martingale stakes pile up', () => {
        expect(martingaleTable(1, 2, 4)).toEqual([
            { step: 1, stake: 1, totalAtRisk: 1 },
            { step: 2, stake: 2, totalAtRisk: 3 },
            { step: 3, stake: 4, totalAtRisk: 7 },
            { step: 4, stake: 8, totalAtRisk: 15 },
        ]);
    });

    it('finds the win rate needed to break even and the average result', () => {
        expect(breakevenWinRate(1, 1.95)).toBeCloseTo(51.28, 1);
        expect(expectedValue(1, 1.95, breakevenWinRate(1, 1.95))).toBeCloseTo(0, 5);
        expect(expectedValue(1, 1.95, 60)).toBeCloseTo(0.17, 2);
        expect(rewardToRisk(1, 1.95)).toBeCloseTo(0.95);
        expect(breakevenWinRate(1, 0)).toBe(0);
    });
});
