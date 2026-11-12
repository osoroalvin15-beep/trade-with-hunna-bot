import { useCallback, useEffect, useState } from 'react';
import './scroll-buttons.scss';

const SCROLLER = '.main__container .dc-tabs__content';
const MIN_OVERFLOW = 80; // px of extra content before the buttons appear

type TProps = {
    /** Lift the buttons (e.g. above the mobile Run Bot bar). */
    raised?: boolean;
};

/**
 * Floating "scroll up / scroll down" buttons for the active tab. They only appear on pages that
 * are taller than the screen, and each one hides when there is nowhere left to scroll.
 */
const ScrollButtons = ({ raised = false }: TProps) => {
    const [state, setState] = useState({ show: false, atTop: true, atBottom: false });

    const measure = useCallback(() => {
        const el = document.querySelector<HTMLElement>(SCROLLER);
        if (!el) {
            setState(s => (s.show ? { show: false, atTop: true, atBottom: false } : s));
            return;
        }
        const overflow = el.scrollHeight - el.clientHeight;
        const next = {
            show: overflow > MIN_OVERFLOW,
            atTop: el.scrollTop <= 8,
            atBottom: el.scrollTop >= overflow - 8,
        };
        setState(s => (s.show === next.show && s.atTop === next.atTop && s.atBottom === next.atBottom ? s : next));
    }, []);

    useEffect(() => {
        measure();
        // `scroll` does not bubble, so listen in the capture phase to catch the tab's own scrolling.
        document.addEventListener('scroll', measure, true);
        window.addEventListener('resize', measure);
        // Pages load and change size after the first paint, so re-check now and then.
        const timer = window.setInterval(measure, 700);
        return () => {
            document.removeEventListener('scroll', measure, true);
            window.removeEventListener('resize', measure);
            window.clearInterval(timer);
        };
    }, [measure]);

    const scrollTo = (to: 'top' | 'bottom') => {
        const el = document.querySelector<HTMLElement>(SCROLLER);
        if (!el) return;
        el.scrollTo({ top: to === 'top' ? 0 : el.scrollHeight, behavior: 'smooth' });
    };

    if (!state.show) return null;

    return (
        <div className={`scroll-buttons${raised ? ' scroll-buttons--raised' : ''}`}>
            {!state.atTop && (
                <button
                    type='button'
                    className='scroll-buttons__btn'
                    aria-label='Scroll to top'
                    title='Scroll to top'
                    onClick={() => scrollTo('top')}
                >
                    ↑
                </button>
            )}
            {!state.atBottom && (
                <button
                    type='button'
                    className='scroll-buttons__btn'
                    aria-label='Scroll to bottom'
                    title='Scroll to bottom'
                    onClick={() => scrollTo('bottom')}
                >
                    ↓
                </button>
            )}
        </div>
    );
};

export default ScrollButtons;
