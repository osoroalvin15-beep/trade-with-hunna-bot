import { useState } from 'react';
import { TRANSPARENCY } from './transparency-config';
import { useProposals } from './use-proposals';
import './insights.scss';

const MARKETS = [
    { id: 'R_10', label: 'Volatility 10 Index' },
    { id: 'R_25', label: 'Volatility 25 Index' },
    { id: 'R_50', label: 'Volatility 50 Index' },
    { id: 'R_75', label: 'Volatility 75 Index' },
    { id: 'R_100', label: 'Volatility 100 Index' },
    { id: '1HZ100V', label: 'Volatility 100 (1s) Index' },
];

const num = (v: string) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0);

const FAQ: { q: string; a: string }[] = [
    {
        q: 'What is a markup?',
        a: 'A markup is a small percentage a platform adds to the price of a contract. It is the platform’s fee for the service. The live prices above already include it, so what you see is what you pay.',
    },
    {
        q: 'Why do payouts differ between trade types?',
        a: 'A payout reflects how likely the outcome is. Something that happens often, like Even or Odd, pays less. Something that happens rarely, like a Match on one digit, pays more. Neither is a better deal in itself. What matters is the win rate you need to break even.',
    },
    {
        q: 'What is the win rate needed to break even?',
        a: 'It is your stake divided by the payout. If a trade pays 1.95 for a 1.00 stake, you must win about 51% of the time just to get your money back. The lower you trade below that, the more you lose over time.',
    },
    {
        q: 'Are there other fees?',
        a: 'Fees for deposits and withdrawals are set by Deriv and your payment provider, not by this app. Check them with Deriv before you move money.',
    },
    {
        q: 'Where do my trades and results come from?',
        a: 'Your results are read from your own Deriv account in your browser. The Performance tab does not store them on our servers.',
    },
];

