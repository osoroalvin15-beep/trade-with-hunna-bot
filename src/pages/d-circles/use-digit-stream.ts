import { useEffect, useMemo, useRef, useState } from 'react';

const APP_ID = '340wutvNtAldWVNWazqCC';
// Deriv has been migrating to a newer "Options Trading API" domain. Since this
// runs from the browser with no login, and we can't verify live from this
// environment which endpoint actually works, alternate between both on retry
// so whichever one is currently correct gets used automatically.
const WS_URLS = [
    `wss://api.derivws.com/trading/v1/options/ws/public?app_id=${APP_ID}`,
    `wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`,
];
const MAX_RETRY_DELAY_MS = 15000;
const BASE_RETRY_DELAY_MS = 1000;
const CONNECT_TIMEOUT_MS = 8000;

type TTick = { quote: number; digit: number };

export interface DigitStreamResult {
    /** Last digit of each tick's quote, oldest first, newest last. */
    digits: number[];
    /** Raw quote of each tick, same order as `digits`. */
    prices: number[];
    /** Newest quote formatted with the market's decimal places, or null before the first tick. */
    latestPrice: string | null;
    connected: boolean;
    error: string | null;
}

/**
 * Streams live tick data for `symbol` from Deriv's public API (no login required)
 * and reduces each tick down to its last decimal digit (0-9). Keeps at most
 * `maxTicks` digits, dropping the oldest as new ticks arrive.
 *
 * Decimal precision (pip size) is fetched once per connection via `active_symbols`
 * so digits are computed correctly regardless of how the browser's JSON parser
 * trims trailing zeros off the raw price numbers.
 *
 * Automatically reconnects with exponential backoff on drop/error, since this
 * runs unauthenticated over a plain WebSocket and can be interrupted by mobile
 * networks, sleeping tabs, or transient server hiccups.
 */
export function useDigitStream(symbol: string, maxTicks: number): DigitStreamResult {
    const [ticks, setTicks] = useState<TTick[]>([]);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const decimalsRef = useRef<number>(2);

    useEffect(() => {
        setTicks([]);
        setError(null);
        setConnected(false);
        decimalsRef.current = 2;

        let cancelled = false;
        let ws: WebSocket | null = null;
        let retryTimeout: ReturnType<typeof setTimeout> | null = null;
        let retryCount = 0;
        let hasConnectedOnce = false;

        const toDigit = (quote: number) => {
            const str = quote.toFixed(decimalsRef.current);
            return Number(str.slice(-1));
        };

        const scheduleReconnect = () => {
            if (cancelled) return;
            const delay = Math.min(BASE_RETRY_DELAY_MS * 2 ** retryCount, MAX_RETRY_DELAY_MS);
            retryCount += 1;
            retryTimeout = setTimeout(connect, delay);
        };

        function connect() {
            if (cancelled) return;

            const url = WS_URLS[retryCount % WS_URLS.length];

            try {
                ws = new WebSocket(url);
            } catch {
                setError('Could not open a connection. Retrying…');
                scheduleReconnect();
                return;
            }

            // Some mobile networks silently drop the WebSocket handshake instead of
            // erroring, which would otherwise leave us stuck on "Connecting…" forever.
            const connectTimeout = setTimeout(() => {
                if (cancelled || !ws || ws.readyState === WebSocket.OPEN) return;
                setError('Connection timed out. Retrying…');
                ws.close();
            }, CONNECT_TIMEOUT_MS);

            ws.onopen = () => {
                if (cancelled || !ws) return;
                clearTimeout(connectTimeout);
                setConnected(true);
                setError(null);
                retryCount = 0;
                hasConnectedOnce = true;
                ws.send(JSON.stringify({ active_symbols: 'brief' }));
            };

            ws.onmessage = event => {
                if (cancelled) return;
                let data: any;
                try {
                    data = JSON.parse(event.data);
                } catch {
                    return;
                }

                if (data.error) {
                    setError(data.error.message || 'Could not load tick data.');
                    return;
                }

                if (data.msg_type === 'active_symbols' && Array.isArray(data.active_symbols) && ws) {
                    const found = data.active_symbols.find((s: any) => s.symbol === symbol);
                    if (found?.pip) {
                        const decimalPart = String(found.pip).split('.')[1] || '';
                        decimalsRef.current = decimalPart.length || 2;
                    }
                    ws.send(
                        JSON.stringify({
                            ticks_history: symbol,
                            adjust_start_time: 1,
                            count: maxTicks,
                            end: 'latest',
                            start: 1,
                            style: 'ticks',
                            subscribe: 1,
                        })
                    );
                    return;
                }

                if (data.msg_type === 'history' && data.history?.prices) {
                    const prices: number[] = data.history.prices.map((p: string | number) => Number(p));
                    setTicks(prices.map(quote => ({ quote, digit: toDigit(quote) })));
                    return;
                }

                if (data.msg_type === 'tick' && data.tick) {
                    const quote = Number(data.tick.quote);
                    const tick = { quote, digit: toDigit(quote) };
                    setTicks(prev => {
                        const next = [...prev, tick];
                        return next.length > maxTicks ? next.slice(next.length - maxTicks) : next;
                    });
                }
            };

            ws.onerror = () => {
                if (cancelled) return;
                setError(hasConnectedOnce ? 'Connection dropped. Reconnecting…' : 'Connecting…');
            };

            ws.onclose = () => {
                if (cancelled) return;
                setConnected(false);
                scheduleReconnect();
            };
        }

        connect();

        return () => {
            cancelled = true;
            if (retryTimeout) clearTimeout(retryTimeout);
            try {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ forget_all: 'ticks' }));
                }
                ws?.close();
            } catch {
                /* noop */
            }
        };
    }, [symbol, maxTicks]);

    const digits = useMemo(() => ticks.map(t => t.digit), [ticks]);
    const prices = useMemo(() => ticks.map(t => t.quote), [ticks]);
    const latest = ticks.length ? ticks[ticks.length - 1].quote : null;
    const latestPrice = latest === null ? null : latest.toFixed(decimalsRef.current);

    return { digits, prices, latestPrice, connected, error };
}
