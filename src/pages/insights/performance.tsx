import { useMemo, useState } from 'react';
import {
    byHour,
    dailyNet,
    groupBy,
    marketName,
    summarize,
    tradeKind,
    tradesToCsv,
    TGroupRow,
    TRange,
} from './insights-utils';
import { canUse, planName, requiredPlan, TFeature } from './plans-config';
import { usePlan, useGoToPlans } from './use-plan';
import { useProfitTable } from './use-profit-table';
import './insights.scss';

const RANGES: { id: TRange; label: string; feature: TFeature | null }[] = [
    { id: 'today', label: 'Today', feature: null },
    { id: '7d', label: '7 days', feature: null },
    { id: '30d', label: '30 days', feature: 'range_30d' },
    { id: 'all', label: 'Latest 500', feature: 'range_500' },
    { id: 'max', label: 'Latest 2000', feature: 'range_2000' },
];

const money = (n: number, cur: string) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(n).toFixed(2)} ${cur}`;
const tone = (n: number) => (n > 0 ? 'up' : n < 0 ? 'down' : '');

const Stat = ({ label, value, hint, kind = '' }: { label: string; value: string; hint: string; kind?: string }) => (
    <div className='twi-stat'>
        <span className='twi-stat__label'>{label}</span>
        <span className={`twi-stat__value ${kind}`}>{value}</span>
        <span className='twi-stat__hint'>{hint}</span>
    </div>
);

const Locked = ({ title, feature, goToPlans }: { title: string; feature: TFeature; goToPlans: () => void }) => (
    <section className='twi-card twi-locked'>
        <h3 className='twi-card__title'>{title}</h3>
        <p className='twi-muted'>This part is on the {planName(requiredPlan(feature))} plan and above.</p>
        <button type='button' className='twi-btn' onClick={goToPlans}>
            See plans
        </button>
    </section>
);

const Table = ({
    title,
    rows,
    name,
    currency,
}: {
    title: string;
    rows: TGroupRow[];
    name: (k: string) => string;
    currency: string;
}) => (
    <section className='twi-card'>
        <h3 className='twi-card__title'>{title}</h3>
        {rows.length === 0 ? (
            <p className='twi-muted'>No trades in this period.</p>
        ) : (
            <div className='twi-table' role='table'>
                <div className='twi-table__row twi-table__row--head' role='row'>
                    <span>Name</span>
                    <span>Trades</span>
                    <span>Win rate</span>
                    <span>Result</span>
                </div>
                {rows.map(r => (
                    <div className='twi-table__row' role='row' key={r.key}>
                        <span>{name(r.key)}</span>
                        <span>{r.trades}</span>
                        <span>{r.winRate.toFixed(0)}%</span>
                        <span className={tone(r.net)}>{money(r.net, currency)}</span>
                    </div>
                ))}
            </div>
        )}
    </section>
);

const download = (text: string, name: string) => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
};

const Performance = () => {
    const { plan } = usePlan();
    const goToPlans = useGoToPlans();
    const [range, setRange] = useState<TRange>('7d');
    const [lockedFor, setLockedFor] = useState<TFeature | null>(null);
    const can = (f: TFeature) => canUse(plan, f);
    const { trades, loading, error, updated, reload, isAuthorized, loginid, currency, isVirtual } =
        useProfitTable(range);

    const s = useMemo(() => summarize(trades), [trades]);
    const byMarket = useMemo(() => groupBy(trades, t => t.symbol), [trades]);
    const byKind = useMemo(() => groupBy(trades, t => tradeKind(t.type)), [trades]);
    const hours = useMemo(() => byHour(trades), [trades]);
    const days = useMemo(() => dailyNet(trades).slice(-14), [trades]);
    const maxDay = Math.max(1, ...days.map(d => Math.abs(d.net)));

    const pick = (r: (typeof RANGES)[number]) => {
        if (r.feature && !can(r.feature)) {
            setLockedFor(r.feature);
            return;
        }
        setLockedFor(null);
        setRange(r.id);
    };

    return (
        <div className='twi'>
            <header className='twi__head'>
                <div>
                    <h2 className='twi__title'>My performance</h2>
                    <p className='twi-muted'>
                        {isAuthorized
                            ? `Account ${loginid}${isVirtual ? ' (demo)' : ''}`
                            : 'Log in to see your own results'}
                    </p>
                </div>
                <div className='twi-pills' role='group' aria-label='Time period'>
                    {RANGES.map(r => {
                        const locked = Boolean(r.feature && !can(r.feature));
                        return (
                            <button
                                key={r.id}
                                type='button'
                                className={`${range === r.id ? 'is-on' : ''} ${locked ? 'is-locked' : ''}`}
                                aria-pressed={range === r.id}
                                onClick={() => pick(r)}
                            >
                                {r.label}
                                {locked && <span className='twi-pills__lock'> (locked)</span>}
                            </button>
                        );
                    })}
                </div>
            </header>

            {lockedFor && (
                <p className='twi-note'>
                    That period is on the {planName(requiredPlan(lockedFor))} plan and above.{' '}
                    <button type='button' className='twi-link' onClick={goToPlans}>
                        See plans
                    </button>
                </p>
            )}
            {!isAuthorized && (
                <p className='twi-note'>
                    Log in with your Deriv account and your closed trades will show up here. Only you can see them.
                </p>
            )}
            {error && <p className='twi-error'>{error}</p>}
            {isAuthorized && loading && <p className='twi-muted'>Loading your trades…</p>}

            {isAuthorized && !loading && !error && trades.length === 0 && (
                <p className='twi-note'>
                    No closed trades in this period yet. Pick a longer period, or place a trade and come back.
                </p>
            )}

            {trades.length > 0 && (
                <>
                    <div className='twi-grid'>
                        <Stat
                            label='Profit or loss'
                            value={money(s.net, currency)}
                            kind={tone(s.net)}
                            hint={`Across ${s.trades} trades`}
                        />
                        <Stat
                            label='Win rate'
                            value={`${s.winRate.toFixed(0)}%`}
                            hint={`You won ${s.wins} and lost ${s.losses}`}
                        />
                        <Stat
                            label='Average win vs average loss'
                            value={`${s.avgWin.toFixed(2)} / ${s.avgLoss.toFixed(2)}`}
                            hint='What a win pays versus what a loss costs'
                        />
                        <Stat
                            label='Profit factor'
                            value={s.profitFactor === null ? 'No losses' : s.profitFactor.toFixed(2)}
                            kind={s.profitFactor !== null ? (s.profitFactor >= 1 ? 'up' : 'down') : 'up'}
                            hint='Total won divided by total lost. Above 1 means you are ahead'
                        />
                        <Stat
                            label='Average per trade'
                            value={money(s.expectancy, currency)}
                            kind={tone(s.expectancy)}
                            hint='Your typical result for one trade'
                        />
                        <Stat
                            label='Longest losing streak'
                            value={`${s.longestLossStreak} in a row`}
                            hint='Most losses back to back'
                        />
                        <Stat
                            label='Biggest drop'
                            value={`-${s.maxDrawdown.toFixed(2)} ${currency}`}
                            kind={s.maxDrawdown > 0 ? 'down' : ''}
                            hint='Largest fall from your best point'
                        />
                        <Stat
                            label='Best and worst trade'
                            value={`${money(s.best, currency)} / ${money(s.worst, currency)}`}
                            hint='Your biggest win and biggest loss'
                        />
                    </div>

                    {can('daily_chart') ? (
                        <section className='twi-card'>
                            <h3 className='twi-card__title'>Result by day</h3>
                            <div className='twi-bars' role='img' aria-label='Profit or loss for each recent day'>
                                {days.map(d => (
                                    <div
                                        className='twi-bars__col'
                                        key={d.day}
                                        title={`${d.day}: ${money(d.net, currency)}`}
                                    >
                                        <span className={`twi-bars__value ${tone(d.net)}`}>
                                            {d.net > 0 ? '+' : ''}
                                            {d.net.toFixed(1)}
                                        </span>
                                        <div className='twi-bars__track'>
                                            <div
                                                className={`twi-bars__bar ${d.net >= 0 ? 'up' : 'down'}`}
                                                style={{ height: `${Math.max(6, (Math.abs(d.net) / maxDay) * 100)}%` }}
                                            />
                                        </div>
                                        <span className='twi-bars__day'>{d.day.slice(5).replace('-', '/')}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : (
                        <Locked title='Result by day' feature='daily_chart' goToPlans={goToPlans} />
                    )}

                    {can('breakdowns') ? (
                        <div className='twi-two'>
                            <Table title='Results by market' rows={byMarket} name={marketName} currency={currency} />
                            <Table title='Results by trade type' rows={byKind} name={k => k} currency={currency} />
                        </div>
                    ) : (
                        <Locked title='Results by market and trade type' feature='breakdowns' goToPlans={goToPlans} />
                    )}

                    {can('hour_table') ? (
                        <Table
                            title='Results by time of day (your local time)'
                            rows={hours}
                            name={k => k}
                            currency={currency}
                        />
                    ) : (
                        <Locked title='Results by time of day' feature='hour_table' goToPlans={goToPlans} />
                    )}
                </>
            )}

            <footer className='twi-foot'>
                <span>
                    Based on your closed trades in this period
                    {updated ? `, updated ${new Date(updated).toLocaleTimeString()}` : ''}. These figures describe the
                    past only and do not predict future results.
                </span>
                <span className='twi-foot__actions'>
                    {isAuthorized && trades.length > 0 && (
                        <button
                            type='button'
                            className='twi-btn twi-btn--ghost'
                            onClick={() =>
                                can('csv') ? download(tradesToCsv(trades), `trades-${range}.csv`) : goToPlans()
                            }
                        >
                            {can('csv') ? 'Download CSV' : 'Download CSV (Professional)'}
                        </button>
                    )}
                    {isAuthorized && (
                        <button type='button' className='twi-btn' onClick={reload} disabled={loading}>
                            Refresh
                        </button>
                    )}
                </span>
            </footer>
        </div>
    );
};

export default Performance;
