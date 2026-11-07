import { useCallback, useEffect, useState } from 'react';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import { useApiBase } from '@/hooks/useApiBase';
import { rangeStart, toTrades, TRange, TTrade } from './insights-utils';

/**
 * Reads the signed-in user's own closed trades from Deriv (profit_table).
 * Read-only: nothing is stored anywhere and nothing is sent to any other server.
 */
export const useProfitTable = (range: TRange) => {
    const { isAuthorized, activeLoginid, authData } = useApiBase();
    const [trades, setTrades] = useState<TTrade[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [updated, setUpdated] = useState<number | null>(null);

    const load = useCallback(async () => {
        if (!isAuthorized || !api_base.api) return;
        setLoading(true);
        setError('');
        try {
            const from = rangeStart(range);
            const send = api_base.api.send.bind(api_base.api) as unknown as (request: unknown) => Promise<unknown>;
            const pages = range === 'max' ? 4 : 1;
            let rows: unknown[] = [];
            for (let page = 0; page < pages; page += 1) {
                const res = (await send({
                    profit_table: 1,
                    description: 1,
                    sort: 'DESC',
                    limit: 500,
                    offset: page * 500,
                    ...(from ? { date_from: String(from) } : {}),
                })) as { error?: { message?: string }; profit_table?: { transactions?: unknown[] } };
                if (res?.error) throw new Error(res.error.message || 'Deriv could not return your trades.');
                const got = res?.profit_table?.transactions || [];
                rows = [...rows, ...got];
                if (got.length < 500) break;
            }
            setTrades(toTrades(rows as Parameters<typeof toTrades>[0]));
            setUpdated(Date.now());
        } catch (e) {
            setTrades([]);
            setError(e instanceof Error ? e.message : 'Could not load your trades.');
        } finally {
            setLoading(false);
        }
    }, [isAuthorized, activeLoginid, range]);

    useEffect(() => {
        load();
    }, [load]);

    return {
        trades,
        loading,
        error,
        updated,
        reload: load,
        isAuthorized,
        loginid: activeLoginid,
        currency: authData?.currency || 'USD',
        balance: Number(authData?.balance ?? 0),
        isVirtual: Boolean(authData?.is_virtual),
    };
};
