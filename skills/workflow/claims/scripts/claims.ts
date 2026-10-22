#!/usr/bin/env bun
// Who holds which issue, PR or files, shared by every session and worktree of
// one clone. The store is agent-claims.json in the clone's common git dir.
//
//   bun claims.ts claim <target>... [--note <text>] [--for <#N|pr:N>]
//                                                       claim or renew; --for drops the claims when that issue or PR closes
//   bun claims.ts release [<target>...] [--force]       drop your claims (all of them without targets)
//   bun claims.ts who <target>                          print the holder
//   bun claims.ts list [--json]                         live claims
//   bun claims.ts claimable [--label <label>]           open issues free to start (default label ready-for-agent)
//   bun claims.ts check-paths [--base <ref>]            does the branch change files another session holds?
//   bun claims.ts decision <N>                          the latest decision a maintainer recorded on issue N
//
// Exit codes: 0 done; 1 another session holds it (claim, release, who,
// check-paths) or no decision is recorded; 2 usage; 3 the check itself failed.
// Targets: #N or issue:N, pr:N, path:<glob>. The owner is CLAIMS_OWNER, else
// the Claude desktop session id (CLAUDE_CODE_HOST_SESSION_ID). CLAIMS_TTL_HOURS
// sets how long a new or renewed claim lives (default 24).

import {spawnSync} from 'node:child_process'
import {mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync} from 'node:fs'
import path from 'node:path'
import {type Claim, claim, claimableIssues, type CommentLike, DEFAULT_TTL_MS, holder, type IssueLike, latestDecision, parseStore, parseTarget, pathsHeldByOthers, type PrLike, prune, release, type Store} from './store'

const EXIT = {ok: 0, held: 1, usage: 2, error: 3} as const

class Usage extends Error {}

const ttlMs = (): number => {
	const hours = Number(process.env.CLAIMS_TTL_HOURS)
	return Number.isFinite(hours) && hours > 0 ? hours * 3600 * 1000 : DEFAULT_TTL_MS
}

const ownerOrNull = (): string | null => process.env.CLAIMS_OWNER || process.env.CLAUDE_CODE_HOST_SESSION_ID || null

function owner(): string {
	const o = ownerOrNull()
	if (!o) throw new Usage('no owner: set CLAIMS_OWNER to a name for this session (Claude desktop sessions get CLAUDE_CODE_HOST_SESSION_ID)')
	return o
}

function run(cmd: string, args: string[]): string {
	const result = spawnSync(cmd, args, {encoding: 'utf8', timeout: 20_000})
	if (result.status !== 0) throw new Error(`${cmd} ${args.join(' ')}: ${(result.stderr || result.stdout || result.error?.message || 'failed').trim()}`)
	return result.stdout
}

