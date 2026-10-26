import { ReactNode, useMemo, useState } from 'react';
import {
    classifyEvenOdd,
    classifyMatchDiffer,
    classifyOverUnder,
    classifyRiseFall,
    currentStreak,
    digitPercents,
    sharePercent,
} from './analysis-utils';
import { useDigitStream } from './use-digit-stream';
import './digit-tools.scss';

const SYMBOLS = [
    { value: 'R_10', label: 'Volatility 10 Index' },
    { value: 'R_25', label: 'Volatility 25 Index' },
    { value: 'R_50', label: 'Volatility 50 Index' },
    { value: 'R_75', label: 'Volatility 75 Index' },
    { value: 'R_100', label: 'Volatility 100 Index' },
    { value: '1HZ10V', label: 'Volatility 10 (1s) Index' },
    { value: '1HZ25V', label: 'Volatility 25 (1s) Index' },
    { value: '1HZ50V', label: 'Volatility 50 (1s) Index' },
    { value: '1HZ75V', label: 'Volatility 75 (1s) Index' },
    { value: '1HZ100V', label: 'Volatility 100 (1s) Index' },
];

const TICK_COUNT_OPTIONS = [25, 50, 100, 250, 500, 1000];
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const CHIPS_COLLAPSED = 10;
const CHIPS_EXPANDED = 40;

type TTone = 'a' | 'b' | 'c';

const DigitRing = ({
    digit,
    percent,
    isHot,
    isCold,
    isCurrent,
}: {
    digit: number;
    percent: number;
    isHot: boolean;
    isCold: boolean;
    isCurrent: boolean;
}) => (
    <div
        className={[
            'twh-ring',
            isHot ? 'twh-ring--hot' : '',
            isCold ? 'twh-ring--cold' : '',
            isCurrent ? 'twh-ring--current' : '',
        ]
            .filter(Boolean)
            .join(' ')}
    >
        <span className='twh-ring__digit'>{digit}</span>
        <span className='twh-ring__pct'>{percent.toFixed(1)}%</span>
        {isCurrent && <span className='twh-ring__pointer' aria-label='Latest digit' />}
    </div>
);

const DigitPicker = ({ value, onChange, label }: { value: number; onChange: (d: number) => void; label: string }) => (
    <div className='twh-picker' role='group' aria-label={label}>
        {DIGITS.map(d => (
            <button
                key={d}
                type='button'
                className={`twh-picker__btn ${d === value ? 'is-active' : ''}`}
                onClick={() => onChange(d)}
                aria-pressed={d === value}
            >
                {d}
            </button>
        ))}
    </div>
);

type TSide = { label: string; pct: number; tone: TTone };

const OutcomePanel = ({
    title,
    sides,
    outcomes,
    toneFor,
    labelFor,
    footnote,
    children,
}: {
    title: string;
    sides: [TSide, TSide];
    outcomes: string[];
    toneFor: (letter: string) => TTone;
    labelFor: (letter: string) => string;
    footnote?: string;
    children?: ReactNode;
}) => {
    const [expanded, setExpanded] = useState(false);
    const streak = currentStreak(outcomes);
    const visible = outcomes.slice(-(expanded ? CHIPS_EXPANDED : CHIPS_COLLAPSED));

    return (
        <section className='twh-panel'>
            <header className='twh-panel__head'>
                <h3 className='twh-panel__title'>{title}</h3>
                {streak.letter && (
                    <span className={`twh-panel__streak twh-tone-${toneFor(streak.letter)}`}>
                        {streak.length}x {labelFor(streak.letter)}
                    </span>
                )}
            </header>

            {children}

            <div className='twh-panel__bars'>
                {sides.map(side => (
                    <div key={side.label} className={`twh-bar twh-tone-${side.tone}`}>
                        <span className='twh-bar__label'>{side.label}</span>
                        <div className='twh-bar__track'>
                            <div className='twh-bar__fill' style={{ width: `${Math.min(side.pct, 100)}%` }} />
                        </div>
                        <span className='twh-bar__pct'>{side.pct.toFixed(1)}%</span>
                    </div>
                ))}
            </div>

            {footnote && <div className='twh-panel__footnote'>{footnote}</div>}

            <div className='twh-panel__chips'>
                {visible.map((letter, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <span key={i} className={`twh-chip twh-tone-${toneFor(letter)}`}>
                        {letter}
                    </span>
                ))}
                {outcomes.length > CHIPS_COLLAPSED && (
                    <button type='button' className='twh-chip-more' onClick={() => setExpanded(v => !v)}>
                        {expanded ? '− Less' : '+ More'}
                    </button>
                )}
            </div>
        </section>
    );
};

