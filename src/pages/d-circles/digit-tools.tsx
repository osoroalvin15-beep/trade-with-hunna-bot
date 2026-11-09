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

const TICK_COUNT_OPTIONS = [100, 250, 500, 1000];
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const CHIPS_COLLAPSED = 10;
const CHIPS_EXPANDED = 40;

type TColor = 'green' | 'amber' | 'orange' | 'lav' | 'coral' | 'red' | 'teal' | 'magenta' | 'indigo' | 'pink' | 'grey';
type TRank = 'green' | 'blue' | 'gold' | 'red' | '';

const HELP: Array<[string, string]> = [
    [
        'Circles',
        'Each circle is a last digit (0 to 9). The number under it is how often that digit appeared. Green appeared the most, blue second most, yellow second least and red the least.',
    ],
    ['Triangle', 'The small triangle sits under the digit of the latest tick.'],
    [
        'Over / Under',
        'Tap a digit to set your barrier. Over means the last digit was higher than it. Under means lower. Equal counts for neither.',
    ],
    ['Match / Differ', 'Tap a digit. Match means the last digit was that digit. Differ means it was any other digit.'],
    ['Even / Odd', 'Shows whether the last digit was even (0, 2, 4, 6, 8) or odd (1, 3, 5, 7, 9).'],
    ['Rise / Fall', 'Shows whether the price went up or down from one tick to the next.'],
    [
        'Letters',
        'The small boxes show the latest results, newest on the right. O = Over, U = Under, M = Match, D = Differ, E = Even, R = Rise, F = Fall. A tag like 3x Under means that result happened 3 times in a row.',
    ],
];

const DigitRing = ({
    digit,
    percent,
    rank,
    isCurrent,
}: {
    digit: number;
    percent: number;
    rank: TRank;
    isCurrent: boolean;
}) => (
    <div className={`twh-ring ${rank ? `twh-ring--${rank}` : ''}`}>
        <span className='twh-ring__digit'>{digit}</span>
        <span className='twh-ring__pct'>{percent.toFixed(1)}%</span>
        {isCurrent && <span className='twh-ring__pointer' role='img' aria-label='Latest digit' />}
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

type TSide = { label: string; pct: number; color: TColor };

const OutcomePanel = ({
    title,
    sides,
    outcomes,
    chipColor,
    labelFor,
    footnote,
    children,
}: {
    title: string;
    sides: [TSide, TSide];
    outcomes: string[];
    chipColor: (letter: string) => TColor;
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
                    <span className='twh-panel__streak'>
                        {streak.length}x {labelFor(streak.letter)}
                    </span>
                )}
            </header>

            <div className='twh-panel__body'>
                {children}

                <div className='twh-panel__bars'>
                    {sides.map(side => (
                        <div key={side.label} className={`twh-bar c-${side.color}`}>
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
                        <span key={i} className={`twh-chip c-${chipColor(letter)}`}>
                            {letter}
                        </span>
                    ))}
                    {outcomes.length > CHIPS_COLLAPSED && (
                        <button type='button' className='twh-chip-more' onClick={() => setExpanded(v => !v)}>
                            {expanded ? '− Less' : '+ More'}
                        </button>
                    )}
                </div>
            </div>
        </section>
    );
};

