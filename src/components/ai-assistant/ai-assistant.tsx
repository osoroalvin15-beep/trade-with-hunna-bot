import {
    PointerEvent as ReactPointerEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import { DBOT_TABS } from '@/constants/bot-contents';
import { getAnalysis, subscribeAnalysis } from './analysis-snapshot';
import { AI_CHAT_URL, askAssistant, TChatMessage } from './chat-api';
import { analysisContext, readAnalysis } from './read-analysis';
import './ai-assistant.scss';

const SIZE = 56; // button size in px
const MARGIN = 8; // keep this far from the screen edge
const DRAG_THRESHOLD = 6; // px of movement before a press counts as a drag
const STORAGE_KEY = 'twh-ai-button-pos';

type TPos = { x: number; y: number };
type TView = 'menu' | 'analysis' | 'chat';

const LINKS: Array<{ label: string; tab: number }> = [
    { label: 'Bot Builder', tab: DBOT_TABS.BOT_BUILDER },
    { label: 'Free Bots', tab: DBOT_TABS.FREE_BOTS },
    { label: 'Analysis Tool', tab: DBOT_TABS.DIGIT_TOOLS },
    { label: 'Risk Tools', tab: DBOT_TABS.RISK_TOOLS },
    { label: 'Plans', tab: DBOT_TABS.PLANS },
    { label: 'Tutorials', tab: DBOT_TABS.TUTORIAL },
];

const clamp = (pos: TPos): TPos => ({
    x: Math.min(Math.max(pos.x, MARGIN), Math.max(MARGIN, window.innerWidth - SIZE - MARGIN)),
    y: Math.min(Math.max(pos.y, MARGIN), Math.max(MARGIN, window.innerHeight - SIZE - MARGIN)),
});

const defaultPos = (): TPos => clamp({ x: window.innerWidth - SIZE - 16, y: window.innerHeight - SIZE - 160 });

const loadPos = (): TPos => {
    try {
        const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
        if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return clamp(saved);
    } catch {
        // Storage can be blocked (private window): fall back to the default spot.
    }
    return defaultPos();
};

type TProps = {
    /** Switch the dashboard to another tab. */
    onNavigate: (tab: number) => void;
};

const AiAssistant = ({ onNavigate }: TProps) => {
    const [pos, setPos] = useState<TPos>(loadPos);
    const [open, setOpen] = useState(false);
    const [view, setView] = useState<TView>('menu');
    const drag = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(
        null
    );

    const snapshot = useSyncExternalStore(subscribeAnalysis, getAnalysis, getAnalysis);

    const [messages, setMessages] = useState<TChatMessage[]>([]);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [chatError, setChatError] = useState('');
    const listRef = useRef<HTMLDivElement>(null);

    // Keep the button on screen when the window is resized or rotated.
    useEffect(() => {
        const onResize = () => setPos(p => clamp(p));
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    }, [messages, busy]);

    const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
        drag.current = { startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y, moved: false };
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        d.moved = true;
        setPos(clamp({ x: d.originX + dx, y: d.originY + dy }));
    };

    const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
        const d = drag.current;
        drag.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        if (!d) return;
        if (d.moved) {
            setPos(p => {
                try {
                    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
                } catch {
                    // Not saved: it simply starts in the default spot next time.
                }
                return p;
            });
        } else {
            setOpen(o => !o);
            setView('menu');
        }
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        // Keyboard users: Enter/Space opens (handled by click below); arrows nudge the button.
        const step = e.shiftKey ? 40 : 12;
        const moves: Record<string, TPos> = {
            ArrowLeft: { x: -step, y: 0 },
            ArrowRight: { x: step, y: 0 },
            ArrowUp: { x: 0, y: -step },
            ArrowDown: { x: 0, y: step },
        };
        const m = moves[e.key];
        if (m) {
            e.preventDefault();
            setPos(p => clamp({ x: p.x + m.x, y: p.y + m.y }));
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(o => !o);
            setView('menu');
        }
    };

    const go = useCallback(
        (tab: number) => {
            onNavigate(tab);
            setOpen(false);
        },
        [onNavigate]
    );

    const send = async () => {
        const text = draft.trim();
        if (!text || busy || !AI_CHAT_URL) return;
        const next: TChatMessage[] = [...messages, { role: 'user', content: text }];
        setMessages(next);
        setDraft('');
        setChatError('');
        setBusy(true);
        try {
            const reply = await askAssistant(next, analysisContext(snapshot));
            setMessages(m => [...m, { role: 'assistant', content: reply }]);
        } catch (err) {
            setChatError(err instanceof Error ? err.message : 'Something went wrong.');
        } finally {
            setBusy(false);
        }
    };

    // Open the panel on the side of the button that has the most room.
    const panelStyle: React.CSSProperties = {
        [pos.x > window.innerWidth / 2 ? 'right' : 'left']:
            pos.x > window.innerWidth / 2 ? Math.max(MARGIN, window.innerWidth - pos.x - SIZE) : pos.x,
        [pos.y > window.innerHeight / 2 ? 'bottom' : 'top']:
            pos.y > window.innerHeight / 2 ? window.innerHeight - pos.y + 8 : pos.y + SIZE + 8,
    };

    const age = snapshot ? Math.round((Date.now() - snapshot.updatedAt) / 1000) : 0;

    return (
        <>
            {open && (
                <div className='twh-ai-panel' style={panelStyle} role='dialog' aria-label='Hunna assistant'>
                    <div className='twh-ai-panel__head'>
                        {view !== 'menu' && (
                            <button type='button' className='twh-ai-panel__back' onClick={() => setView('menu')}>
                                ‹ Back
                            </button>
                        )}
                        <strong className='twh-ai-panel__title'>
                            {view === 'menu'
                                ? 'Hunna assistant'
                                : view === 'analysis'
                                  ? 'Analysis reading'
                                  : 'Ask the assistant'}
                        </strong>
                        <button
                            type='button'
                            className='twh-ai-panel__close'
                            aria-label='Close'
                            onClick={() => setOpen(false)}
                        >
                            ✕
                        </button>
                    </div>

                    {view === 'menu' && (
                        <div className='twh-ai-panel__body'>
                            <p className='twh-ai-panel__label'>Quick links</p>
                            <div className='twh-ai-links'>
                                {LINKS.map(l => (
                                    <button key={l.label} type='button' onClick={() => go(l.tab)}>
                                        {l.label}
                                    </button>
                                ))}
                            </div>
                            <p className='twh-ai-panel__label'>Tools</p>
                            <button type='button' className='twh-ai-row' onClick={() => setView('analysis')}>
                                <b>Read the Analysis Tool</b>
                                <span>A plain-language summary of the current digits</span>
                            </button>
                            <button type='button' className='twh-ai-row' onClick={() => setView('chat')}>
                                <b>Ask the assistant</b>
                                <span>Chat about the platform, bots and the numbers</span>
                            </button>
                            <p className='twh-ai-panel__hint'>Tip: press and drag the button to move it anywhere.</p>
                        </div>
                    )}

                    {view === 'analysis' && (
                        <div className='twh-ai-panel__body'>
                            {snapshot ? (
                                <>
                                    {readAnalysis(snapshot).map(line => (
                                        <p key={line} className='twh-ai-panel__text'>
                                            {line}
                                        </p>
                                    ))}
                                    {age > 60 && (
                                        <p className='twh-ai-panel__hint'>
                                            These numbers are from {Math.round(age / 60)} min ago, the last time the
                                            Analysis Tool was open.
                                        </p>
                                    )}
                                </>
                            ) : (
                                <p className='twh-ai-panel__text'>
                                    Open the Analysis Tool first, so there are numbers to read. Then come back here.
                                </p>
                            )}
                            <button type='button' className='twh-ai-primary' onClick={() => go(DBOT_TABS.DIGIT_TOOLS)}>
                                Go to Analysis Tool
                            </button>
                        </div>
                    )}

                    {view === 'chat' && (
                        <div className='twh-ai-chat'>
                            {!AI_CHAT_URL ? (
                                <p className='twh-ai-panel__text twh-ai-panel__body'>
                                    The chat is not switched on yet. The site owner needs to connect it to an AI service
                                    first. The quick links and the Analysis reading work without it.
                                </p>
                            ) : (
                                <>
                                    <div className='twh-ai-chat__list' ref={listRef}>
                                        {messages.length === 0 && (
                                            <p className='twh-ai-panel__hint'>
                                                Ask anything about the platform, bots or what the numbers mean. Answers
                                                are general information, not financial advice.
                                            </p>
                                        )}
                                        {messages.map((m, i) => (
                                            <div key={i} className={`twh-ai-msg twh-ai-msg--${m.role}`}>
                                                {m.content}
                                            </div>
                                        ))}
                                        {busy && <div className='twh-ai-msg twh-ai-msg--assistant'>Thinking…</div>}
                                        {chatError && <p className='twh-ai-error'>{chatError}</p>}
                                    </div>
                                    <form
                                        className='twh-ai-chat__form'
                                        onSubmit={e => {
                                            e.preventDefault();
                                            send();
                                        }}
                                    >
                                        <input
                                            value={draft}
                                            onChange={e => setDraft(e.target.value)}
                                            placeholder='Type your question'
                                            maxLength={500}
                                            aria-label='Your question'
                                        />
                                        <button type='submit' disabled={busy || !draft.trim()}>
                                            Send
                                        </button>
                                    </form>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            <button
                type='button'
                className={`twh-ai-fab${open ? ' is-open' : ''}`}
                style={{ left: pos.x, top: pos.y, width: SIZE, height: SIZE }}
                aria-label='Open Hunna assistant (drag to move)'
                aria-expanded={open}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => {
                    drag.current = null;
                }}
                onKeyDown={onKeyDown}
            >
                {open ? '✕' : 'AI'}
            </button>
        </>
    );
};

export default AiAssistant;