const Transparency = () => {
    const [market, setMarket] = useState('R_100');
    const [stakeText, setStakeText] = useState('1');
    const [duration, setDuration] = useState(5);
    const [digit, setDigit] = useState(5);
    const [open, setOpen] = useState<number | null>(0);

    const stake = num(stakeText);
    const { quotes, status, retry } = useProposals(market, stake, duration, digit);
    const markup = TRANSPARENCY.markupPercent;

    return (
        <div className='twi'>
            <header className='twi__head'>
                <div>
                    <h2 className='twi__title'>Transparency Centre</h2>
                    <p className='twi-muted'>
                        Plain answers about what this app does, how it earns money, and what a trade costs you.
                    </p>
                </div>
            </header>

            <div className='twi-two'>
                <section className='twi-card'>
                    <h3 className='twi-card__title'>How this app earns money</h3>
                    <ul className='twi-list'>
                        <li>
                            <b>Paid analytics plans.</b> The Free plan costs nothing. Starter, Professional and Advanced
                            give you deeper reports. See the Plans tab.
                        </li>
                        {markup !== null && markup > 0 && (
                            <li>
                                <b>A trade markup of {markup}%.</b> This is added to the price of a contract. It is
                                already included in the live prices below.
                            </li>
                        )}
                        {markup === 0 && (
                            <li>
                                <b>No trade markup.</b> This app does not add a markup to your trades.
                            </li>
                        )}
                        {TRANSPARENCY.extraRevenueNotes.map(n => (
                            <li key={n}>{n}</li>
                        ))}
                    </ul>
                </section>

                <section className='twi-card'>
                    <h3 className='twi-card__title'>Your money and your trades</h3>
                    <ul className='twi-list'>
                        <li>Trades are placed on your own Deriv account. Your funds stay with Deriv.</li>
                        <li>
                            The Analysis Tool, Performance and Risk Tools only read information. They never place trades
                            for you.
                        </li>
                        <li>Nobody here can promise profit. Past results do not predict future ones.</li>
                    </ul>
                </section>
            </div>

            <section className='twi-card'>
                <h3 className='twi-card__title'>Compare payouts, live</h3>
                <p className='twi-muted'>
                    Pick a market and stake to see what each kind of trade would pay right now, and how often you need
                    to win to break even.
                </p>
                <div className='twi-row4'>
                    <label className='twi-field'>
                        <span>Market</span>
                        <span className='twi-field__box'>
                            <select value={market} onChange={e => setMarket(e.target.value)}>
                                {MARKETS.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.label}
                                    </option>
                                ))}
                            </select>
                        </span>
                    </label>
                    <label className='twi-field'>
                        <span>Stake (USD)</span>
                        <span className='twi-field__box'>
                            <input
                                type='number'
                                inputMode='decimal'
                                min='0.35'
                                step='0.5'
                                value={stakeText}
                                onChange={e => setStakeText(e.target.value)}
                            />
                        </span>
                    </label>
                    <label className='twi-field'>
                        <span>Length</span>
                        <span className='twi-field__box'>
                            <select value={duration} onChange={e => setDuration(Number(e.target.value))}>
                                {[1, 3, 5, 10].map(n => (
                                    <option key={n} value={n}>
                                        {n} {n === 1 ? 'tick' : 'ticks'}
                                    </option>
                                ))}
                            </select>
                        </span>
                    </label>
                    <label className='twi-field'>
                        <span>Digit (for Over, Under, Match, Differ)</span>
                        <span className='twi-field__box'>
                            <select value={digit} onChange={e => setDigit(Number(e.target.value))}>
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                                    <option key={n} value={n}>
                                        {n}
                                    </option>
                                ))}
                            </select>
                        </span>
                    </label>
                </div>

                {stake < 0.35 && <p className='twi-hint down'>The smallest stake is 0.35.</p>}
                {stake >= 0.35 && status === 'error' && (
                    <p className='twi-error'>
                        Live prices are not available right now. Check your connection and{' '}
                        <button type='button' className='twi-link' onClick={retry}>
                            try again
                        </button>
                        .
                    </p>
                )}

                {stake >= 0.35 && status !== 'error' && (
                    <div className='twi-table' role='table'>
                        <div className='twi-table__row twi-table__row--head five' role='row'>
                            <span>Trade</span>
                            <span>You pay</span>
                            <span>Pays if you win</span>
                            <span>Profit if you win</span>
                            <span>Win rate needed</span>
                        </div>
                        {(quotes.length ? quotes : []).map(q => (
                            <div className='twi-table__row five' role='row' key={q.type}>
                                <span>{q.label}</span>
                                {q.waiting ? (
                                    <span className='twi-muted'>Loading…</span>
                                ) : q.payout === null ? (
                                    <span className='twi-muted' style={{ gridColumn: 'span 4' }}>
                                        Not available for these choices
                                    </span>
                                ) : (
                                    <>
                                        <span>{stake.toFixed(2)}</span>
                                        <span>{q.payout.toFixed(2)}</span>
                                        <span className='up'>+{(q.payout - stake).toFixed(2)}</span>
                                        <span>{((stake / q.payout) * 100).toFixed(1)}%</span>
                                    </>
                                )}
                            </div>
                        ))}
                        {status === 'loading' && !quotes.length && <p className='twi-muted'>Getting live prices…</p>}
                    </div>
                )}
                <p className='twi-hint'>
                    Prices come live from Deriv for this app and already include any markup. They change from moment to
                    moment.
                </p>
            </section>

            {markup !== null && markup > 0 && (
                <section className='twi-card'>
                    <h3 className='twi-card__title'>What the markup costs you</h3>
                    <p className='twi-muted'>
                        With a {markup}% markup, a stake of {stake.toFixed(2)} USD carries about{' '}
                        {((stake * markup) / 100).toFixed(2)} USD of markup. It is part of the price you pay, not an
                        extra charge on top.
                    </p>
                </section>
            )}

            <section className='twi-card'>
                <h3 className='twi-card__title'>Common questions</h3>
                {FAQ.map((f, i) => (
                    <div className='twi-faq' key={f.q}>
                        <button
                            type='button'
                            className='twi-faq__q'
                            aria-expanded={open === i}
                            onClick={() => setOpen(open === i ? null : i)}
                        >
                            <span>{f.q}</span>
                            <span aria-hidden='true'>{open === i ? '−' : '+'}</span>
                        </button>
                        {open === i && <p className='twi-faq__a'>{f.a}</p>}
                    </div>
                ))}
            </section>

            <footer className='twi-foot'>
                <span>
                    For information only. Trading can lose you your whole stake. Only trade money you can afford to
                    lose.
                </span>
            </footer>
        </div>
    );
};

export default Transparency;