const DigitTools = () => {
    const [symbol, setSymbol] = useState('R_100');
    const [tickCount, setTickCount] = useState(1000);
    const [barrier, setBarrier] = useState(5);
    const [matchDigit, setMatchDigit] = useState(5);
    const [showHelp, setShowHelp] = useState(false);
    const [showDisclaimer, setShowDisclaimer] = useState(false);

    const { digits, prices, latestPrice, connected, error } = useDigitStream(symbol, tickCount);

    const stats = useMemo(() => {
        const percents = digitPercents(digits);
        const hasData = digits.length > 0;
        // rank digits: most frequent (green), second most (blue), second least (yellow), least (red)
        const order = percents.map((_, d) => d).sort((a, b) => percents[b] - percents[a] || a - b);
        const rankOf = (d: number): TRank => {
            if (!hasData) return '';
            if (d === order[0]) return 'green';
            if (d === order[1]) return 'blue';
            if (d === order[8]) return 'gold';
            if (d === order[9]) return 'red';
            return '';
        };

        const overUnder = classifyOverUnder(digits, barrier);
        const evenOdd = classifyEvenOdd(digits);
        const matchDiffer = classifyMatchDiffer(digits, matchDigit);
        const riseFall = classifyRiseFall(prices);

        return {
            percents,
            rankOf,
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
                    <select
                        className='twh-pill twh-pill--select'
                        value={symbol}
                        onChange={e => setSymbol(e.target.value)}
                        aria-label='Market'
                    >
                        {SYMBOLS.map(s => (
                            <option key={s.value} value={s.value}>
                                {s.label}
                            </option>
                        ))}
                    </select>
                    <label className='twh-pill twh-pill--ticks'>
                        <span>TICKS</span>
                        <select
                            value={tickCount}
                            onChange={e => setTickCount(Number(e.target.value))}
                            aria-label='Number of ticks'
                        >
                            {TICK_COUNT_OPTIONS.map(n => (
                                <option key={n} value={n}>
                                    {n}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button
                        type='button'
                        className={`twh-help-btn ${showHelp ? 'is-open' : ''}`}
                        onClick={() => setShowHelp(v => !v)}
                        aria-expanded={showHelp}
                        aria-controls='twh-help'
                    >
                        <span aria-hidden='true'>?</span> How to read this
                    </button>
                    <span className={`twh-digit-tools__status ${connected ? 'is-live' : ''}`}>
                        <span className='dot' /> {connected ? 'Live' : 'Connecting...'}
                    </span>
                </div>
                <div className='twh-digit-tools__price'>
                    <span className='twh-digit-tools__price-label'>LIVE PRICE</span>
                    <span className='twh-digit-tools__price-value'>{latestPrice ?? '—'}</span>
                </div>
            </div>

            {showHelp && (
                <div id='twh-help' className='twh-help' role='region'>
                    <dl>
                        {HELP.map(([term, text]) => (
                            <div key={term}>
                                <dt>{term}</dt>
                                <dd>{text}</dd>
                            </div>
                        ))}
                    </dl>
                    <p className='twh-help__note'>
                        These numbers describe what already happened. They do not predict the next tick.
                    </p>
                </div>
            )}

            {error && <div className='twh-digit-tools__error'>{error}</div>}

            <div className='twh-digit-tools__rings'>
                {stats.percents.map((pct, digit) => (
                    <DigitRing
                        key={digit}
                        digit={digit}
                        percent={pct}
                        rank={stats.rankOf(digit)}
                        isCurrent={digit === stats.currentDigit}
                    />
                ))}
            </div>

            <div className='twh-digit-tools__grid'>
                <OutcomePanel
                    title='Over / Under'
                    sides={[
                        { label: 'OVER', pct: stats.overPct, color: 'green' },
                        { label: 'UNDER', pct: stats.underPct, color: 'amber' },
                    ]}
                    outcomes={stats.overUnder}
                    chipColor={l => (l === 'O' ? 'teal' : l === 'U' ? 'magenta' : 'grey')}
                    labelFor={l => (l === 'O' ? 'Over' : l === 'U' ? 'Under' : 'Tie')}
                    footnote={`Equal to ${barrier}: ${stats.tiePct.toFixed(1)}% (counts for neither side)`}
                >
                    <DigitPicker value={barrier} onChange={setBarrier} label='Over/Under barrier' />
                </OutcomePanel>

                <OutcomePanel
                    title='Match / Differ'
                    sides={[
                        { label: 'MATCH', pct: stats.matchPct, color: 'orange' },
                        { label: 'DIFFER', pct: stats.differPct, color: 'lav' },
                    ]}
                    outcomes={stats.matchDiffer}
                    chipColor={l => (l === 'M' ? 'orange' : 'indigo')}
                    labelFor={l => (l === 'M' ? 'Match' : 'Differ')}
                >
                    <DigitPicker value={matchDigit} onChange={setMatchDigit} label='Match digit' />
                </OutcomePanel>

                <OutcomePanel
                    title='Even / Odd'
                    sides={[
                        { label: 'EVEN', pct: stats.evenPct, color: 'coral' },
                        { label: 'ODD', pct: stats.oddPct, color: 'red' },
                    ]}
                    outcomes={stats.evenOdd}
                    chipColor={l => (l === 'E' ? 'coral' : 'red')}
                    labelFor={l => (l === 'E' ? 'Even' : 'Odd')}
                />

                <OutcomePanel
                    title='Rise / Fall'
                    sides={[
                        { label: 'RISE', pct: stats.risePct, color: 'green' },
                        { label: 'FALL', pct: stats.fallPct, color: 'red' },
                    ]}
                    outcomes={stats.riseFall}
                    chipColor={l => (l === 'R' ? 'teal' : 'pink')}
                    labelFor={l => (l === 'R' ? 'Rise' : 'Fall')}
                />
            </div>

            <div className='twh-digit-tools__disclaimer'>
                <button
                    type='button'
                    className={`twh-disclaimer-btn ${showDisclaimer ? 'is-open' : ''}`}
                    onClick={() => setShowDisclaimer(v => !v)}
                    aria-expanded={showDisclaimer}
                    aria-controls='twh-risk-disclaimer'
                >
                    <span aria-hidden='true'>&#9888;</span> Risk Disclaimer
                </button>
                {showDisclaimer && (
                    <div id='twh-risk-disclaimer' className='twh-disclaimer-text' role='region'>
                        For informational purposes only. Past digit frequency does not predict future outcomes, and
                        trading can result in the loss of your stake. Only trade with money you can afford to lose.
                    </div>
                )}
            </div>
        </div>
    );
};

export default DigitTools;
