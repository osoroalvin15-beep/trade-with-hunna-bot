import {
    classifyEvenOdd,
    classifyMatchDiffer,
    classifyOverUnder,
    classifyRiseFall,
    currentStreak,
    digitPercents,
    sharePercent,
} from '../analysis-utils';

describe('analysis-utils', () => {
    it('treats a digit equal to the barrier as a tie, not Under', () => {
        expect(classifyOverUnder([4, 5, 6], 5)).toEqual(['U', '=', 'O']);
    });

    it('splits even and odd digits', () => {
        expect(classifyEvenOdd([0, 1, 2, 7, 8])).toEqual(['E', 'O', 'E', 'O', 'E']);
    });

    it('marks matches against the chosen digit', () => {
        expect(classifyMatchDiffer([3, 5, 5, 1], 5)).toEqual(['D', 'M', 'M', 'D']);
    });

    it('derives rise/fall from consecutive prices and skips unchanged ticks', () => {
        expect(classifyRiseFall([10, 11, 11, 10.5, 12])).toEqual(['R', 'F', 'R']);
    });

    it('counts the current streak at the end of the list', () => {
        expect(currentStreak(['O', 'U', 'U', 'U'])).toEqual({ letter: 'U', length: 3 });
        expect(currentStreak([])).toEqual({ letter: null, length: 0 });
    });

    it('computes shares and digit percentages', () => {
        expect(sharePercent(['O', 'O', 'U', '='], 'O')).toBe(50);
        expect(sharePercent([], 'O')).toBe(0);
        const pct = digitPercents([1, 1, 2, 3]);
        expect(pct[1]).toBe(50);
        expect(pct.reduce((a, b) => a + b, 0)).toBeCloseTo(100);
    });
});
