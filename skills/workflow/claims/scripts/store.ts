// Which agent session holds which issue, PR or files in this clone. Pure rules
// here; claims.ts does the file, git and gh I/O.
//
// A claim names its target (`issue:N`, `pr:N` or `path:<glob>`) and its owner,
// a session id. It lapses when its owner has not renewed it within the TTL,
// and claims.ts also drops claims on closed issues and PRs, so nobody cleans
// up by hand. Only an exact target is refused at claim time; files under
// another session's path glob are refused at push time (check-paths).

export interface Claim {
	target: string
	owner: string
	since: string
	renewed: string
	note?: string
}

export interface Store {
	version: 1
	claims: Claim[]
}

export interface IssueLike {
	number: number
	title: string
	body: string
}

export interface CommentLike {
	createdAt: string
	body: string
}

export const DEFAULT_TTL_MS = 24 * 3600 * 1000
export const DECISION_MARKER = '<!-- decision:v1 -->'

export const emptyStore = (): Store => ({version: 1, claims: []})

export function parseTarget(raw: string): string {
	const issue = /^(?:#|issue:)(\d+)$/.exec(raw)
	if (issue) return `issue:${issue[1]}`
	const pr = /^pr:(\d+)$/.exec(raw)
	if (pr) return `pr:${pr[1]}`
	if (raw.startsWith('path:') && raw.length > 'path:'.length) return raw
	throw new Error(`not a claim target: ${raw} (use #N, issue:N, pr:N or path:<glob>)`)
}

// A store file from an older or hand-edited state: keep only well-formed claims.
export function parseStore(value: unknown): Store {
	if (typeof value !== 'object' || value === null || !Array.isArray((value as {claims?: unknown}).claims)) return emptyStore()
	const claims = (value as {claims: unknown[]}).claims.filter((c): c is Claim => {
		if (typeof c !== 'object' || c === null) return false
		const r = c as Record<string, unknown>
		return typeof r.target === 'string' && typeof r.owner === 'string' && typeof r.since === 'string' && typeof r.renewed === 'string' && (r.note === undefined || typeof r.note === 'string')
	})
	return {version: 1, claims}
}

export const isLive = (c: Claim, now: Date, ttlMs: number): boolean => now.getTime() - Date.parse(c.renewed) < ttlMs

export function holder(store: Store, target: string, now: Date, ttlMs: number): Claim | null {
	return store.claims.find(c => c.target === target && isLive(c, now, ttlMs)) ?? null
}

// Claims each target for `owner`, renewing the ones it already holds. A target
// another session holds live is refused and left as it was.
export function claim(store: Store, targets: string[], owner: string, now: Date, opts: {note?: string; ttlMs?: number} = {}): {store: Store; refused: Claim[]} {
	const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS
	const stamp = now.toISOString()
	const claims = [...store.claims]
	const refused: Claim[] = []
	for (const target of targets) {
		const i = claims.findIndex(c => c.target === target)
		const current = i === -1 ? undefined : claims[i]
		if (current && current.owner !== owner && isLive(current, now, ttlMs)) {
			refused.push(current)
			continue
		}
		const mine = current?.owner === owner && isLive(current, now, ttlMs)
		const next: Claim = {target, owner, since: mine && current ? current.since : stamp, renewed: stamp, ...(opts.note !== undefined ? {note: opts.note} : mine && current?.note !== undefined ? {note: current.note} : {})}
		if (i === -1) claims.push(next)
		else claims[i] = next
	}
	return {store: {version: 1, claims}, refused}
}

// Drops `owner`'s claims on `targets` (all of them when null); `force` drops
// other sessions' claims on those targets too.
export function release(store: Store, targets: string[] | null, owner: string, force: boolean): Store {
	return {
		version: 1,
		claims: store.claims.filter(c => {
			const named = targets === null ? c.owner === owner : targets.includes(c.target)
			return !(named && (c.owner === owner || force))
		})
	}
}

export function prune(store: Store, now: Date, ttlMs: number, closed: ReadonlySet<string>): Store {
	return {version: 1, claims: store.claims.filter(c => isLive(c, now, ttlMs) && !closed.has(c.target))}
}

const globOf = (c: Claim): Bun.Glob | null => (c.target.startsWith('path:') ? new Bun.Glob(c.target.slice('path:'.length)) : null)

// Each file under a live path claim of another session, with that claim.
export function pathsHeldByOthers(store: Store, files: string[], owner: string, now: Date, ttlMs: number): {file: string; claim: Claim}[] {
	const others = store.claims.filter(c => c.owner !== owner && isLive(c, now, ttlMs)).flatMap(c => {
		const glob = globOf(c)
		return glob ? [{glob, claim: c}] : []
	})
	return files.flatMap(file => {
		const hit = others.find(o => o.glob.match(file))
		return hit ? [{file, claim: hit.claim}] : []
	})
}

// Issues an open PR says it fixes, closes or resolves. A bare #N mention is not a claim.
export function issuesNamedByPrs(prs: IssueLike[]): Set<number> {
	const named = new Set<number>()
	for (const pr of prs) {
		for (const m of `${pr.title}\n${pr.body}`.matchAll(/\b(?:fix(?:e[sd])?|close[sd]?|resolve[sd]?)\s+#(\d+)/gi)) named.add(Number(m[1]))
	}
	return named
}

// Backticked file references in an issue body (`path/to/file.ts:123`), without the line.
export function locations(body: string): string[] {
	return [...body.matchAll(/`([\w.@-]+(?:\/[\w.@-]+)+\.\w+)(?::\d+(?:-\d+)?)?`/g)].map(m => m[1] ?? '').filter(Boolean)
}

// Open issues free to start: nobody holds them, no open PR fixes them, and no
// other session holds a path the issue points at.
export function claimableIssues<T extends IssueLike>(issues: T[], prs: IssueLike[], store: Store, owner: string | null, now: Date, ttlMs: number): T[] {
	const fixed = issuesNamedByPrs(prs)
	return issues.filter(issue => {
		if (fixed.has(issue.number) || holder(store, `issue:${issue.number}`, now, ttlMs)) return false
		return pathsHeldByOthers(store, locations(issue.body), owner ?? '', now, ttlMs).length === 0
	})
}

// The newest comment carrying the decision marker, with marker lines removed.
export function latestDecision(comments: CommentLike[]): {createdAt: string; text: string} | null {
	const marked = comments.filter(c => c.body.includes(DECISION_MARKER)).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
	const last = marked.at(-1)
	if (!last) return null
	const text = last.body
		.split('\n')
		.filter(line => !line.includes(DECISION_MARKER) && !line.includes('<!-- agent:v1 -->') && line.trim() !== '> *Posted by an agent.*')
		.join('\n')
		.trim()
	return {createdAt: last.createdAt, text}
}