const DigitTools = () => {
    const [symbol, setSymbol] = useState('R_100');
    const [tickCount, setTickCount] = useState(100);
    const [barrier, setBarrier] = useState(5);
    const [matchDigit, setMatchDigit] = useState(5);

    const { digits, prices, latestPrice, connected, error } = useDigitStream(symbol, tickCount);

    const stats = useMemo(() => {
        const percents = digitPercents(digits);
        const hasData = digits.length > 0;
        const maxPct = Math.max(...percents);
        const minPct = Math.min(...percents);

        const overUnder = classifyOverUnder(digits, barrier);
        const evenOdd = classifyEvenOdd(digits);
        const matchDiffer = classifyMatchDiffer(digits, matchDigit);
        const riseFall = classifyRiseFall(prices);

        return {
            percents,
            hotDigit: hasData ? percents.indexOf(maxPct) : -1,
            coldDigit: hasData ? percents.indexOf(minPct) : -1,
            currentDigit: hasData ? digits[digits.length - 1] : -1,
            overUnder,
            overPct: sharePercent(overUnder, 'O'),
            underPct: sharePercent(overUnder, 'U'),
            tiePct: sharePercent(overUnder, '='),
            evenOdd,
            evenPct: sharePercent(evenOdd, 'E'),
            oddPct: sharePercent(evenOdd, 'O'),
            matchDiffer,
            matchPct: sharePercent(matchDiffer, 'M'),
            differPct: sharePercent(matchDiffer, 'D'),
            riseFall,
            risePct: sharePercent(riseFall, 'R'),
            fallPct: sharePercent(riseFall, 'F'),
        };
    }, [digits, prices, barrier, matchDigit]);

    return (
        <div className='twh-digit-tools'>
            <div className='twh-digit-tools__header'>
                <div className='twh-digit-tools__controls'>
                    <select value={symbol} onChange={e => setSymbol(e.target.value)} aria-label='Market'>
                        {SYMBOLS.map(s => (
                            <option key={s.value} value={s.value}>
                                {s.label}
                            </option>
                        ))}
                    </select>
                    <select
                        value={tickCount}
                        onChange={e => setTickCount(Number(e.target.value))}
                        aria-label='Number of ticks'
                    >
                        {TICK_COUNT_OPTIONS.map(n => (
                            <option key={n} value={n}>
                                Last {n} ticks
                            </option>
                        ))}
                    </select>
                    <span className={`twh-digit-tools__status ${connected ? 'is-live' : ''}`}>
                        <span className='dot' /> {connected ? 'Live' : 'Connecting...'}
                    </span>
                </div>
                <div className='twh-digit-tools__price'>
                    <span className='twh-digit-tools__price-label'>Live price</span>
                    <span className='twh-digit-tools__price-value'>{latestPrice ?? '—'}</span>
                </div>
            </div>

            {error && <div className='twh-digit-tools__error'>{error}</div>}

            <div className='twh-digit-tools__rings'>
                {stats.percents.map((pct, digit) => (
                    <DigitRing
                        key={digit}
                        digit={digit}
                        percent={pct}
                        isHot={digit === stats.hotDigit}
                        isCold={digit === stats.coldDigit}
                        isCurrent={digit === stats.currentDigit}
                    />
                ))}
            </div>
            <div className='twh-digit-tools__legend'>
                <span className='twh-legend twh-legend--hot'>Most frequent</span>
                <span className='twh-legend twh-legend--cold'>Least frequent</span>
                <span className='twh-legend twh-legend--current'>Latest digit</span>
            </div>

            <div className='twh-digit-tools__grid'>
                <OutcomePanel
                    title='Over / Under'
                    sides={[
                        { label: 'Over', pct: stats.overPct, tone: 'a' },
                        { label: 'Under', pct: stats.underPct, tone: 'b' },
                    ]}
                    outcomes={stats.overUnder}
                    toneFor={l => (l === 'O' ? 'a' : l === 'U' ? 'b' : 'c')}
                    labelFor={l => (l === 'O' ? 'Over' : l === 'U' ? 'Under' : 'Tie')}
                    footnote={`Digit equal to ${barrier}: ${stats.tiePct.toFixed(1)}% (counts for neither side)`}
                >
                    <DigitPicker value={barrier} onChange={setBarrier} label='Over/Under barrier' />
                </OutcomePanel>

                <OutcomePanel
                    title='Match / Differ'
                    sides={[
                        { label: 'Match', pct: stats.matchPct, tone: 'a' },
                        { label: 'Differ', pct: stats.differPct, tone: 'b' },
                    ]}
                    outcomes={stats.matchDiffer}
                    toneFor={l => (l === 'M' ? 'a' : 'b')}
                    labelFor={l => (l === 'M' ? 'Match' : 'Differ')}
                >
                    <DigitPicker value={matchDigit} onChange={setMatchDigit} label='Match digit' />
                </OutcomePanel>

                <OutcomePanel
                    title='Even / Odd'
                    sides={[
                        { label: 'Even', pct: stats.evenPct, tone: 'a' },
                        { label: 'Odd', pct: stats.oddPct, tone: 'b' },
                    ]}
                    outcomes={stats.evenOdd}
                    toneFor={l => (l === 'E' ? 'a' : 'b')}
                    labelFor={l => (l === 'E' ? 'Even' : 'Odd')}
                />

                <OutcomePanel
                    title='Rise / Fall'
                    sides={[
                        { label: 'Rise', pct: stats.risePct, tone: 'a' },
                        { label: 'Fall', pct: stats.fallPct, tone: 'b' },
                    ]}
                    outcomes={stats.riseFall}
                    toneFor={l => (l === 'R' ? 'a' : 'b')}
                    labelFor={l => (l === 'R' ? 'Rise' : 'Fall')}
                />
            </div>

            <div className='twh-digit-tools__disclaimer'>
                <span className='twh-digit-tools__disclaimer-icon'>&#9888;</span>
                <span>
                    <strong>Risk Disclaimer:</strong> For informational purposes only. Past digit frequency does not
                    predict future outcomes.
                </span>
            </div>
        </div>
    );
};

export default DigitTools;
