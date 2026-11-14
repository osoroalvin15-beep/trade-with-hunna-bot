import { TAnalysisSnapshot } from './analysis-snapshot';

const pct = (n: number) => `${n.toFixed(1)}%`;

const lead = (a: number, b: number, nameA: string, nameB: string): string => {
    const gap = Math.abs(a - b);
    if (gap < 2) return `${nameA} and ${nameB} are almost level.`;
    return `${a > b ? nameA : nameB} is ahead by ${gap.toFixed(1)} points.`;
};

/** Plain-language reading of the Analysis Tool numbers. Describes the past only. */
export const readAnalysis = (s: TAnalysisSnapshot): string[] => {
    const order = s.percents.map((_, d) => d).sort((a, b) => s.percents[b] - s.percents[a] || a - b);
    const most = order[0];
    const least = order[order.length - 1];

    const lines = [
        `${s.label}: the last ${s.samples} ticks.`,
        `Digit ${most} showed up most (${pct(s.percents[most])}) and digit ${least} least (${pct(s.percents[least])}). ` +
            'If every digit were equally common, each would be near 10%.',
        `Even digits ${pct(s.evenPct)}, odd digits ${pct(s.oddPct)}. ${lead(s.evenPct, s.oddPct, 'Even', 'Odd')}`,
    ];
    if (s.risePct + s.fallPct > 0) {
        lines.push(
            `Price rose on ${pct(s.risePct)} of ticks and fell on ${pct(s.fallPct)}. ${lead(s.risePct, s.fallPct, 'Rise', 'Fall')}`
        );
    }
    if (s.latestDigit !== null) lines.push(`The latest digit was ${s.latestDigit}.`);
    lines.push(
        'These are counts of ticks that already happened. They describe the past, not what comes next, and are not financial advice.'
    );
    return lines;
};

/** One short paragraph the chat assistant can use as background. */
export const analysisContext = (s: TAnalysisSnapshot | null): string =>
    s ? readAnalysis(s).slice(0, -1).join(' ') : '';
