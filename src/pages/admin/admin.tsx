import { useCallback, useEffect, useState } from 'react';
import { BACKEND_URL, Bot, UserSession } from '../site-dashboard/backend-config';
import './admin.scss';

async function fileToDataUrl(file: File): Promise<string> {
    // file.arrayBuffer() is a plain promise-based read - more resilient than
    // FileReader's event callbacks, which can silently fail under memory/
    // resource pressure (e.g. many open tabs, low battery throttling).
    try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const CHUNK_SIZE = 0x8000; // process in 32KB chunks to avoid call-stack limits
        for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
            binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
        }
        const base64 = btoa(binary);
        return `data:${file.type || 'application/octet-stream'};base64,${base64}`;
    } catch {
        throw new Error(`Could not read "${file.name}" from your device. Try closing other tabs or freeing up memory, then retry.`);
    }
}

function toErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    try {
        return `${fallback} (${JSON.stringify(err)})`;
    } catch {
        return fallback;
    }
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB - matches the backend's limit
const MAX_BOT_FILE_BYTES = 5 * 1024 * 1024; // 5MB - matches the backend's limit

async function uploadImage(file: File, bucket: 'bot-images' | 'branding'): Promise<string> {
    if (file.size > MAX_IMAGE_BYTES) {
        throw new Error(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max size is 8MB.`);
    }
    const dataUrl = await fileToDataUrl(file);
    const res = await fetch(`${BACKEND_URL}/api/admin/upload-image`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, bucket, fileName: file.name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Image upload failed.');
    return data.url;
}

async function uploadBotFile(file: File): Promise<string> {
    if (file.size > MAX_BOT_FILE_BYTES) {
        throw new Error(`File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max size is 5MB.`);
    }
    const dataUrl = await fileToDataUrl(file);
    const res = await fetch(`${BACKEND_URL}/api/admin/upload-bot-file`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, fileName: file.name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Bot file upload failed.');
    return data.url;
}

const emptyBotForm = {
    id: '',
    name: '',
    description: '',
    image_url: '',
    bot_file_url: '',
    bot_file_name: '',
    is_active: true,
};

const AdminPage = () => {
    const [checking, setChecking] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    const [colorBg, setColorBg] = useState('#0a1529');
    const [colorAccent, setColorAccent] = useState('#ff5a5a');
    const [colorPrimary, setColorPrimary] = useState('#ff6b4a');
    const [logoUrl, setLogoUrl] = useState('');
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState('');
    const [brandingMsg, setBrandingMsg] = useState('');
    const [savingBranding, setSavingBranding] = useState(false);

    const [bots, setBots] = useState<Bot[]>([]);
    const [formOpen, setFormOpen] = useState(false);
    const [botForm, setBotForm] = useState(emptyBotForm);
    const [botStrategyFile, setBotStrategyFile] = useState<File | null>(null);
    const [botFormError, setBotFormError] = useState('');
    const [savingBot, setSavingBot] = useState(false);

    const [sessions, setSessions] = useState<UserSession[]>([]);

    const checkAdmin = useCallback(async () => {
        const res = await fetch(`${BACKEND_URL}/api/admin/check`, { credentials: 'include' });
        const data = await res.json();
        return !!data.isAdmin;
    }, []);

    const loadBranding = useCallback(async () => {
        const res = await fetch(`${BACKEND_URL}/api/settings`);
        const settings = await res.json();
        if (settings.error) return;
        setColorBg(settings.color_bg || '#0a1529');
        setColorAccent(settings.color_accent || '#ff5a5a');
        setColorPrimary(settings.color_primary || '#ff6b4a');
        setLogoUrl(settings.logo_url || '');
    }, []);

    const loadBots = useCallback(async () => {
        const res = await fetch(`${BACKEND_URL}/api/admin/bots`, { credentials: 'include' });
        const data = await res.json();
        setBots(Array.isArray(data) ? data : []);
    }, []);

    const loadSessions = useCallback(async () => {
        const res = await fetch(`${BACKEND_URL}/api/admin/sessions`, { credentials: 'include' });
        const data = await res.json();
        setSessions(Array.isArray(data) ? data : []);
    }, []);

    const refreshAppState = useCallback(async () => {
        const admin = await checkAdmin();
        setIsAdmin(admin);
        if (admin) {
            loadBranding();
            loadBots();
            loadSessions();
        }
    }, [checkAdmin, loadBranding, loadBots, loadSessions]);

    useEffect(() => {
        refreshAppState().finally(() => setChecking(false));
    }, [refreshAppState]);

    const handleLogin = async () => {
        setLoginError('');
        try {
            const res = await fetch(`${BACKEND_URL}/api/admin/login`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            if (!res.ok) {
                setLoginError('Wrong password.');
                return;
            }
            await refreshAppState();
        } catch {
            setLoginError('Could not reach the server.');
        }
    };

    const handleSignOut = async () => {
        await fetch(`${BACKEND_URL}/api/admin/logout`, { method: 'POST', credentials: 'include' });
        await refreshAppState();
    };

    const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
    };

    const handleSaveBranding = async () => {
        setSavingBranding(true);
        setBrandingMsg('');
        try {
            let newLogoUrl = logoUrl;
            if (logoFile) {
                newLogoUrl = await uploadImage(logoFile, 'branding');
            }
            const res = await fetch(`${BACKEND_URL}/api/admin/settings`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    color_bg: colorBg,
                    color_accent: colorAccent,
                    color_primary: colorPrimary,
                    logo_url: newLogoUrl,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || data.error || 'Could not save branding.');
            }
            setLogoUrl(newLogoUrl);
            setLogoFile(null);
            setBrandingMsg('Saved.');
            setTimeout(() => setBrandingMsg(''), 2500);
        } catch (err) {
            console.error('[save branding] failed:', err);
            alert(toErrorMessage(err, 'Could not save branding.'));
        } finally {
            setSavingBranding(false);
        }
    };

    const openAddBot = () => {
        setBotForm(emptyBotForm);
        setBotStrategyFile(null);
        setBotFormError('');
        setFormOpen(true);
    };

    const openEditBot = (bot: Bot) => {
        setBotForm({
            id: bot.id,
            name: bot.name,
            description: bot.description || '',
            image_url: bot.image_url || '',
            bot_file_url: bot.bot_file_url || '',
            bot_file_name: bot.bot_file_name || '',
            is_active: bot.is_active,
        });
        setBotStrategyFile(null);
        setBotFormError('');
        setFormOpen(true);
    };

    const handleBotStrategyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setBotStrategyFile(file);
        setBotForm(f => ({ ...f, bot_file_name: file.name }));
    };

    const handleSaveBot = async () => {
        const name = botForm.name.trim();
        if (!name) {
            setBotFormError('Bot name is required.');
            return;
        }
        setSavingBot(true);
        setBotFormError('');
        try {
            const imageUrl = botForm.image_url;
            let botFileUrl = botForm.bot_file_url;
            let botFileName = botForm.bot_file_name;
            if (botStrategyFile) {
                botFileUrl = await uploadBotFile(botStrategyFile);
                botFileName = botStrategyFile.name;
            }
            const payload = {
                name,
                description: botForm.description.trim(),
                image_url: imageUrl,
                bot_file_url: botFileUrl,
                bot_file_name: botFileName,
                is_active: botForm.is_active,
            };
            const url = botForm.id
                ? `${BACKEND_URL}/api/admin/bots/${botForm.id}`
                : `${BACKEND_URL}/api/admin/bots`;
            const method = botForm.id ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || data.error || 'Could not save bot.');
            }
            setFormOpen(false);
            await loadBots();
        } catch (err) {
            console.error('[save bot] failed:', err);
            setBotFormError(toErrorMessage(err, 'Could not save bot.'));
        } finally {
            setSavingBot(false);
        }
    };

    const handleDeleteBot = async (id: string) => {
        if (!window.confirm('Delete this bot? This cannot be undone.')) return;
        await fetch(`${BACKEND_URL}/api/admin/bots/${id}`, { method: 'DELETE', credentials: 'include' });
        await loadBots();
    };

    if (checking) {
        return <div className='twh-admin twh-admin--checking'>Checking session…</div>;
    }

    if (!isAdmin) {
        return (
            <div className='twh-admin'>
                <div className='twh-admin__login'>
                    <h1>Admin login</h1>
                    <p>Enter the admin password to continue.</p>
                    <input
                        type='password'
                        placeholder='Admin password'
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleLogin()}
                        autoFocus
                    />
                    <button className='twh-btn' style={{ width: '100%' }} onClick={handleLogin}>
                        Log in
                    </button>
                    <div className='twh-admin__error'>{loginError}</div>
                </div>
            </div>
        );
    }

    return (
        <div className='twh-admin'>
            <div className='twh-admin__topbar'>
                <span className='twh-admin__brand'>EA TRADERS — Admin</span>
                <a className='twh-admin__signout' onClick={handleSignOut}>
                    Sign out
                </a>
            </div>

            <main className='twh-admin__main'>
                <section>
                    <h2>Site branding</h2>
                    <p className='twh-admin__hint'>Logo and color scheme shown across the site.</p>

                    <label>Logo</label>
                    <input type='file' accept='image/*' onChange={handleLogoFileChange} />
                    {(logoPreview || logoUrl) && (
                        <img className='twh-admin__logo-preview' src={logoPreview || logoUrl} alt='' />
                    )}

                    <div className='twh-admin__color-row'>
                        <div>
                            <label>Background</label>
                            <input type='color' value={colorBg} onChange={e => setColorBg(e.target.value)} />
                        </div>
                        <div>
                            <label>Accent</label>
                            <input type='color' value={colorAccent} onChange={e => setColorAccent(e.target.value)} />
                        </div>
                        <div>
                            <label>Primary</label>
                            <input
                                type='color'
                                value={colorPrimary}
                                onChange={e => setColorPrimary(e.target.value)}
                            />
                        </div>
                    </div>

                    <button className='twh-btn' disabled={savingBranding} onClick={handleSaveBranding}>
                        Save branding
                    </button>
                    <div className='twh-admin__ok'>{brandingMsg}</div>
                </section>

                <section>
                    <h2>Bots</h2>
                    <p className='twh-admin__hint'>Add, edit, or remove bots shown on the dashboard.</p>

                    <button className='twh-btn' onClick={openAddBot}>
                        + Add bot
                    </button>

                    {formOpen && (
                        <div className='twh-admin__bot-form'>
                            <label>Name</label>
                            <input
                                type='text'
                                placeholder='e.g. Momentum Rider'
                                value={botForm.name}
                                onChange={e => setBotForm(f => ({ ...f, name: e.target.value }))}
                            />
                            <label>Description</label>
                            <textarea
                                placeholder='Short description shown under the bot name'
                                value={botForm.description}
                                onChange={e => setBotForm(f => ({ ...f, description: e.target.value }))}
                            />
                            <label>Bot file (.xml strategy exported from Bot Builder)</label>
                            <input type='file' accept='.xml,text/xml' onChange={handleBotStrategyFileChange} />
                            {botForm.bot_file_name && (
                                <p className='twh-admin__hint'>📄 {botForm.bot_file_name}</p>
                            )}
                            {!botForm.bot_file_name && (
                                <p className='twh-admin__hint'>
                                    Without a bot file, this bot won&apos;t be openable from Free Bots.
                                </p>
                            )}
                            <label className='twh-admin__checkbox-label'>
                                <input
                                    type='checkbox'
                                    checked={botForm.is_active}
                                    onChange={e => setBotForm(f => ({ ...f, is_active: e.target.checked }))}
                                />{' '}
                                Visible on dashboard
                            </label>
                            <div className='twh-admin__form-actions'>
                                <button className='twh-btn' disabled={savingBot} onClick={handleSaveBot}>
                                    Save bot
                                </button>
                                <button className='twh-btn twh-btn--secondary' onClick={() => setFormOpen(false)}>
                                    Cancel
                                </button>
                            </div>
                            <div className='twh-admin__error'>{botFormError}</div>
                        </div>
                    )}

                    <div className='twh-admin__bots-list'>
                        {bots.length === 0 && (
                            <p className='twh-admin__hint'>No bots yet. Click &quot;Add bot&quot; to create one.</p>
                        )}
                        {bots.map(bot => (
                            <div className={`twh-admin__bot-row ${bot.is_active ? '' : 'twh-admin__bot-row--inactive'}`} key={bot.id}>
                                {bot.image_url ? (
                                    <img src={bot.image_url} alt='' />
                                ) : (
                                    <div className='twh-admin__bot-row-ph'>🤖</div>
                                )}
                                <div className='twh-admin__bot-row-info'>
                                    <h4>{bot.name}</h4>
                                    <p>{bot.description}</p>
                                    <p className='twh-admin__hint'>
                                        {bot.bot_file_name
                                            ? `📄 ${bot.bot_file_name}`
                                            : '⚠ No bot file attached'}
                                    </p>
                                </div>
                                <div className='twh-admin__bot-row-actions'>
                                    <button onClick={() => openEditBot(bot)}>Edit</button>
                                    <button className='twh-admin__danger' onClick={() => handleDeleteBot(bot.id)}>
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section>
                    <h2>Active Sessions</h2>
                    <p className='twh-admin__hint'>
                        One row per user (their most recent login). Active = used the site in the last 2 minutes.
                        Idle = logged in but quiet longer than that. Ended = logged out.
                    </p>
                    <div className='twh-admin__sessions-list'>
                        {sessions.length === 0 && <p className='twh-admin__hint'>No sessions recorded yet.</p>}
                        {sessions.length > 0 && (
                            <table className='twh-admin__sessions-table'>
                                <thead>
                                    <tr>
                                        <th>Login ID</th>
                                        <th>Status</th>
                                        <th>Started</th>
                                        <th>Last seen</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sessions.map(s => {
                                        const status = s.status || (s.ended_at ? 'ended' : 'idle');
                                        return (
                                            <tr key={s.login_id}>
                                                <td>{s.login_id}</td>
                                                <td>
                                                    <span className={`twh-admin__session-badge is-${status}`}>
                                                        {status === 'active'
                                                            ? 'Active'
                                                            : status === 'ended'
                                                              ? 'Ended'
                                                              : 'Idle'}
                                                    </span>
                                                </td>
                                                <td>{new Date(s.started_at).toLocaleString()}</td>
                                                <td>{new Date(s.last_seen_at).toLocaleString()}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <button className='twh-btn twh-btn--secondary' onClick={loadSessions}>
                        Refresh
                    </button>
                </section>
            </main>
        </div>
    );
};

export default AdminPage;
