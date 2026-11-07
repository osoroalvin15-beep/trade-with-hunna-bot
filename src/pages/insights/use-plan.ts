import { useCallback, useEffect, useState } from 'react';
import { useApiBase } from '@/hooks/useApiBase';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import { billingReady, getPlan } from '@/services/billing';
import { TPlan } from './plans-config';

/**
 * The signed-in user's plan. Until billing is set up (no BILLING_* settings), everything is open,
 * so the app keeps working while you prepare the payment details.
 */
export const usePlan = () => {
    const { isAuthorized, accountList, activeLoginid } = useApiBase();
    const [plan, setPlan] = useState<TPlan>('free');
    const [expires, setExpires] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [loading, setLoading] = useState(false);

    const ids = (accountList || []).map((a: { loginid?: string }) => a.loginid).filter(Boolean) as string[];
    const key = ids.join(',');

    const load = useCallback(async () => {
        if (!billingReady || !isAuthorized || !ids.length) return;
        setLoading(true);
        try {
            const r = await getPlan(ids);
            setPlan(r.plan);
            setExpires(r.expires_at);
            setPending(r.pending);
        } catch {
            setPlan('free');
        } finally {
            setLoading(false);
        }
    }, [isAuthorized, key]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        load();
    }, [load]);

    return {
        plan: billingReady ? plan : ('advanced' as TPlan),
        realPlan: plan,
        expires,
        pending,
        loading,
        reload: load,
        billingReady,
        isAuthorized,
        loginid: activeLoginid as string | undefined,
    };
};

export const useGoToPlans = () => {
    const { dashboard } = useStore();
    return () => dashboard.setActiveTab(DBOT_TABS.PLANS);
};
