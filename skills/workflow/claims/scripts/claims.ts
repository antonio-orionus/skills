#!/usr/bin/env bun
// Who holds which issue, PR or files, shared by every session and worktree of
// one clone. The store is agent-claims.json in the clone's common git dir.
//
//   bun claims.ts claim <target>... [--note <text>]   claim or renew; exit 1 when another session holds one
//   bun claims.ts release [<target>...] [--force]       drop your claims (all of them without targets)
//   bun claims.ts who <target>                          print the holder; exit 1 when it is another session
//   bun claims.ts list [--json]                         live claims
//   bun claims.ts claimable [--label <label>]           open issues free to start (default label ready-for-agent)
//   bun claims.ts check-paths [--base <ref>]            exit 1 when the branch changes files another session holds
//   bun claims.ts decision <N>                          the latest recorded decision on issue N; exit 1 when none
//
// Targets: #N or issue:N, pr:N, path:<glob>. The owner is CLAIMS_OWNER, else
// the Claude desktop session id (CLAUDE_CODE_HOST_SESSION_ID). CLAIMS_TTL_HOURS
// sets how long an unrenewed claim lives (default 24).

import {spawnSync} from 'node:child_process'
import {mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync} from 'node:fs'
import path from 'node:path'
import {claim, claimableIssues, DEFAULT_TTL_MS, holder, type IssueLike, latestDecision, parseStore, parseTarget, pathsHeldByOthers, prune, release, type Store} from './store'

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
	const result = spawnSync(cmd, args, {encoding: 'utf8'})
	if (result.status !== 0) throw new Error(`${cmd} ${args.join(' ')}: ${(result.stderr || result.stdout).trim()}`)
	return result.stdout
}

const gitDir = (): string => run('git', ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim()
const storeFile = (): string => path.join(gitDir(), 'agent-claims.json')

function readStore(file: string): Store {
	try {
		return parseStore(JSON.parse(readFileSync(file, 'utf8')))
	} catch {
		return parseStore(null)
	}
}

// Read-modify-write under a lock directory, so two sessions claiming at once
// can't overwrite each other. A lock older than 30 s is a crashed writer's.
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
			if (attempt > 100) throw new Error(`could not lock ${file}`)
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

// Issue and PR targets whose issue or PR is closed or merged. A target gh can't
// read stays: being offline must not release claims.
function closedTargets(store: Store): Set<string> {
	const closed = new Set<string>()
	for (const c of store.claims) {
		const m = /^(?:issue|pr):(\d+)$/.exec(c.target)
		if (!m) continue
		try {
			if (run('gh', ['api', `repos/{owner}/{repo}/issues/${m[1]}`, '--jq', '.state']).trim() === 'closed') closed.add(c.target)
		} catch {
			// Unknown: keep it.
		}
	}
	return closed
}

const pruned = (store: Store, now: Date): Store => prune(store, now, ttlMs(), closedTargets(store))

const describeClaim = (c: {target: string; owner: string; since: string; note?: string}): string => `${c.target}  ${c.owner}  since ${c.since}${c.note ? `  (${c.note})` : ''}`

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
	const ref = base ?? (() => {
		try {
			return run('git', ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']).trim()
		} catch {
			return 'origin/main'
		}
	})()
	const mergeBase = run('git', ['merge-base', ref, 'HEAD']).trim()
	return run('git', ['diff', '--name-only', mergeBase, 'HEAD']).split('\n').filter(Boolean)
}

function main(argv: string[]): number {
	const [command, ...args] = argv
	const now = new Date()
	switch (command) {
		case 'claim': {
			const note = flag(args, '--note')
			const me = owner()
			const targets = args.map(parseTarget)
			if (targets.length === 0) throw new Usage('claim what? give #N, pr:N or path:<glob>')
			const refused = withStore(store => {
				const out = claim(pruned(store, now), targets, me, now, {note, ttlMs: ttlMs()})
				return {store: out.store, result: out.refused}
			})
			for (const c of refused) console.error(`${c.target} is held by ${c.owner} since ${c.since}${c.note ? ` (${c.note})` : ''}`)
			const taken = targets.filter(t => !refused.some(c => c.target === t))
			if (taken.length > 0) console.log(`claimed for ${me}: ${taken.join(' ')}`)
			return refused.length > 0 ? 1 : 0
		}
		case 'release': {
			const force = switchOn(args, '--force')
			const me = owner()
			const targets = args.length > 0 ? args.map(parseTarget) : null
			withStore(store => ({store: release(store, targets, me, force), result: null}))
			console.log(targets ? `released ${targets.join(' ')}` : `released every claim of ${me}`)
			return 0
		}
		case 'who': {
			const [raw] = args
			if (!raw) throw new Usage('who what? give #N, pr:N or path:<glob>')
			const target = parseTarget(raw)
			const held = withStore(store => {
				const next = pruned(store, now)
				return {store: next, result: holder(next, target, now, ttlMs())}
			})
			if (!held) {
				console.log(`${target} is free`)
				return 0
			}
			console.log(describeClaim(held))
			return held.owner === ownerOrNull() ? 0 : 1
		}
		case 'list': {
			const json = switchOn(args, '--json')
			const store = withStore(s => {
				const next = pruned(s, now)
				return {store: next, result: next}
			})
			if (json) console.log(JSON.stringify(store.claims, null, '\t'))
			else for (const c of store.claims) console.log(describeClaim(c))
			return 0
		}
		case 'claimable': {
			const label = flag(args, '--label') ?? 'ready-for-agent'
			const issues = JSON.parse(run('gh', ['issue', 'list', '--label', label, '--state', 'open', '--limit', '200', '--json', 'number,title,body'])) as IssueLike[]
			const prs = JSON.parse(run('gh', ['pr', 'list', '--state', 'open', '--limit', '200', '--json', 'number,title,body'])) as IssueLike[]
			const store = withStore(s => {
				const next = pruned(s, now)
				return {store: next, result: next}
			})
			for (const issue of claimableIssues(issues, prs, store, ownerOrNull(), now, ttlMs())) console.log(`#${issue.number} ${issue.title}`)
			return 0
		}
		case 'check-paths': {
			const files = changedFiles(flag(args, '--base'))
			const store = withStore(s => ({result: s}))
			const held = pathsHeldByOthers(store, files, ownerOrNull() ?? '', now, ttlMs())
			if (held.length === 0) return 0
			console.error(`claims: this branch changes ${held.length} file(s) another session holds:`)
			for (const h of held) console.error(`  ${h.file}  held by ${h.claim.owner} (${h.claim.target}${h.claim.note ? `, ${h.claim.note}` : ''})`)
			console.error('Ask that session (or the user) before pushing, or move the change into its work.')
			return 1
		}
		case 'decision': {
			const [n] = args
			if (!n || !/^\d+$/.test(n)) throw new Usage('decision needs an issue number')
			const {comments} = JSON.parse(run('gh', ['issue', 'view', n, '--json', 'comments'])) as {comments: {createdAt: string; body: string}[]}
			const decision = latestDecision(comments)
			if (!decision) {
				console.error(`#${n} has no recorded decision`)
				return 1
			}
			console.log(`Decision on #${n} (${decision.createdAt}):\n${decision.text}`)
			return 0
		}
		default:
			throw new Usage('usage: claims.ts <claim|release|who|list|claimable|check-paths|decision> ...')
	}
}

try {
	process.exitCode = main(process.argv.slice(2))
} catch (err) {
	console.error(`claims: ${err instanceof Error ? err.message : String(err)}`)
	process.exitCode = err instanceof Usage ? 2 : 1
}
