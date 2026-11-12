import { useState } from 'react';
import { requestPlan } from '@/services/billing';
import { BILLING_DAYS, PAYMENT, PLANS, planName, TPlan } from './plans-config';
import { usePlan } from './use-plan';
import './insights.scss';

const kes = (n: number) => `KSh ${n.toLocaleString('en-KE')}`;

const Plans = () => {
    const { realPlan, expires, pending, billingReady, isAuthorized, loginid, reload } = usePlan();
    const [chosen, setChosen] = useState<Exclude<TPlan, 'free'> | null>(null);
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [sent, setSent] = useState(false);

    const plan = PLANS.find(p => p.id === chosen);
    const paymentReady = Boolean(PAYMENT.number);
    const canRequest = billingReady && isAuthorized && paymentReady;

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!chosen || !loginid) return;
        setBusy(true);
        setError('');
        try {
            await requestPlan(loginid, chosen, phone, code);
            setSent(true);
            reload();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not send your request.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className='twi'>
            <header className='twi__head'>
                <div>
                    <h2 className='twi__title'>Plans</h2>
                    <p className='twi-muted'>
                        Start free. Pay only if you want deeper reports. Plans last {BILLING_DAYS} days and do not renew
                        by themselves.
                    </p>
                </div>
                {billingReady && isAuthorized && (
                    <span className='twi-badge'>
                        You are on {planName(realPlan)}
                        {realPlan !== 'free' && expires ? `, until ${new Date(expires).toLocaleDateString()}` : ''}
                    </span>
                )}
            </header>

            {!billingReady && (
                <p className='twi-note'>Paid plans open soon. Until then, every feature is free to use.</p>
            )}
            {billingReady && !isAuthorized && (
                <p className='twi-note'>Log in with your Deriv account to choose a plan.</p>
            )}
            {billingReady && isAuthorized && !paymentReady && (
                <p className='twi-note'>Payments open soon. You can see what each plan includes below.</p>
            )}
            {pending && (
                <p className='twi-note'>
                    We received your payment request and are checking it. Your plan turns on once we confirm the
                    payment.
                </p>
            )}

            <div className='twi-plans'>
                {PLANS.map(p => {
                    const current = billingReady && isAuthorized && realPlan === p.id;
                    return (
                        <section
                            key={p.id}
                            className={`twi-plan ${p.id === 'professional' ? 'is-featured' : ''} ${current ? 'is-current' : ''}`}
                        >
                            <h3 className='twi-plan__name'>{p.name}</h3>
                            <p className='twi-plan__price'>
                                {p.price === 0 ? 'Free' : kes(p.price)}
                                {p.price > 0 && <span> / {BILLING_DAYS} days</span>}
                            </p>
                            <p className='twi-muted'>{p.tagline}</p>
                            <ul className='twi-list'>
                                {p.features.map(f => (
                                    <li key={f}>{f}</li>
                                ))}
                            </ul>
                            {p.id === 'free' ? (
                                <span className='twi-plan__note'>
                                    {current || !billingReady ? 'Your plan' : 'Always available'}
                                </span>
                            ) : (
                                <button
                                    type='button'
                                    className='twi-btn'
                                    onClick={() => {
                                        setChosen(p.id as Exclude<TPlan, 'free'>);
                                        setSent(false);
                                        setError('');
                                    }}
                                >
                                    {current ? 'Extend' : 'Choose'} {p.name}
                                </button>
                            )}
                        </section>
                    );
                })}
            </div>

            {chosen && plan && (
                <section className='twi-card' aria-live='polite'>
                    <h3 className='twi-card__title'>
                        {plan.name} plan, {kes(plan.price)} for {BILLING_DAYS} days
                    </h3>
                    {!paymentReady ? (
                        <p className='twi-note'>Payments open soon. Please check back shortly.</p>
                    ) : sent ? (
                        <p className='twi-note'>
                            Request received. Your plan turns on after we confirm your payment. Use Refresh on this tab
                            to check.{' '}
                            <button type='button' className='twi-link' onClick={reload}>
                                Refresh
                            </button>
                        </p>
                    ) : (
                        <form onSubmit={submit}>
                            <ol className='twi-steps'>
                                <li>
                                    {PAYMENT.method === 'Send Money' ? (
                                        <>
                                            Open M-Pesa, choose <b>Send Money</b> and send <b>{kes(plan.price)}</b> to{' '}
                                            <b>{PAYMENT.number}</b>
                                            {PAYMENT.name ? ` (${PAYMENT.name})` : ''}.
                                        </>
                                    ) : (
                                        <>
                                            Pay <b>{kes(plan.price)}</b> by M-Pesa to {PAYMENT.method} number{' '}
                                            <b>{PAYMENT.number}</b>
                                            {PAYMENT.name ? ` (${PAYMENT.name})` : ''}. Use {PAYMENT.accountHint} as the
                                            reference.
                                        </>
                                    )}
                                </li>
                                {canRequest && (
                                    <li>
                                        Type the phone number you paid from and the confirmation code from the M-Pesa
                                        message.
                                    </li>
                                )}
                                <li>We check the payment and turn your plan on.</li>
                            </ol>
                            {canRequest ? (
                                <div className='twi-row2'>
                                    <label className='twi-field'>
                                        <span>Phone number you paid from</span>
                                        <span className='twi-field__box'>
                                            <input
                                                required
                                                inputMode='tel'
                                                value={phone}
                                                onChange={e => setPhone(e.target.value)}
                                                placeholder='0712 345 678'
                                            />
                                        </span>
                                    </label>
                                    <label className='twi-field'>
                                        <span>M-Pesa confirmation code</span>
                                        <span className='twi-field__box'>
                                            <input
                                                required
                                                value={code}
                                                onChange={e => setCode(e.target.value.toUpperCase())}
                                                placeholder='QWE1RTY2UI'
                                                maxLength={12}
                                            />
                                        </span>
                                    </label>
                                </div>
                            ) : (
                                <p className='twi-note'>
                                    {billingReady
                                        ? 'Log in with your Deriv account to send your payment details so we can turn your plan on.'
                                        : 'Keep your M-Pesa confirmation message as proof of payment.'}
                                </p>
                            )}
                            {error && <p className='twi-error'>{error}</p>}
                            {canRequest && (
                                <button className='twi-btn' disabled={busy} style={{ marginTop: 12 }}>
                                    {busy ? 'Sending…' : 'Send my payment details'}
                                </button>
                            )}
                        </form>
                    )}
                </section>
            )}

            <footer className='twi-foot'>
                <span>
                    To run a plan we keep your Deriv account ID, the phone number you paid from and the M-Pesa code.
                    Nothing else about your trading is stored. Plans are for reports and learning. They are not
                    financial advice.
                </span>
            </footer>
        </div>
    );
};

export default Plans;
