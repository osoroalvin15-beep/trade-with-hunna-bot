import './dashboard-watermark.scss';

// Decorative only: static markup + CSS animation, no network calls.
const SYMBOLS = ['$', '€', '£', '₿', 'Au', '%', '¥', 'XAU', 'USD', 'V100', '▲', 'Ag'];

const DashboardWatermark = () => (
    <div className='dash-watermark' aria-hidden='true'>
        <span
            className='dash-watermark__candles'
            style={{ backgroundImage: "url('/assets/branding/loader-bg-candles.svg')" }}
        />
        <span
            className='dash-watermark__line'
            style={{ backgroundImage: "url('/assets/branding/loader-bg-line.svg')" }}
        />
        {SYMBOLS.map((symbol, i) => (
            <span key={symbol} className={`dash-watermark__symbol dash-watermark__symbol--${i + 1}`}>
                {symbol}
            </span>
        ))}
    </div>
);

export default DashboardWatermark;
