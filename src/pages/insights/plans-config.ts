/**
 * Plans, prices and what each plan unlocks. Change prices and the payment details here.
 * Prices are in Kenya shillings per 30 days.
 */
export type TPlan = 'free' | 'starter' | 'professional' | 'advanced';
export type TFeature = 'range_30d' | 'range_500' | 'daily_chart' | 'breakdowns' | 'hour_table' | 'csv' | 'range_2000';

export const PLAN_ORDER: TPlan[] = ['free', 'starter', 'professional', 'advanced'];
export const BILLING_DAYS = 30;

export const PLANS: { id: TPlan; name: string; price: number; tagline: string; features: string[] }[] = [
    {
        id: 'free',
        name: 'Free',
        price: 0,
        tagline: 'Everything you need to start',
        features: [
            'Analysis Tool',
            'All Risk Tools, including the daily loss tracker',
            'Transparency Centre',
            'Performance summary for today and the last 7 days',
        ],
    },
    {
        id: 'starter',
        name: 'Starter',
        price: 299,
        tagline: 'See your results in depth',
        features: [
            'Everything in Free',
            'Performance for 30 days and your latest 500 trades',
            'Result-by-day chart',
            'Results by market and by trade type',
            'Strategic market analysis',
            'Latest bots',
        ],
    },
    {
        id: 'professional',
        name: 'Professional',
        price: 699,
        tagline: 'Find when and where you trade best',
        features: [
            'Everything in Starter',
            'Get signals early',
            'Results by time of day',
            'Download your trades as a CSV file',
        ],
    },
    {
        id: 'advanced',
        name: 'Advanced',
        price: 1499,
        tagline: 'The full history, plus VIP extras',
        features: [
            'Everything in Professional',
            'Priority support and first access to new bots and tools',
            'Performance for your latest 2,000 trades',
        ],
    },
];

const REQUIRED: Record<TFeature, TPlan> = {
    range_30d: 'starter',
    range_500: 'starter',
    daily_chart: 'starter',
    breakdowns: 'starter',
    hour_table: 'professional',
    csv: 'professional',
    range_2000: 'advanced',
};

export const requiredPlan = (feature: TFeature): TPlan => REQUIRED[feature];
export const planName = (plan: TPlan): string => PLANS.find(p => p.id === plan)?.name || plan;
export const canUse = (plan: TPlan, feature: TFeature): boolean =>
    PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(REQUIRED[feature]);

/**
 * OWNER: where customers pay. Currently M-Pesa Send Money to a phone number; switch `method` to 'Till' or
 * 'Paybill' (and put that number here) if you open one. Until `number` is set, the Plans page shows "Payments open soon" and nobody can send a request.
 */
export const PAYMENT: {
    method: 'Till' | 'Paybill' | 'Send Money';
    number: string;
    name: string;
    accountHint: string;
} = {
    method: 'Send Money',
    number: '0768559607',
    name: '',
    accountHint: 'your Deriv account ID',
};
