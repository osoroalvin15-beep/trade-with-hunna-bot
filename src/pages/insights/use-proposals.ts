import { useEffect, useState } from 'react';

// Live prices come from Deriv for this app, so they already include any markup it adds.
const APP_ID = '340wutvNtAldWVNWazqCC';
const WS_URLS = [
    `wss://api.derivws.com/trading/v1/options/ws/public?app_id=${APP_ID}`,
    `wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`,
];

type TContract = { type: string; label: (d: number) => string; digit?: boolean };
export const CONTRACTS: TContract[] = [
    { type: 'CALL', label: () => 'Rise' },
    { type: 'PUT', label: () => 'Fall' },
    { type: 'DIGITEVEN', label: () => 'Even' },
    { type: 'DIGITODD', label: () => 'Odd' },
    { type: 'DIGITOVER', label: d => `Over ${d}`, digit: true },
    { type: 'DIGITUNDER', label: d => `Under ${d}`, digit: true },
    { type: 'DIGITMATCH', label: d => `Matches ${d}`, digit: true },
    { type: 'DIGITDIFF', label: d => `Differs from ${d}`, digit: true },
];

export type TQuote = { type: string; label: string; payout: number | null; error: string | null; waiting: boolean };

export const useProposals = (symbol: string, stake: number, duration: number, digit: number) => {
    const [quotes, setQuotes] = useState<TQuote[]>([]);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (!(stake >= 0.35)) {
            setQuotes([]);
            setStatus('ready');
            return undefined;
        }
        setStatus('loading');
        setQuotes([]);
        let stopped = false;
        let ws: WebSocket | null = null;
        let tries = 0;
        const timers: ReturnType<typeof setTimeout>[] = [];
        const results = new Map<number, TQuote>();
        const snapshot = () =>
            CONTRACTS.map(
                (c, i) =>
                    results.get(i) || { type: c.type, label: c.label(digit), payout: null, error: null, waiting: true }
            );

        const retry = () => {
            if (stopped) return;
            if (tries >= 4) setStatus('error');
            else timers.push(setTimeout(connect, 800));
        };

        function connect() {
            if (stopped) return;
            const url = WS_URLS[tries % WS_URLS.length];
            tries += 1;
            try {
                ws = new WebSocket(url);
            } catch {
                retry();
                return;
            }
            const guard = setTimeout(() => ws?.close(), 8000);
            timers.push(guard);
            ws.onopen = () => {
                CONTRACTS.forEach((c, i) =>
                    ws?.send(
                        JSON.stringify({
                            proposal: 1,
                            req_id: i + 1,
                            amount: stake,
                            basis: 'stake',
                            contract_type: c.type,
                            currency: 'USD',
                            duration,
                            duration_unit: 't',
                            symbol,
                            ...(c.digit ? { barrier: String(digit) } : {}),
                        })
                    )
                );
            };
            ws.onmessage = ev => {
                let d: { req_id?: number; proposal?: { payout?: number }; error?: { message?: string } };
                try {
                    d = JSON.parse(ev.data);
                } catch {
                    return;
                }
                const i = (d.req_id || 0) - 1;
                if (i < 0 || i >= CONTRACTS.length) return;
                results.set(i, {
                    type: CONTRACTS[i].type,
                    label: CONTRACTS[i].label(digit),
                    payout: d.proposal ? Number(d.proposal.payout) : null,
                    error: d.error ? d.error.message || 'Not available' : null,
                    waiting: false,
                });
                setQuotes(snapshot());
                if (results.size === CONTRACTS.length) {
                    clearTimeout(guard);
                    setStatus('ready');
                    ws?.close();
                }
            };
            const lost = () => {
                clearTimeout(guard);
                if (!stopped && results.size < CONTRACTS.length) retry();
            };
            ws.onerror = lost;
            ws.onclose = lost;
        }

        timers.push(setTimeout(connect, 450)); // wait while the user is still typing
        return () => {
            stopped = true;
            timers.forEach(clearTimeout);
            if (ws) {
                ws.onclose = null;
                ws.onerror = null;
                ws.close();
            }
        };
    }, [symbol, stake, duration, digit, attempt]);

    return { quotes, status, retry: () => setAttempt(n => n + 1) };
};
