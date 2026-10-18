import { useCallback, useEffect, useState } from 'react';
import { generateOAuthURL } from '@/components/shared';
import { BrandLogo } from '@/components/layout/app-logo/BrandLogo';
import ChunkLoader from '@/components/loader/chunk-loader';
import { localize } from '@deriv-com/translations';
import './landing.scss';

const HEADLINES = [
    'Consistency wins.',
    'Trade with better tools.',
    'Simplify your market analysis.',
    'Trade smarter, not harder.',
    'Welcome to EA TRADERS.',
    'Sharp minds.',
    'Built for every kind of trader.',
    'Built for winners.',
];

const TICKER_ITEMS: Array<[string, string, 'up' | 'down']> = [
    ['VOL 100 (1s)', '737.53', 'down'],
    ['BULL MARKET', '1033.93', 'up'],
    ['BEAR MARKET', '988.78', 'up'],
    ['VOL 10', '4895.44', 'up'],
    ['VOL 25', '2725.49', 'up'],
    ['VOL 50', '89.88', 'down'],
    ['VOL 75', '48967.28', 'up'],
    ['VOL 10 (1s)', '9745.20', 'up'],
];

const TESTIMONIALS = [
    {
        initials: 'SL',
        quote: 'Clean, fast, and I never have to leave the dashboard to check my balance.',
        name: 'Sophie L.',
        role: 'Options Trader',
    },
    {
        initials: 'RP',
        quote: 'Logging in with my Deriv account directly saved me from yet another signup form.',
        name: 'Raj P.',
        role: 'Quantitative Analyst',
    },
    {
        initials: 'EP',
        quote: "Exactly what I wanted — a simple, secure front end for my Deriv account.",
        name: 'Elena P.',
        role: 'Portfolio Manager',
    },
];

const LandingPage = () => {
    const [headline_index, setHeadlineIndex] = useState(0);
    const [is_visible, setIsVisible] = useState(true);
    const [is_authorizing, setIsAuthorizing] = useState(false);

    useEffect(() => {
        const cycle = setInterval(() => {
            setIsVisible(false);
            setTimeout(() => {
                setHeadlineIndex(prev => (prev + 1) % HEADLINES.length);
                setIsVisible(true);
            }, 600);
        }, 3200);
        return () => clearInterval(cycle);
    }, []);

    const handleStart = useCallback(async () => {
        try {
            setIsAuthorizing(true);
            const oauthUrl = await generateOAuthURL();
            if (oauthUrl) {
                window.location.replace(oauthUrl);
            } else {
                console.error('Failed to generate OAuth URL');
                setIsAuthorizing(false);
            }
        } catch (error) {
            console.error('Login redirection failed:', error);
            setIsAuthorizing(false);
        }
    }, []);

    if (is_authorizing) {
        return <ChunkLoader message={localize('Connecting to Deriv...')} />;
    }

    return (
        <div className='landing'>
            <div className='landing__topnav'>
                <div className='landing__brand'>
                    <BrandLogo height={30} showText />
                </div>
                <button className='landing__login-btn' onClick={handleStart}>
                    {localize('Login Now')} <span aria-hidden='true'>&rarr;</span>
                </button>
            </div>

            <div className='landing__ticker-bar'>
                <div className='landing__ticker-track'>
                    {[...TICKER_ITEMS, ...TICKER_ITEMS].map(([name, val, dir], idx) => (
                        <span className={`landing__ticker-item landing__ticker-item--${dir}`} key={`${name}-${idx}`}>
                            <b>{name}</b> {val} {dir === 'up' ? '▲' : '▼'}
                        </span>
                    ))}
                </div>
            </div>

            <div className='landing__hero'>
                <h1 className='landing__rotating-headline'>
                    <span className={is_visible ? 'is-visible' : ''}>{HEADLINES[headline_index]}</span>
                </h1>
                <button className='landing__cta' onClick={handleStart}>
                    {localize('Start Trading Now')} <span aria-hidden='true'>&rarr;</span>
                </button>
                <div className='landing__cta-notes'>
                    <span>✅ {localize('Uses your existing Deriv account')}</span>
                    <span>✅ {localize('No new password to remember')}</span>
                </div>

                <div className='landing__testimonials'>
                    {TESTIMONIALS.map(t => (
                        <div className='landing__t-card' key={t.name}>
                            <div className='landing__t-avatar'>{t.initials}</div>
                            <div className='landing__t-quote'>&ldquo;{t.quote}&rdquo;</div>
                            <div className='landing__t-name'>{t.name}</div>
                            <div className='landing__t-role'>{t.role}</div>
                            <div className='landing__t-stars'>★★★★★</div>
                        </div>
                    ))}
                </div>

                <div className='landing__disclaimer'>
                    {localize('Example testimonials and stats shown for design purposes — replace with real figures before launch.')}
                </div>

                <div className='landing__stats'>
                    <div>
                        <div className='landing__stat-circle'>Beta</div>
                        <div className='landing__stat-label'>{localize('Early Access')}</div>
                    </div>
                    <div>
                        <div className='landing__stat-circle'>100%</div>
                        <div className='landing__stat-label'>{localize('Deriv-Secured')}</div>
                    </div>
                    <div>
                        <div className='landing__stat-circle'>0</div>
                        <div className='landing__stat-label'>{localize('Extra Passwords')}</div>
                    </div>
                </div>
            </div>

            <footer className='landing__footer'>EA TRADERS &middot; {localize('Powered by the Deriv API')}</footer>
        </div>
    );
};

export default LandingPage;