const storeFile = (): string => path.join(run('git', ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim(), 'agent-claims.json')

// A missing file is an empty store; a file that doesn't parse stops every
// command, so it is never overwritten with nothing.
function readStore(file: string): Store {
	let text: string
	try {
		text = readFileSync(file, 'utf8')
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {version: 1, claims: []}
		throw err
	}
	try {
		return parseStore(JSON.parse(text))
	} catch (err) {
		throw new Error(`${file} is damaged (${err instanceof Error ? err.message : String(err)}); fix or delete it by hand`)
	}
}

// Read-modify-write under a lock directory, so two sessions claiming at once
// can't overwrite each other. Nothing slow runs inside the lock, so one older
// than 30 s is a crashed writer's.
function withStore<T>(fn: (store: Store) => {store?: Store; result: T}): T {
	const file = storeFile()
	const lock = `${file}.lock`
	for (let attempt = 0; ; attempt++) {
		try {
			mkdirSync(lock)
			break
		} catch {
			try {
				if (Date.now() - statSync(lock).mtimeMs > 30_000) rmSync(lock, {recursive: true, force: true})
			} catch {
				// Released meanwhile.
			}
			if (attempt > 200) throw new Error(`could not lock ${file}`)
			Bun.sleepSync(50)
		}
	}
	try {
		const {store, result} = fn(readStore(file))
		if (store) {
			writeFileSync(`${file}.tmp`, `${JSON.stringify(store, null, '\t')}\n`)
			renameSync(`${file}.tmp`, file)
		}
		return result
	} finally {
		rmSync(lock, {recursive: true, force: true})
	}
}

// Issue and PR targets (claimed or tied to) that are closed or merged, asked
// of gh before taking the lock. A target gh can't read stays open: being
// offline must not release claims.
function closedTargets(): Set<string> {
	const store = readStore(storeFile())
	const targets = new Set(store.claims.flatMap(c => (c.tiedTo === undefined ? [c.target] : [c.target, c.tiedTo])))
	const closed = new Set<string>()
	for (const target of targets) {
		const m = /^(?:issue|pr):(\d+)$/.exec(target)
		if (!m) continue
		try {
			if (run('gh', ['api', `repos/{owner}/{repo}/issues/${m[1]}`, '--jq', '.state']).trim() === 'closed') closed.add(target)
		} catch {
			// Unknown: keep it.
		}
	}
	return closed
}

// The pruned store, written back, and returned.
function prunedStore(now: Date): Store {
	const closed = closedTargets()
	return withStore(s => {
		const next = prune(s, now, closed)
		return {store: next, result: next}
	})
}

const describeClaim = (c: Claim): string => `${c.target}  ${c.owner}  since ${c.since}${c.tiedTo ? `  for ${c.tiedTo}` : ''}${c.note ? `  (${c.note})` : ''}`

function flag(args: string[], name: string): string | undefined {
	const i = args.indexOf(name)
	if (i === -1) return undefined
	const value = args[i + 1]
	if (value === undefined) throw new Usage(`${name} needs a value`)
	args.splice(i, 2)
	return value
}

function switchOn(args: string[], name: string): boolean {
	const i = args.indexOf(name)
	if (i !== -1) args.splice(i, 1)
	return i !== -1
}

function changedFiles(base: string | undefined): string[] {
	let ref = base
	if (ref === undefined) {
		try {
			ref = run('git', ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']).trim()
		} catch {
			ref = 'origin/main'
		}
	}
	const mergeBase = run('git', ['merge-base', ref, 'HEAD']).trim()
	return run('git', ['diff', '--name-only', mergeBase, 'HEAD']).split('\n').filter(Boolean)
}

function main(argv: string[]): number {
	const [command, ...args] = argv
	const now = new Date()
	switch (command) {
		case 'claim': {
			const note = flag(args, '--note')
			const forRaw = flag(args, '--for')
			const tiedTo = forRaw === undefined ? undefined : parseTarget(forRaw)
			if (tiedTo?.startsWith('path:')) throw new Usage('--for takes an issue or PR, not a path')
			const me = owner()
			const targets = args.map(parseTarget)
			if (targets.length === 0) throw new Usage('claim what? give #N, pr:N or path:<glob>')
			const closed = closedTargets()
			const refused = withStore(store => {
				const out = claim(prune(store, now, closed), targets, me, now, {note, tiedTo, ttlMs: ttlMs()})
				return {store: out.store, result: out.refused}
			})
			for (const c of refused) console.error(`${c.target} is held by ${c.owner} since ${c.since}${c.note ? ` (${c.note})` : ''}`)
			const taken = targets.filter(t => !refused.some(c => c.target === t))
			if (taken.length > 0) console.log(`claimed for ${me}: ${taken.join(' ')}`)
			return refused.length > 0 ? EXIT.held : EXIT.ok
		}
		case 'release': {
			const force = switchOn(args, '--force')
			const me = owner()
			const targets = args.length > 0 ? args.map(parseTarget) : null
			const out = withStore(store => {
				const r = release(store, targets, me, force)
				return {store: r.store, result: r}
			})
			console.log(out.released.length > 0 ? `released ${out.released.join(' ')}` : 'released nothing')
			for (const c of out.kept) console.error(`${c.target} is still held by ${c.owner}; --force drops it`)
			return out.kept.length > 0 ? EXIT.held : EXIT.ok
		}
		case 'who': {
			const [raw] = args
			if (!raw) throw new Usage('who what? give #N, pr:N or path:<glob>')
			const target = parseTarget(raw)
			const held = holder(prunedStore(now), target, now)
			if (!held) {
				console.log(`${target} is free`)
				return EXIT.ok
			}
			console.log(describeClaim(held))
			return held.owner === ownerOrNull() ? EXIT.ok : EXIT.held
		}
		case 'list': {
			const json = switchOn(args, '--json')
			const store = prunedStore(now)
			if (json) console.log(JSON.stringify(store.claims, null, '\t'))
			else for (const c of store.claims) console.log(describeClaim(c))
			return EXIT.ok
		}
		case 'claimable': {
			const label = flag(args, '--label') ?? 'ready-for-agent'
			const issues = JSON.parse(run('gh', ['issue', 'list', '--label', label, '--state', 'open', '--limit', '200', '--json', 'number,title,body'])) as IssueLike[]
			const prs = JSON.parse(run('gh', ['pr', 'list', '--state', 'open', '--limit', '200', '--json', 'number,title,body,isCrossRepository'])) as PrLike[]
			for (const {issue, outsidePrs} of claimableIssues(issues, prs, prunedStore(now), ownerOrNull(), now)) {
				console.log(`#${issue.number} ${issue.title}${outsidePrs.length > 0 ? `  (outside PR ${outsidePrs.map(n => `#${n}`).join(', ')}: finish or absorb it)` : ''}`)
			}
			return EXIT.ok
		}
		case 'check-paths': {
			const files = changedFiles(flag(args, '--base'))
			const held = pathsHeldByOthers(prunedStore(now), files, ownerOrNull() ?? '', now)
			if (held.length === 0) return EXIT.ok
			console.error(`claims: this branch changes ${held.length} file(s) another session holds:`)
			for (const h of held) console.error(`  ${h.file}  held by ${h.claim.owner} (${h.claim.target}${h.claim.note ? `, ${h.claim.note}` : ''})`)
			console.error('Ask that session (or the user) before pushing, or move the change into its work.')
			return EXIT.held
		}
		case 'decision': {
			const [n] = args
			if (!n || !/^\d+$/.test(n)) throw new Usage('decision needs an issue number')
			const {comments} = JSON.parse(run('gh', ['issue', 'view', n, '--json', 'comments'])) as {comments: CommentLike[]}
			const decision = latestDecision(comments)
			if (!decision) {
				console.error(`#${n} has no recorded decision`)
				return EXIT.held
			}
			console.log(`Decision on #${n} (${decision.createdAt}):\n${decision.text}`)
			return EXIT.ok
		}
		default:
			throw new Usage('usage: claims.ts <claim|release|who|list|claimable|check-paths|decision> ...')
	}
}

try {
	process.exitCode = main(process.argv.slice(2))
} catch (err) {
	console.error(`claims: ${err instanceof Error ? err.message : String(err)}`)
	process.exitCode = err instanceof Usage ? EXIT.usage : EXIT.error
}
