/**
 * OWNER: what the Transparency Centre tells your users. Keep it true.
 *
 * markupPercent:
 *   - a number (for example 1) = the markup percentage set on your Deriv app registration. It is shown to users.
 *   - 0 = you add no markup. The page says so.
 *   - null = not published yet. The page then makes no claim about markup beyond the live prices.
 * Check your Deriv app settings and set this to match them before you publish.
 */
export const TRANSPARENCY: { markupPercent: number | null; extraRevenueNotes: string[] } = {
    markupPercent: null,
    extraRevenueNotes: [],
};
