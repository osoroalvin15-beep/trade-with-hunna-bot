/**
 * Pure helpers for the Analysis Tool. Kept free of React so they are easy to test.
 * "Outcome" arrays are oldest-first, newest-last.
 */

export type TStreak = { letter: string | null; length: number };

/** Percentage of each digit 0-9 in the sample. */
export const digitPercents = (digits: number[]): number[] => {
    const counts = new Array(10).fill(0);
    digits.forEach(d => {
        if (d >= 0 && d <= 9) counts[d] += 1;
    });
    const total = digits.length || 1;
    return counts.map(c => (c / total) * 100);
};

/**
 * Over/Under against a barrier, using Deriv's rules: Over wins when the digit is
 * strictly greater than the barrier, Under when strictly smaller. A digit equal to
 * the barrier is a tie ('=') and counts for neither side.
 */
export const classifyOverUnder = (digits: number[], barrier: number): string[] =>
    digits.map(d => (d > barrier ? 'O' : d < barrier ? 'U' : '='));

export const classifyEvenOdd = (digits: number[]): string[] => digits.map(d => (d % 2 === 0 ? 'E' : 'O'));

export const classifyMatchDiffer = (digits: number[], target: number): string[] =>
    digits.map(d => (d === target ? 'M' : 'D'));

/** Rise/Fall from consecutive prices. Unchanged prices produce no outcome. */
export const classifyRiseFall = (prices: number[]): string[] => {
    const out: string[] = [];
    for (let i = 1; i < prices.length; i += 1) {
        if (prices[i] > prices[i - 1]) out.push('R');
        else if (prices[i] < prices[i - 1]) out.push('F');
    }
    return out;
};

/** Share of `letter` among all outcomes, as a percentage (0 when there are none). */
export const sharePercent = (outcomes: string[], letter: string): number =>
    outcomes.length ? (outcomes.filter(o => o === letter).length / outcomes.length) * 100 : 0;

/** How many identical outcomes in a row end the list. */
export const currentStreak = (outcomes: string[]): TStreak => {
    if (!outcomes.length) return { letter: null, length: 0 };
    const letter = outcomes[outcomes.length - 1];
    let length = 0;
    for (let i = outcomes.length - 1; i >= 0 && outcomes[i] === letter; i -= 1) length += 1;
    return { letter, length };
};
