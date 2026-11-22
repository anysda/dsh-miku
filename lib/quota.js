import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { PROVIDERS } from "./quota-providers.js";

const ROUTE = "/miku-quota/api";
const UPSTREAM_TIMEOUT_MS = 10_000;
const CACHE_MS = 5_000;
const DSH_HOME = process.env.DSH_HOME?.trim() || join(homedir(), ".dsh");
const cache = new Map();

function unquoteYaml(value) {
	if (/^".*"$/.test(value)) {
		try {
			return JSON.parse(value);
		} catch {
			return value.slice(1, -1);
		}
	}
	if (/^'.*'$/.test(value)) return value.slice(1, -1).replaceAll("''", "'");
	return value.replace(/\s+#.*$/, "").trim();
}

function credentialInFile(ref) {
	let lines;
	try {
		lines = readFileSync(join(DSH_HOME, ".credentials.yaml"), "utf8").split(/\r?\n/);
	} catch {
		return undefined;
	}
	const refsLine = lines.findIndex((line) => /^refs:\s*(?:#.*)?$/.test(line));
	if (refsLine === -1) return undefined;
	for (const line of lines.slice(refsLine + 1)) {
		if (/^\S/.test(line)) break;
		const [, name, value] = line.match(/^\s+([A-Za-z_][A-Za-z0-9_-]*):\s*(.*?)\s*$/) ?? [];
		if (name === ref) return unquoteYaml(value) || undefined;
	}
	return undefined;
}

async function resolveApiKey(ctx, ref) {
	let resolved;
	try {
		resolved = await ctx.get("credentials")?.resolve(ref);
	} catch {
		// the other sources may still provide the key
	}
	return resolved?.value || process.env[ref] || credentialInFile(ref);
}

async function fetchView(provider, key) {
	const cached = cache.get(provider.id);
	if (cached && Date.now() - cached.atMs < CACHE_MS) return { view: cached.view };
	try {
		const response = await fetch(provider.url, {
			headers: { authorization: `Bearer ${key}`, accept: "application/json" },
			signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
		});
		if (!response.ok) throw new Error(response.status === 401 ? "the key was rejected" : `HTTP ${response.status}`);
		const view = provider.parse(await response.json());
		cache.set(provider.id, { atMs: Date.now(), view });
		return { view };
	} catch (err) {
		if (!cached) throw err;
		console.warn(`[miku] ${provider.label}: ${err.message}; serving the cached quota view`);
		return { view: cached.view, stale: true };
	}
}

async function quotaRow(ctx, provider) {
	const row = { id: provider.id, label: provider.label };
	const key = await resolveApiKey(ctx, provider.credential);
	if (!key) return { ...row, error: `${provider.credential} is not in the credentials service, the environment or the credentials file` };
	try {
		return { ...row, ...(await fetchView(provider, key)) };
	} catch (err) {
		return { ...row, error: err.message };
	}
}

async function answer(ctx, req) {
	const address = req.socket.remoteAddress ?? "";
	const loopback = address === "::1" || address.startsWith("127.") || address.startsWith("::ffff:127.");
	if (!loopback) return [403, { error: "forbidden" }];
	if (req.method !== "GET") return [405, { error: "method not allowed" }];
	return [200, { rows: await Promise.all(PROVIDERS.map((provider) => quotaRow(ctx, provider))) }];
}

export function registerQuota(ctx) {
	const handler = async (req, res) => {
		const [status, body] = await answer(ctx, req);
		res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
		res.end(JSON.stringify(body));
	};
	return ctx.webServer.register({ kind: "prefix", path: ROUTE, handler });
}
