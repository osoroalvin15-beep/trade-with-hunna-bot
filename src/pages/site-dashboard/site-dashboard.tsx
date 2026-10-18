import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BACKEND_URL, Bot, SiteSettings } from './backend-config';
import './site-dashboard.scss';

const DTRADER_URL = 'https://trade-with-hunna-dtrader.onrender.com/';
const MANUAL_TRADER_URL = 'https://trade-with-hunna-frontend.onrender.com/manual-trader.html';

const SiteDashboard = () => {
    const [bots, setBots] = useState<Bot[] | null>(null);
    const [botsError, setBotsError] = useState(false);
    const [settings, setSettings] = useState<SiteSettings | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetch(`${BACKEND_URL}/api/settings`)
            .then(res => res.json())
            .then(data => {
                if (!data || data.error || !rootRef.current) return;
                setSettings(data);
                const el = rootRef.current.style;
                if (data.color_bg) el.setProperty('--twh-bg', data.color_bg);
                if (data.color_accent) el.setProperty('--twh-accent', data.color_accent);
                if (data.color_primary) el.setProperty('--twh-primary', data.color_primary);
            })
            .catch(() => undefined);

        fetch(`${BACKEND_URL}/api/bots`)
            .then(res => res.json())
            .then(data => setBots(Array.isArray(data) ? data : []))
            .catch(() => setBotsError(true));
    }, []);

    return (
        <div className='twh-dashboard' ref={rootRef}>
            <div className='twh-dashboard__topbar'>
                <div className='twh-dashboard__brand'>
                    {settings?.logo_url ? (
                        <img src={settings.logo_url} alt='Logo' className='twh-dashboard__logo-img' />
                    ) : (
                        <span className='twh-dashboard__glyph'>⚡</span>
                    )}
                    <span>EA TRADERS</span>
                </div>
            </div>

            <main className='twh-dashboard__main'>
                <h1>Welcome back, trader 👋</h1>
                <p className='twh-dashboard__quote'>&ldquo;The trend is your friend &mdash; until it ends.&rdquo;</p>

                <div className='twh-dashboard__label'>Quick Actions</div>
                <div className='twh-dashboard__cards'>
                    <a className='twh-card twh-card--orange' href={MANUAL_TRADER_URL}>
                        <div className='twh-card__icon'>📈</div>
                        <h3>Manual Trader</h3>
                        <p>Place trades directly on your account.</p>
                        <span className='twh-card__open'>Open →</span>
                    </a>
                    <Link className='twh-card twh-card--green' to='/'>
                        <div className='twh-card__icon'>🤖</div>
                        <h3>Bot Builder</h3>
                        <p>Build an automated trading strategy.</p>
                        <span className='twh-card__open'>Open →</span>
                    </Link>
                    <a className='twh-card twh-card--purple' href={DTRADER_URL}>
                        <div className='twh-card__icon'>📊</div>
                        <h3>Charts</h3>
                        <p>Live price charts for your markets.</p>
                        <span className='twh-card__open'>Open →</span>
                    </a>
                </div>

                <div className='twh-dashboard__label'>Your Bots</div>
                <div className='twh-dashboard__cards'>
                    {!bots && !botsError && <div className='twh-dashboard__status'>Loading bots…</div>}
                    {botsError && <div className='twh-dashboard__status'>Couldn&apos;t load bots right now.</div>}
                    {bots && bots.length === 0 && (
                        <div className='twh-dashboard__status'>No bots available yet. Check back soon.</div>
                    )}
                    {bots?.map(bot => (
                        <div className='twh-bot-card' key={bot.id}>
                            {bot.image_url ? (
                                <img src={bot.image_url} alt={bot.name} className='twh-bot-card__pic' />
                            ) : (
                                <div className='twh-bot-card__pic-fallback'>🤖</div>
                            )}
                            <h3>{bot.name}</h3>
                            <p>{bot.description}</p>
                        </div>
                    ))}
                </div>
            </main>

            <footer className='twh-dashboard__footer'>
                EA TRADERS &middot; Powered by the Deriv API &middot; <Link to='/admin'>Admin</Link>
            </footer>
        </div>
    );
};

export default SiteDashboard;
