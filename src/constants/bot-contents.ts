type TTabsTitle = {
    [key: string]: string | number;
};

type TDashboardTabIndex = {
    [key: string]: number;
};

export const tabs_title: TTabsTitle = Object.freeze({
    WORKSPACE: 'Workspace',
    CHART: 'Chart',
});

export const DBOT_TABS: TDashboardTabIndex = Object.freeze({
    DASHBOARD: 0,
    BOT_BUILDER: 1,
    CHART: 2,
    FREE_BOTS: 3,
    DIGIT_TOOLS: 4,
    PERFORMANCE: 5,
    RISK_TOOLS: 6,
    TRANSPARENCY: 7,
    PLANS: 8,
    COPY_TRADING: 9,
    TUTORIAL: 10,
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = [
    'id-dbot-dashboard',
    'id-bot-builder',
    'id-charts',
    'id-free-bots',
    'id-d-circles',
    'id-performance',
    'id-risk-tools',
    'id-transparency',
    'id-plans',
    'id-copy-trading',
    'id-tutorials',
];

export const DEBOUNCE_INTERVAL_TIME = 500;
