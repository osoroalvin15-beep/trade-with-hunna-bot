import { ReactNode, useMemo, useState } from 'react';
import {
    breakevenWinRate,
    dailyLimit,
    expectedValue,
    exposure,
    martingaleTable,
    rewardToRisk,
    stakeFromRisk,
    summarize,
} from './insights-utils';
import { useProfitTable } from './use-profit-table';
import './insights.scss';

const num = (v: string) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0);
const f2 = (n: number) => n.toFixed(2);

const Field = ({
    label,
    value,
    onChange,
    step = '0.01',
    suffix,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    step?: string;
    suffix?: string;
}) => (
    <label className='twi-field'>
        <span>{label}</span>
        <span className='twi-field__box'>
            <input
                type='number'
                inputMode='decimal'
                min='0'
                step={step}
                value={value}
                onChange={e => onChange(e.target.value)}
            />
            {suffix && <em>{suffix}</em>}
        </span>
    </label>
);

const Card = ({ title, intro, children }: { title: string; intro: string; children: ReactNode }) => (
    <section className='twi-card'>
        <h3 className='twi-card__title'>{title}</h3>
        <p className='twi-muted'>{intro}</p>
        {children}
    </section>
);

const Result = ({ label, value, kind = '' }: { label: string; value: string; kind?: string }) => (
    <div className='twi-result'>
        <span>{label}</span>
        <b className={kind}>{value}</b>
    </div>
);

