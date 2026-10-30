// Which agent session holds which issue, PR or files in this clone. Pure rules
// here; claims.ts does the file, git and gh I/O.
//
// A claim names its target (`issue:N`, `pr:N` or `path:<glob>`), its owner (a
// session id) and when it expires; claiming again renews it. claims.ts also
// drops claims on closed issues and PRs, and claims tied to one (`tiedTo`),
// so nobody cleans up by hand. Only an exact target is refused at claim time;
// files under another session's path glob are refused at push time
// (check-paths).

export interface Claim {
	target: string
	owner: string
	since: string
	expires: string
	note?: string
	// An issue or PR target; the claim drops when that closes.
	tiedTo?: string
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

export interface PrLike extends IssueLike {
	// True for a PR from a fork: an outsider's text, which only flags an issue.
	isCrossRepository: boolean
}

export interface CommentLike {
	createdAt: string
	body: string
	authorAssociation: string
}

export const DEFAULT_TTL_MS = 24 * 3600 * 1000
export const DECISION_MARKER = '<!-- decision:v1 -->'
// Who may record a decision: the maintainer's own account and collaborators.
const TRUSTED_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])

export const emptyStore = (): Store => ({version: 1, claims: []})

export function parseTarget(raw: string): string {
	const issue = /^(?:#|issue:)(\d+)$/.exec(raw)
	if (issue) return `issue:${issue[1]}`
	const pr = /^pr:(\d+)$/.exec(raw)
	if (pr) return `pr:${pr[1]}`
	if (raw.startsWith('path:') && raw.length > 'path:'.length) return raw
	throw new Error(`not a claim target: ${raw} (use #N, issue:N, pr:N or path:<glob>)`)
}

// Throws on anything that is not a version-1 store, so a damaged file is never
// read as empty and written back over everyone's claims.
export function parseStore(value: unknown): Store {
	if (typeof value !== 'object' || value === null) throw new Error('the claims store is not a JSON object')
	const record = value as Record<string, unknown>
	if (record.version !== 1) throw new Error(`the claims store has version ${JSON.stringify(record.version)}, not 1`)
	if (!Array.isArray(record.claims)) throw new Error('the claims store has no claims array')
	return {
		version: 1,
		claims: record.claims.map((c, i) => {
			const r = (typeof c === 'object' && c !== null ? c : {}) as Record<string, unknown>
			const optional = (key: string): boolean => r[key] === undefined || typeof r[key] === 'string'
			if (typeof r.target !== 'string' || typeof r.owner !== 'string' || typeof r.since !== 'string' || typeof r.expires !== 'string' || !optional('note') || !optional('tiedTo')) throw new Error(`claim ${i} in the claims store is malformed`)
			return c as Claim
		})
	}
}

export const isLive = (c: Claim, now: Date): boolean => Date.parse(c.expires) > now.getTime()

export function holder(store: Store, target: string, now: Date): Claim | null {
	return store.claims.find(c => c.target === target && isLive(c, now)) ?? null
}

// Claims each target for `owner`, renewing the ones it already holds. A target
// another session holds live is refused and left as it was.
export function claim(store: Store, targets: string[], owner: string, now: Date, opts: {note?: string; tiedTo?: string; ttlMs?: number} = {}): {store: Store; refused: Claim[]} {
	const expires = new Date(now.getTime() + (opts.ttlMs ?? DEFAULT_TTL_MS)).toISOString()
	const claims = [...store.claims]
	const refused: Claim[] = []
	for (const target of targets) {
		const i = claims.findIndex(c => c.target === target)
		const current = i === -1 ? undefined : claims[i]
		if (current && current.owner !== owner && isLive(current, now)) {
			refused.push(current)
			continue
		}
		const mine = current !== undefined && current.owner === owner && isLive(current, now)
		const note = opts.note ?? (mine ? current.note : undefined)
		const tiedTo = opts.tiedTo ?? (mine ? current.tiedTo : undefined)
		const next: Claim = {target, owner, since: mine ? current.since : now.toISOString(), expires, ...(note !== undefined ? {note} : {}), ...(tiedTo !== undefined ? {tiedTo} : {})}
		if (i === -1) claims.push(next)
		else claims[i] = next
	}
	return {store: {version: 1, claims}, refused}
}

// Drops `owner`'s claims on `targets` (all of them when null); `force` drops
// other sessions' claims on those targets too. `kept` lists the named targets
// another session still holds.
export function release(store: Store, targets: string[] | null, owner: string, force: boolean): {store: Store; released: string[]; kept: Claim[]} {
	const named = (c: Claim): boolean => (targets === null ? c.owner === owner : targets.includes(c.target))
	const drop = (c: Claim): boolean => named(c) && (c.owner === owner || force)
	return {
		store: {version: 1, claims: store.claims.filter(c => !drop(c))},
		released: store.claims.filter(drop).map(c => c.target),
		kept: store.claims.filter(c => named(c) && !drop(c))
	}
}

export function prune(store: Store, now: Date, closed: ReadonlySet<string>): Store {
	return {version: 1, claims: store.claims.filter(c => isLive(c, now) && !closed.has(c.target) && !(c.tiedTo !== undefined && closed.has(c.tiedTo)))}
}

const globOf = (c: Claim): Bun.Glob | null => (c.target.startsWith('path:') ? new Bun.Glob(c.target.slice('path:'.length)) : null)

// Each file under a live path claim of another session, with that claim.
export function pathsHeldByOthers(store: Store, files: string[], owner: string, now: Date): {file: string; claim: Claim}[] {
	const others = store.claims.filter(c => c.owner !== owner && isLive(c, now)).flatMap(c => {
		const glob = globOf(c)
		return glob ? [{glob, claim: c}] : []
	})
	return files.flatMap(file => {
		const hit = others.find(o => o.glob.match(file))
		return hit ? [{file, claim: hit.claim}] : []
	})
}

// Issues a PR's title or body says it fixes, closes or resolves. A bare #N mention is not one.
export function issuesNamedBy(pr: IssueLike): number[] {
	return [...`${pr.title}\n${pr.body}`.matchAll(/\b(?:fix(?:e[sd])?|close[sd]?|resolve[sd]?)\s+#(\d+)/gi)].map(m => Number(m[1]))
}

// Backticked file references in an issue body (`path/to/file.ts:123`), without the line.
export function locations(body: string): string[] {
	return [...body.matchAll(/`([\w.@-]+(?:\/[\w.@-]+)+\.\w+)(?::\d+(?:-\d+)?)?`/g)].map(m => m[1] ?? '').filter(Boolean)
}

// Open issues free to start: nobody holds them, no PR of ours fixes them, and
// no other session holds a path the issue points at. An outsider's PR doesn't
// take an issue away (whoever takes the issue finishes or absorbs that PR); it
// is returned beside the issue instead.
export function claimableIssues<T extends IssueLike>(issues: T[], prs: PrLike[], store: Store, owner: string | null, now: Date): {issue: T; outsidePrs: number[]}[] {
	const ours = new Set(prs.filter(pr => !pr.isCrossRepository).flatMap(issuesNamedBy))
	return issues
		.filter(issue => !ours.has(issue.number) && !holder(store, `issue:${issue.number}`, now) && pathsHeldByOthers(store, locations(issue.body), owner ?? '', now).length === 0)
		.map(issue => ({issue, outsidePrs: prs.filter(pr => pr.isCrossRepository && issuesNamedBy(pr).includes(issue.number)).map(pr => pr.number)}))
}

// The newest maintainer comment carrying the decision marker, with marker
// lines removed. A marker in anyone else's comment is ignored: on a public
// repo anyone can type it.
export function latestDecision(comments: CommentLike[]): {createdAt: string; text: string} | null {
	const marked = comments.filter(c => TRUSTED_ASSOCIATIONS.has(c.authorAssociation) && c.body.includes(DECISION_MARKER)).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
	const last = marked.at(-1)
	if (!last) return null
	const text = last.body
		.split('\n')
		.filter(line => !line.includes(DECISION_MARKER) && !line.includes('<!-- agent:v1 -->') && line.trim() !== '> *Posted by an agent.*')
		.join('\n')
		.trim()
	return {createdAt: last.createdAt, text}
}
