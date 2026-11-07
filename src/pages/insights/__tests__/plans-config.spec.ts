import { canUse, planName, PLANS, requiredPlan } from '../plans-config';

describe('plans', () => {
    it('lists the four plans with the agreed prices', () => {
        expect(PLANS.map(p => [p.id, p.price])).toEqual([
            ['free', 0],
            ['starter', 299],
            ['professional', 699],
            ['advanced', 1499],
        ]);
    });

    it('unlocks features from the plan that needs them upwards', () => {
        expect(canUse('free', 'range_30d')).toBe(false);
        expect(canUse('starter', 'range_30d')).toBe(true);
        expect(canUse('starter', 'csv')).toBe(false);
        expect(canUse('professional', 'csv')).toBe(true);
        expect(canUse('professional', 'range_2000')).toBe(false);
        expect(canUse('advanced', 'range_2000')).toBe(true);
        expect(canUse('advanced', 'hour_table')).toBe(true);
    });

    it('knows which plan a feature needs and each plan name', () => {
        expect(requiredPlan('hour_table')).toBe('professional');
        expect(planName('starter')).toBe('Starter');
    });
});
