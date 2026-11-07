import type { TPlan } from '@/pages/insights/plans-config';

// Set BILLING_SUPABASE_URL and BILLING_SUPABASE_ANON_KEY on your host. Without them the paid-plan
// features stay switched off and every feature is open.
const URL = process.env.BILLING_SUPABASE_URL;
const KEY = process.env.BILLING_SUPABASE_ANON_KEY;

export const billingReady = Boolean(URL && KEY);

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${URL}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: String(KEY), Authorization: `Bearer ${KEY}` },
        body: JSON.stringify(args),
    });
    if (!res.ok) {
        let message = 'Something went wrong. Please try again.';
        try {
            message = (await res.json()).message || message;
        } catch {
            /* keep the default message */
        }
        throw new Error(message);
    }
    return res.json();
}

export type TPlanInfo = { plan: TPlan; expires_at: string | null; pending: boolean };

/** The best active plan among all the user's Deriv account IDs (real and demo). */
export const getPlan = (loginids: string[]) => rpc<TPlanInfo>('get_plan', { lids: loginids.slice(0, 20) });

export const requestPlan = (loginid: string, plan: Exclude<TPlan, 'free'>, phone: string, code: string) =>
    rpc<string>('request_plan', { lid: loginid, plan_id: plan, phone, code });
