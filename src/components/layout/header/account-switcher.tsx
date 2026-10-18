import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { addComma, getCurrencyDisplayCode, getDecimalPlaces } from '@/components/shared';
import Text from '@/components/shared_ui/text';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import { isDemoAccount } from '@/utils/account-helpers';
import UsFlagIcon from './us-flag-icon';
import { Localize, localize } from '@deriv-com/translations';
import { TAccountSwitcher } from './common/types';
import AccountInfoWrapper from './account-info-wrapper';
import './account-switcher.scss';

const AccountSwitcher = observer(({ activeAccount }: TAccountSwitcher) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isReloading, setIsReloading] = useState(false);
    const [reloadError, setReloadError] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const { accountList, activeLoginid } = useApiBase();
    const { client, run_panel } = useStore() ?? {};

    const is_bot_running = run_panel?.is_running || api_base.is_running;
    const isSingleAccount = !accountList || accountList.length <= 1;

    const handleReloadDemoBalance = useCallback(
        async (e: React.MouseEvent) => {
            e.stopPropagation(); // don't also trigger the dropdown toggle
            if (isReloading) return;
            if (!api_base.api) {
                setReloadError(localize('Not connected. Please try again in a moment.'));
                return;
            }
            setIsReloading(true);
            setReloadError('');
            try {
                // TApiBaseApi's declared 'send' return type is void (a pre-existing
                // gap - the actual runtime call is a Promise, same class of issue as
                // the 'balance' method elsewhere in this codebase). Narrow-casting
                // locally rather than widening the shared type, since doing that
                // for 'balance' previously cascaded into unrelated errors.
                const sendApi = api_base.api as unknown as {
                    send: (data: unknown) => Promise<{
                        topup_virtual?: { amount?: number };
                        error?: { message?: string };
                    }>;
                };
                const response = await sendApi.send({ topup_virtual: 1 });
                if (response?.error) {
                    throw new Error(response.error.message || localize('Could not reload demo balance.'));
                }

                // Don't just wait passively on the balance push subscription to
                // reflect the top-up - actively refetch right away so the
                // displayed number updates immediately instead of depending on
                // a push message that may be delayed or (per earlier findings
                // in this app) not fire reliably.
                const balanceApi = api_base.api as unknown as {
                    balance: () => Promise<{
                        balance?: { balance?: number; currency?: string };
                        error?: unknown;
                    }>;
                };
                const balance_res = await balanceApi.balance();
                if (!balance_res?.error && balance_res?.balance && typeof balance_res.balance.balance === 'number') {
                    client?.setBalance(balance_res.balance.balance.toString());
                    if (balance_res.balance.currency) {
                        client?.setCurrency(balance_res.balance.currency);
                    }
                }
            } catch (err) {
                setReloadError(err instanceof Error ? err.message : localize('Could not reload demo balance.'));
                setTimeout(() => setReloadError(''), 4000);
            } finally {
                setIsReloading(false);
            }
        },
        [isReloading]
    );

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const toggleDropdown = useCallback(() => {
        if (is_bot_running || isSingleAccount) return;
        setIsOpen(prev => !prev);
    }, [is_bot_running, isSingleAccount]);

    const handleAccountSelect = useCallback(
        (loginid: string) => {
            localStorage.setItem('active_loginid', loginid);
            client?.checkAndRegenerateWebSocket();
            setIsOpen(false);
        },
        [client]
    );

    const formattedAccounts = useMemo(() => {
        if (!accountList) return [];
        return accountList
            .map(account => ({
                loginid: account.loginid,
                currency: account.currency,
                balance: addComma(Number(account.balance ?? 0).toFixed(getDecimalPlaces(account.currency))),
                isVirtual: isDemoAccount(account.loginid),
                isActive: account.loginid === activeLoginid,
            }))
            .sort((a, b) => (a.isActive ? -1 : b.isActive ? 1 : 0));
    }, [accountList, activeLoginid]);

    if (!activeAccount) return null;

    const { currency, isVirtual, balance } = activeAccount;
    const showChevron = !isSingleAccount && !is_bot_running;

    return (
        <div className='acc-info__wrapper' ref={wrapperRef}>
            <AccountInfoWrapper>
                <div
                    data-testid='dt_acc_info'
                    id='dt_core_account-info_acc-info'
                    role={showChevron ? 'button' : undefined}
                    tabIndex={showChevron ? 0 : -1}
                    aria-expanded={showChevron ? isOpen : undefined}
                    aria-haspopup={showChevron ? 'listbox' : undefined}
                    className={classNames('acc-info', {
                        'acc-info--is-virtual': isVirtual,
                        'acc-info--interactive': showChevron,
                    })}
                    onClick={toggleDropdown}
                    onKeyDown={e => {
                        if (showChevron && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            toggleDropdown();
                        }
                    }}
                >
                    <span className='acc-info__id' aria-hidden='true'></span>
                    <div className='acc-info__content'>
                        <div className='acc-info__account-type-header'>
                            <UsFlagIcon size={16} className='acc-info__flag' />
                            <Text as='p' size='xs' className='acc-info__account-type'>
                                {isVirtual ? (
                                    <Localize i18n_default_text='Demo account' />
                                ) : (
                                    <Localize i18n_default_text='Real account' />
                                )}
                            </Text>
                            {showChevron && (
                                <span
                                    className={classNames('acc-info__select-arrow', {
                                        'acc-info__select-arrow--invert': isOpen,
                                    })}
                                >
                                    <svg width='12' height='12' viewBox='0 0 12 12' fill='none'>
                                        <path
                                            d='M2 4L6 8L10 4'
                                            stroke='currentColor'
                                            strokeWidth='1.5'
                                            strokeLinecap='round'
                                            strokeLinejoin='round'
                                        />
                                    </svg>
                                </span>
                            )}
                        </div>
                        {(typeof balance !== 'undefined' || !currency) && (
                            <div className='acc-info__balance-section'>
                                <p
                                    data-testid='dt_balance'
                                    className={classNames('acc-info__balance', {
                                        'acc-info__balance--no-currency': !currency && !isVirtual,
                                    })}
                                >
                                    {!currency ? (
                                        <Localize i18n_default_text='No currency assigned' />
                                    ) : (
                                        `${balance} ${getCurrencyDisplayCode(currency)}`
                                    )}
                                </p>
                                {isVirtual && currency && (
                                    <button
                                        type='button'
                                        className={classNames('acc-info__reload-balance', {
                                            'acc-info__reload-balance--spinning': isReloading,
                                        })}
                                        title={localize('Reload demo balance to 10,000')}
                                        aria-label={localize('Reload demo balance')}
                                        disabled={isReloading}
                                        onClick={handleReloadDemoBalance}
                                    >
                                        <svg width='14' height='14' viewBox='0 0 16 16' fill='none'>
                                            <path
                                                d='M13.5 8a5.5 5.5 0 1 1-1.6-3.89M13.5 2v3.5H10'
                                                stroke='currentColor'
                                                strokeWidth='1.4'
                                                strokeLinecap='round'
                                                strokeLinejoin='round'
                                            />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        )}
                        {reloadError && <p className='acc-info__reload-error'>{reloadError}</p>}
                    </div>
                </div>
            </AccountInfoWrapper>
            {isOpen && (
                <div className='acc-dropdown' role='listbox'>
                    {formattedAccounts.map(account => (
                        <div
                            key={account.loginid}
                            role='option'
                            aria-selected={account.isActive}
                            tabIndex={0}
                            className={classNames('acc-dropdown__account', {
                                'acc-dropdown__account--selected': account.isActive,
                                'acc-dropdown__account--virtual': account.isVirtual,
                            })}
                            onClick={() => !account.isActive && handleAccountSelect(account.loginid)}
                            onKeyDown={e => {
                                if (!account.isActive && (e.key === 'Enter' || e.key === ' ')) {
                                    e.preventDefault();
                                    handleAccountSelect(account.loginid);
                                }
                            }}
                        >
                            <Text
                                size='xxxs'
                                className={classNames('acc-dropdown__account-type', {
                                    'acc-dropdown__account-type--virtual': account.isVirtual,
                                })}
                            >
                                {account.isVirtual ? (
                                    <Localize i18n_default_text='Demo account' />
                                ) : (
                                    <Localize i18n_default_text='Real account' />
                                )}
                            </Text>
                            <Text size='xs' weight='bold' className='acc-dropdown__balance'>
                                <UsFlagIcon size={14} className='acc-dropdown__flag' />
                                {account.currency ? (
                                    `${account.balance} ${getCurrencyDisplayCode(account.currency)}`
                                ) : (
                                    <Localize i18n_default_text='No currency assigned' />
                                )}
                            </Text>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

export default AccountSwitcher;
