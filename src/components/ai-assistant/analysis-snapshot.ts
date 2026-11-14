/**
 * A tiny shared store: the Analysis Tool publishes its latest numbers here, and the floating
 * assistant reads them to give a plain-language reading. No network, no React.
 */
export type TAnalysisSnapshot = {
    symbol: string;
    label: string;
    samples: number;
    /** Percentage of each last digit 0-9. */
    percents: number[];
    latestDigit: number | null;
    evenPct: number;
    oddPct: number;
    risePct: number;
    fallPct: number;
    updatedAt: number;
};

let current: TAnalysisSnapshot | null = null;
const listeners = new Set<() => void>();

export const publishAnalysis = (snapshot: TAnalysisSnapshot) => {
    current = snapshot;
    listeners.forEach(l => l());
};

export const getAnalysis = (): TAnalysisSnapshot | null => current;

export const subscribeAnalysis = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};