const RiskTools = () => {
    const { balance, currency, trades: todayTrades, isAuthorized } = useProfitTable('today');
    const history = useProfitTable('30d');

    const [bal, setBal] = useState<string>('');
    const balanceNow = bal !== '' ? num(bal) : balance || 100;

    // 1. stake size
    const [riskPct, setRiskPct] = useState('1');
    // 2. daily loss limit
    const [limitPct, setLimitPct] = useState('5');
    // 3. exposure
    const [expStake, setExpStake] = useState('1');
    const [expTrades, setExpTrades] = useState('3');
    // 4. martingale
    const [mgBase, setMgBase] = useState('1');
    const [mgMult, setMgMult] = useState('2');
    const [mgSteps, setMgSteps] = useState('6');
    // 5. break-even
    const [beStake, setBeStake] = useState('1');
    const [bePayout, setBePayout] = useState('1.95');
    const [beRate, setBeRate] = useState('');

    const today = useMemo(() => summarize(todayTrades), [todayTrades]);
    const myRate = useMemo(() => summarize(history.trades), [history.trades]);

    const limit = dailyLimit(balanceNow, num(limitPct));
    const lossToday = Math.max(0, -today.net);
    const used = limit > 0 ? Math.min(100, (lossToday / limit) * 100) : 0;

    const totalExp = exposure(num(expStake), num(expTrades));
    const expPct = balanceNow > 0 ? (totalExp / balanceNow) * 100 : 0;

    const steps = Math.min(12, Math.max(1, Math.round(num(mgSteps))));
    const table = martingaleTable(num(mgBase), num(mgMult), steps);
    const firstUncovered = table.find(r => r.totalAtRisk > balanceNow);

    const be = breakevenWinRate(num(beStake), num(bePayout));
    const rate = beRate !== '' ? num(beRate) : myRate.trades >= 20 ? Math.round(myRate.winRate) : 55;
    const ev = expectedValue(num(beStake), num(bePayout), rate);

    return (
        <div className='twi'>
            <header className='twi__head'>
                <div>
                    <h2 className='twi__title'>Risk tools</h2>
                    <p className='twi-muted'>
                        Plan how much you can afford to lose before you trade. These tools use your numbers and do
                        nothing to your account.
                    </p>
                </div>
                <Field
                    label={`Your balance (${currency})`}
                    value={bal !== '' ? bal : balance ? f2(balance) : ''}
                    onChange={setBal}
                />
            </header>

            <div className='twi-two'>
                <Card
                    title='How much should I stake?'
                    intro='Risk only a small slice of your balance on each trade, so one bad trade cannot do much damage.'
                >
                    <Field label='Risk per trade' value={riskPct} onChange={setRiskPct} suffix='%' />
                    <Result
                        label='Suggested stake'
                        value={`${f2(stakeFromRisk(balanceNow, num(riskPct)))} ${currency}`}
                    />
                    <p className='twi-hint'>Many traders keep this at 1% or lower.</p>
                </Card>

                <Card
                    title='Daily loss limit'
                    intro='Decide in advance how much you will let yourself lose in one day, then stop when you reach it.'
                >
                    <Field label='Daily limit' value={limitPct} onChange={setLimitPct} suffix='% of balance' />
                    <Result label='Stop for the day if you lose' value={`${f2(limit)} ${currency}`} />
                    <div
                        className='twi-meter'
                        role='img'
                        aria-label={`${used.toFixed(0)} percent of the daily limit used`}
                    >
                        <div
                            className={`twi-meter__fill ${used >= 100 ? 'down' : used >= 70 ? 'warn' : 'up'}`}
                            style={{ width: `${used}%` }}
                        />
                    </div>
                    <p className={`twi-hint ${used >= 100 ? 'down' : ''}`}>
                        {isAuthorized
                            ? used >= 100
                                ? `Limit reached. You are down ${f2(lossToday)} ${currency} today. Stopping for the day protects your balance.`
                                : `Today so far: ${today.net >= 0 ? '+' : '-'}${f2(Math.abs(today.net))} ${currency}. Used ${used.toFixed(0)}% of your limit.`
                            : 'Log in to track today against your limit.'}
                    </p>
                </Card>

                <Card
                    title='How much is at risk right now?'
                    intro='If you run several trades or bots at once, their stakes add up.'
                >
                    <div className='twi-row2'>
                        <Field label='Stake per trade' value={expStake} onChange={setExpStake} />
                        <Field label='Trades at once' value={expTrades} onChange={setExpTrades} step='1' />
                    </div>
                    <Result
                        label='Total at risk'
                        value={`${f2(totalExp)} ${currency}`}
                        kind={expPct > 10 ? 'down' : expPct > 5 ? 'warn' : 'up'}
                    />
                    <p className='twi-hint'>
                        That is {expPct.toFixed(1)}% of your balance.{' '}
                        {expPct > 10
                            ? 'This is high. Consider fewer trades or a smaller stake.'
                            : expPct > 5
                              ? 'Getting high. Watch it closely.'
                              : 'A comfortable level.'}
                    </p>
                </Card>

                <Card
                    title='Win rate you need'
                    intro='Every trade pays a little less than double. This shows how often you must win just to break even.'
                >
                    <div className='twi-row2'>
                        <Field label='Stake' value={beStake} onChange={setBeStake} />
                        <Field label='Payout if you win (stake included)' value={bePayout} onChange={setBePayout} />
                    </div>
                    <Field
                        label={myRate.trades >= 20 ? 'Your win rate (from your last 30 days)' : 'Win rate you expect'}
                        value={beRate !== '' ? beRate : String(rate)}
                        onChange={setBeRate}
                        step='1'
                        suffix='%'
                    />
                    <Result label='You must win at least' value={`${be.toFixed(1)}% of trades`} />
                    <Result
                        label='Win pays for every 1 you risk'
                        value={rewardToRisk(num(beStake), num(bePayout)).toFixed(2)}
                    />
                    <Result
                        label='Average result per trade'
                        value={`${ev >= 0 ? '+' : '-'}${f2(Math.abs(ev))} ${currency}`}
                        kind={ev >= 0 ? 'up' : 'down'}
                    />
                </Card>
            </div>

            <Card
                title='Martingale check'
                intro='Raising your stake after each loss can wipe out an account fast. See what a losing run really costs before you use it.'
            >
                <div className='twi-row3'>
                    <Field label='Starting stake' value={mgBase} onChange={setMgBase} />
                    <Field label='Multiply after a loss by' value={mgMult} onChange={setMgMult} step='0.1' />
                    <Field label='Losses in a row (max 12)' value={mgSteps} onChange={setMgSteps} step='1' />
                </div>
                <div className='twi-table' role='table'>
                    <div className='twi-table__row twi-table__row--head three' role='row'>
                        <span>Losing trade</span>
                        <span>Stake on it</span>
                        <span>Total lost so far</span>
                    </div>
                    {table.map(r => (
                        <div
                            className={`twi-table__row three ${r.totalAtRisk > balanceNow ? 'bad' : ''}`}
                            role='row'
                            key={r.step}
                        >
                            <span>{r.step}</span>
                            <span>
                                {f2(r.stake)} {currency}
                            </span>
                            <span>
                                {f2(r.totalAtRisk)} {currency} (
                                {balanceNow > 0 ? ((r.totalAtRisk / balanceNow) * 100).toFixed(0) : 0}% of balance)
                            </span>
                        </div>
                    ))}
                </div>
                <p className={`twi-hint ${firstUncovered ? 'down' : ''}`}>
                    {firstUncovered
                        ? `Your balance would not cover losing trade number ${firstUncovered.step}. A run of ${firstUncovered.step} losses in a row would empty it.`
                        : 'Your balance covers every step shown. Remember that longer losing runs can still happen.'}
                </p>
            </Card>

            <footer className='twi-foot'>
                <span>
                    For learning and planning only. This is not financial advice, and trading can lose you your whole
                    stake. Only trade money you can afford to lose.
                </span>
            </footer>
        </div>
    );
};

export default RiskTools;
