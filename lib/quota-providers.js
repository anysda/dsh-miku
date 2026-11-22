/** @typedef {{ kind: "balance", amount: number, currency: string, available: boolean, toppedUp: number | null, granted: number | null }} BalanceView */
/** @typedef {{ key: string, label: string, leftPct: number, resetMs: number }} QuotaWindow */
/** @typedef {{ kind: "usage", windows: QuotaWindow[] }} UsageView */

const KIMI_WINDOWS = [
	["limit_5h", "5h"],
	["limit_month_total", "Month"],
];

function amountOf(value) {
	const amount = Number.parseFloat(value);
	return Number.isFinite(amount) ? amount : null;
}

/** @returns {BalanceView} */
export function parseDeepSeekBalance(report) {
	const info = report?.balance_infos?.find((item) => amountOf(item?.total_balance) !== null);
	if (!info) throw new Error("DeepSeek reported no balance");
	return {
		kind: "balance",
		amount: amountOf(info.total_balance),
		currency: info.currency || "CNY",
		available: report.is_available !== false,
		toppedUp: amountOf(info.topped_up_balance),
		granted: amountOf(info.granted_balance),
	};
}

/** @returns {UsageView} */
export function parseKimiUsage(report) {
	const windows = KIMI_WINDOWS.filter(([key]) => typeof report?.usages?.[key]?.used_ratio === "number").map(([key, label]) => ({
		key,
		label,
		leftPct: Math.min(100, Math.max(0, Math.round((1 - report.usages[key].used_ratio) * 100))),
		resetMs: Date.parse(report.usages[key].reset_time),
	}));
	if (windows.length === 0) throw new Error("Kimi reported neither a 5-hour nor a monthly window");
	return { kind: "usage", windows };
}

export const PROVIDERS = [
	{
		id: "deepseek",
		label: "DeepSeek",
		credential: "DEEPSEEK_API_KEY",
		url: "https://api.deepseek.com/user/balance",
		parse: parseDeepSeekBalance,
	},
	{
		id: "kimi",
		label: "Kimi",
		credential: "KIMI_CODING_API_KEY",
		url: "https://api.kimi.com/coding/v1/usages",
		parse: parseKimiUsage,
	},
];
