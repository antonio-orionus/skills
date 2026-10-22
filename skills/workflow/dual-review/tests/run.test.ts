import {spawnSync} from 'node:child_process'
import {chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'

import {afterAll, beforeAll, describe, expect, it} from 'bun:test'

// Drives the real run.ts against a throwaway git repo with fake `codex`,
// `claude` and `opencode` executables first on PATH; any real codex (when a test
// wants none) and every real opencode are dropped from PATH. The fake codex
// prints what the real one printed when the subscription ran out (2026-10-21).
const RUN_TS = path.join(import.meta.dir, '..', 'scripts', 'run.ts')
const sh = process.platform !== 'win32'

const CODEX_USAGE_LIMIT = `#!/bin/sh
cat >&2 <<'EOF_STDERR'
Reading additional input from stdin...
2026-10-20T22:48:18.338693Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed
ERROR: You’ve hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/settings/usage to purchase more credits or try again at Oct 27th, 2026 9:20 AM.
EOF_STDERR
exit 1
`

const CODEX_BROKEN = `#!/bin/sh
echo "ERROR: the output schema is invalid" >&2
exit 1
`

// Answers a review with FAKE_FINDING=1 → one finding (severity FAKE_SEVERITY,
// default P2), else none; answers a verification by confirming every id it was
// handed. Logs each call, and its arguments to FAKE_ARGS when set.
const CLAUDE = `#!${process.execPath}
const fs = require('node:fs')
const args = process.argv.slice(2)
const prompt = args[args.length - 1]
const log = (line) => fs.appendFileSync(process.env.FAKE_LOG, line + '\\n')
if (process.env.FAKE_ARGS) fs.appendFileSync(process.env.FAKE_ARGS, JSON.stringify(args.slice(0, -1)) + '\\n')
if (process.env.FAKE_CLAUDE_FAIL) { log('failed'); process.exit(1) }
if (process.env.FAKE_PROMPT) fs.appendFileSync(process.env.FAKE_PROMPT, prompt + '\\n=====\\n')
const out = (structured_output) => process.stdout.write(JSON.stringify({type: 'result', structured_output}))
if (prompt.includes('Findings to check')) {
	const json = prompt.split('Findings to check (JSON, one entry per id):\\n')[1].split('\\n\\nFor each id')[0]
	const ids = JSON.parse(json).map((f) => f.id)
	log('verify ' + ids.join(','))
	out({verdicts: ids.map((id) => ({id, verdict: 'confirmed', reason: 'the code does it', introduced: true}))})
} else {
	log('review:' + prompt.split('Your focus:\\n')[1].split('\\n')[0])
	out({findings: process.env.FAKE_FINDING ? [{title: 'Queue drops a job', body: 'On restart the job is lost.', file: 'a.ts', lineStart: 1, lineEnd: 1, severity: process.env.FAKE_SEVERITY ?? 'P2', confidence: 0.9, introduced: true}] : []})
}
`

// A Codex that works: finds nothing, and refutes every finding it is asked to check.
const CODEX_OK = `#!${process.execPath}
const fs = require('node:fs')
const args = process.argv.slice(2)
const prompt = args[args.length - 1]
const write = (value) => fs.writeFileSync(args[args.indexOf('--output-last-message') + 1], JSON.stringify(value))
if (prompt.includes('Findings to check')) {
	const ids = JSON.parse(prompt.split('Findings to check (JSON, one entry per id):\\n')[1].split('\\n\\nFor each id')[0]).map((f) => f.id)
	fs.appendFileSync(process.env.FAKE_LOG, 'codex:verify ' + ids.join(',') + '\\n')
	write({verdicts: ids.map((id) => ({id, verdict: 'refuted', reason: 'a guard prevents it', introduced: true}))})
} else {
	fs.appendFileSync(process.env.FAKE_LOG, 'codex:review\\n')
	write({findings: []})
}
`

// `opencode run --format json`: one event per line, as 2.1.1 prints them
// (2026-10-22). FAKE_OPENCODE picks the reply: "events" (default), "noisy"
// (progress lines between the events and a fenced reply), "invalid-once" (prose,
// then JSON when continued with --session), "invalid" (prose every time) or
// "error" (an error event and exit 1). FAKE_OPENCODE_FINDING=1 → one finding.
const OPENCODE = `#!${process.execPath}
const fs = require('node:fs')
const args = process.argv.slice(2)
const prompt = args[args.length - 1]
const mode = process.env.FAKE_OPENCODE ?? 'events'
const retry = args.includes('--session')
fs.appendFileSync(process.env.FAKE_LOG, (prompt.includes('Findings to check') ? 'opencode:verify' : retry ? 'opencode:retry' : 'opencode:review') + '\\n')
if (process.env.FAKE_OPENCODE_ARGS) fs.appendFileSync(process.env.FAKE_OPENCODE_ARGS, JSON.stringify({args: args.slice(0, -1), cwd: process.cwd()}) + '\\n')
const review = JSON.stringify({findings: process.env.FAKE_OPENCODE_FINDING ? [{title: 'Off by one', body: 'The loop skips the last item.', file: 'a.ts', lineStart: 1, lineEnd: 1, severity: 'P1', confidence: 0.7, introduced: true}] : []})
const event = (type, extra) => process.stdout.write(JSON.stringify({type, timestamp: Date.now(), sessionID: 'ses_fake', ...extra}) + '\\n')
const say = (text) => event('text', {part: {id: 'prt_' + Math.random(), type: 'text', text}})
if (mode === 'error') {
	event('error', {error: {type: 'provider.no-route', message: 'Model unavailable: ' + args[args.indexOf('-m') + 1]}})
	process.exit(1)
}
event('step_start', {part: {type: 'step-start'}})
if (mode === 'noisy') process.stdout.write('\\u001b[2m→ Read a.ts {"path": "a.ts"}\\u001b[0m\\n$ git diff main...HEAD\\n')
event('tool_use', {part: {type: 'tool', tool: 'read', state: {status: 'completed', input: {path: 'a.ts'}, output: '{"findings": "not the reply"}'}}})
if (mode === 'invalid' || (mode === 'invalid-once' && !retry)) say('I reviewed the change and found nothing worth reporting.')
else if (mode === 'noisy') say('Here is my review:\\n\\n\\u0060\\u0060\\u0060json\\n' + review + '\\n\\u0060\\u0060\\u0060')
else say(review)
`

const MIMO = 'openrouter/xiaomi/mimo-v2.6-pro'

interface Run {
	status: number | null
	stdout: string
	stderr: string
	log: string[]
	json: {base: string; failures: string[]; coverage: {reviewers: string[]; verifiers: string[]; codexSkipped: {reason: string} | null; fallback: {status: string; model?: string} | null; claudeModel: string}}
	reportDir: string
}

describe.skipIf(!sh)('run.ts without a usable Codex', () => {
	let root: string
	let repo: string
	const git = (...args: string[]) => spawnSync('git', args, {cwd: repo, encoding: 'utf8', env: {...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t'}})

	const install = (dir: string, name: string, body: string) => {
		mkdirSync(dir, {recursive: true})
		writeFileSync(path.join(dir, name), body)
		chmodSync(path.join(dir, name), 0o755)
	}

	beforeAll(() => {
		root = mkdtempSync(path.join(tmpdir(), 'dual-review-'))
		repo = path.join(root, 'repo')
		mkdirSync(repo)
		git('init', '-b', 'main')
		writeFileSync(path.join(repo, 'a.ts'), 'export const a = 1\n')
		mkdirSync(path.join(repo, 'sub'))
		writeFileSync(path.join(repo, 'sub', 'keep.txt'), 'keep\n')
		git('add', '.')
		git('commit', '-m', 'init')
		git('checkout', '-b', 'feature')
		writeFileSync(path.join(repo, 'a.ts'), 'export const a = 2\n')
		git('commit', '-am', 'feat: change a')
	})

	afterAll(() => rmSync(root, {recursive: true, force: true}))

	// `codex` is the fake's script, or null: every PATH directory holding a real codex is dropped.
	// `opencode` is the fake's script; without it no opencode is on PATH.
	// `base: null` and `out: false` leave those flags to their defaults; `cwd` is relative to the repo.
	function run(name: string, args: string[], opts: {codex: string | null; opencode?: string; env?: Record<string, string>; base?: string | null; out?: boolean; cwd?: string}): Run {
		const bin = path.join(root, `bin-${name}`)
		install(bin, 'claude', CLAUDE)
		if (opts.codex !== null) install(bin, 'codex', opts.codex)
		if (opts.opencode !== undefined) install(bin, 'opencode', opts.opencode)
		const logFile = path.join(root, `${name}.log`)
		writeFileSync(logFile, '')
		const out = path.join(root, `out-${name}`)
		const inherited = (process.env.PATH ?? '').split(path.delimiter).filter(dir => !existsSync(path.join(dir, 'opencode')) && (opts.codex !== null || !existsSync(path.join(dir, 'codex'))))
		const result = spawnSync(process.execPath, [RUN_TS, ...(opts.base === null ? [] : ['--base', opts.base ?? 'main']), ...(opts.out === false ? [] : ['--out', out]), ...args], {
			cwd: path.join(repo, opts.cwd ?? ''),
			encoding: 'utf8',
			env: {...process.env, DUAL_REVIEW_FALLBACK_MODEL: '', DUAL_REVIEW_CLAUDE_MODEL: '', PATH: [bin, ...inherited].join(path.delimiter), FAKE_LOG: logFile, ...opts.env}
		})
		const reportDir = opts.out === false ? path.dirname(/report at (.+)$/m.exec(result.stderr)?.[1] ?? '') : out
		return {status: result.status, stdout: result.stdout, stderr: result.stderr, log: readFileSync(logFile, 'utf8').split('\n').filter(Boolean), json: JSON.parse(readFileSync(path.join(reportDir, 'report.json'), 'utf8')), reportDir}
	}

	it('--light falls back to one Claude reviewer and has a second Claude pass check its findings', () => {
		const r = run('light-findings', ['--light'], {codex: CODEX_USAGE_LIMIT, env: {FAKE_FINDING: '1'}})
		expect(r.log).toEqual([expect.stringMatching(/^review:The whole change/), 'verify claude-review-1'])
		expect(r.status).toBe(1)
		expect(r.stdout).toContain('Codex skipped (usage limit')
		expect(r.stdout).toContain('try again at Oct 27th, 2026 9:20 AM')
		expect(r.stdout).toContain('confirmed by a second claude pass')
		expect(r.json.coverage).toMatchObject({reviewers: ['claude:review'], verifiers: ['claude'], codexSkipped: {reason: 'usage-limit'}})
	})

	it('--light exits 0 only once a Claude reviewer has actually read the change', () => {
		const r = run('light-clean', ['--light'], {codex: CODEX_USAGE_LIMIT})
		expect(r.status).toBe(0)
		expect(r.log).toHaveLength(1)
		expect(r.stdout).toContain('Reviewed by claude:review')
		expect(r.stdout).toContain('Codex skipped')
	})

	it('full mode has the four Claude lanes checked by a second Claude pass', () => {
		const r = run('full', [], {codex: CODEX_USAGE_LIMIT, env: {FAKE_FINDING: '1'}})
		expect(r.log.filter(l => l.startsWith('review:'))).toHaveLength(4)
		expect(r.log.filter(l => l.startsWith('verify'))).toHaveLength(1)
		expect(r.status).toBe(1)
		expect(r.json.coverage.verifiers).toEqual(['claude'])
		expect(r.json.coverage.codexSkipped?.reason).toBe('usage-limit')
	})

	it('treats a missing codex binary like an unavailable Codex', () => {
		const r = run('missing', ['--light'], {codex: null})
		expect(r.status).toBe(0)
		expect(r.json.coverage.codexSkipped?.reason).toBe('missing')
		expect(r.stdout).toContain('Codex skipped (not installed')
	})

	it('exits 2 and says nothing reviewed the change when the fallback reviewer fails too', () => {
		const r = run('both-down', ['--light'], {codex: CODEX_USAGE_LIMIT, env: {FAKE_CLAUDE_FAIL: '1'}})
		expect(r.status).toBe(2)
		expect(r.stdout).toContain('No reviewer completed')
	})

	it('does not mistake an ordinary Codex failure for unavailability', () => {
		const r = run('broken', ['--light'], {codex: CODEX_BROKEN})
		expect(r.status).toBe(2)
		expect(r.log).toEqual([])
		expect(r.json.coverage.codexSkipped).toBeNull()
	})

	describe('with the OpenCode fallback reviewer', () => {
		const readArgs = (file: string): {args: string[]; cwd: string}[] =>
			readFileSync(file, 'utf8')
				.split('\n')
				.filter(Boolean)
				.map(line => JSON.parse(line))

		it('takes Codex’s slot on a usage limit, read-only from the repository root, and Claude checks its findings', () => {
			const argsFile = path.join(root, 'opencode-args-light.jsonl')
			const r = run('oc-light', ['--light'], {codex: CODEX_USAGE_LIMIT, opencode: OPENCODE, cwd: 'sub', env: {FAKE_OPENCODE_FINDING: '1', FAKE_OPENCODE_ARGS: argsFile}})
			expect(r.log).toEqual(['opencode:review', 'verify opencode-review-1'])
			expect(r.status).toBe(1)
			const [call] = readArgs(argsFile)
			expect(call?.args).toEqual(['run', '--standalone', '--agent', 'plan', '-m', MIMO, '--format', 'json'])
			expect(call?.cwd).toBe(realpathSync(repo))
			expect(r.stdout).toContain(`Codex skipped (usage limit: You’ve hit your usage limit.`)
			expect(r.stdout).toContain(`; fallback reviewer opencode:${MIMO}, checked by Claude.`)
			expect(r.stdout).toContain('**[P1] Off by one**')
			expect(r.stdout).toContain('opencode:review; confirmed by claude')
			expect(r.json.coverage).toMatchObject({reviewers: ['opencode:review'], verifiers: ['claude'], fallback: {status: 'reviewed', model: MIMO}})
		})

		it('runs beside the four Claude lanes in full mode, and never checks a finding itself', () => {
			const r = run('oc-full', [], {codex: CODEX_USAGE_LIMIT, opencode: OPENCODE, env: {FAKE_FINDING: '1', FAKE_OPENCODE_FINDING: '1'}})
			expect(r.log.filter(l => l.startsWith('opencode:'))).toEqual(['opencode:review'])
			expect(r.log.filter(l => l.startsWith('review:'))).toHaveLength(4)
			const checks = r.log.filter(l => l.startsWith('verify '))
			expect(checks).toHaveLength(2)
			expect(checks).toContain('verify opencode-review-1')
			expect(checks.find(l => l.includes('claude-'))?.split(' ')[1]?.split(',')).toHaveLength(4)
			expect(r.json.coverage.reviewers).toEqual(expect.arrayContaining(['opencode:review', 'claude:regressions', 'claude:failures', 'claude:types-and-rules', 'claude:tests']))
			expect(r.stdout).toContain("OpenCode's findings checked by Claude")
			expect(r.stdout).toContain("Claude's findings checked in a second Claude pass")
		})

		it('is off when DUAL_REVIEW_FALLBACK_MODEL is none, and Claude takes the slot as before', () => {
			const r = run('oc-none', ['--light'], {codex: CODEX_USAGE_LIMIT, opencode: OPENCODE, env: {DUAL_REVIEW_FALLBACK_MODEL: 'none'}})
			expect(r.status).toBe(0)
			expect(r.log).toEqual([expect.stringMatching(/^review:The whole change/)])
			expect(r.stdout).toContain('no fallback reviewer (DUAL_REVIEW_FALLBACK_MODEL=none)')
			expect(r.json.coverage.fallback).toEqual({status: 'disabled'})
		})

		it('says so when opencode is not installed, and Claude takes the slot', () => {
			const r = run('oc-missing', ['--light'], {codex: CODEX_USAGE_LIMIT})
			expect(r.status).toBe(0)
			expect(r.json.coverage.reviewers).toEqual(['claude:review'])
			expect(r.stdout).toContain(`fallback reviewer opencode:${MIMO} not run (the opencode binary was not found on PATH)`)
		})

		it('says why when OpenCode fails, and Claude takes the slot without failing the run', () => {
			const r = run('oc-error', ['--light'], {codex: CODEX_USAGE_LIMIT, opencode: OPENCODE, env: {FAKE_OPENCODE: 'error'}})
			expect(r.status).toBe(0)
			expect(r.log).toEqual(['opencode:review', expect.stringMatching(/^review:The whole change/)])
			expect(r.stdout).toContain(`fallback reviewer opencode:${MIMO} failed (Model unavailable: ${MIMO})`)
			expect(r.json.failures).toEqual([])
		})

		it('finds the reply among progress lines and a json fence', () => {
			const r = run('oc-noisy', ['--light'], {codex: CODEX_USAGE_LIMIT, opencode: OPENCODE, env: {FAKE_OPENCODE: 'noisy', FAKE_OPENCODE_FINDING: '1'}})
			expect(r.status).toBe(1)
			expect(r.log).toEqual(['opencode:review', 'verify opencode-review-1'])
			expect(r.stdout).toContain('**[P1] Off by one**')
		})

		it('asks once more in the same session when the reply is not valid JSON', () => {
			const argsFile = path.join(root, 'opencode-args-retry.jsonl')
			const r = run('oc-retry', ['--light'], {codex: CODEX_USAGE_LIMIT, opencode: OPENCODE, env: {FAKE_OPENCODE: 'invalid-once', FAKE_OPENCODE_FINDING: '1', FAKE_OPENCODE_ARGS: argsFile}})
			expect(r.status).toBe(1)
			expect(r.log).toEqual(['opencode:review', 'opencode:retry', 'verify opencode-review-1'])
			expect(readArgs(argsFile)[1]?.args).toEqual(['run', '--standalone', '--agent', 'plan', '-m', MIMO, '--format', 'json', '--session', 'ses_fake'])
			expect(r.json.coverage.fallback).toEqual({status: 'reviewed', model: MIMO})
		})

		it('counts a reply that is still not valid JSON after the retry as a failed reviewer', () => {
			const r = run('oc-invalid', ['--light'], {codex: CODEX_USAGE_LIMIT, opencode: OPENCODE, env: {FAKE_OPENCODE: 'invalid'}})
			expect(r.status).toBe(2)
			expect(r.log).toEqual(['opencode:review', 'opencode:retry'])
			expect(r.stdout).toContain('**Incomplete: some reviewers failed, so coverage is partial.**')
			expect(r.json.failures).toEqual([expect.stringContaining('opencode review-opencode-review')])
			expect(r.json.coverage.fallback).toMatchObject({status: 'invalid', model: MIMO})
		})
	})

	describe('with Codex available', () => {
		it('runs every Claude call on Opus by default and on DUAL_REVIEW_CLAUDE_MODEL when set', () => {
			const argsFile = path.join(root, 'claude-args.jsonl')
			const models = (): string[] =>
				readFileSync(argsFile, 'utf8')
					.split('\n')
					.filter(Boolean)
					.map(line => {
						const args: string[] = JSON.parse(line)
						return args[args.indexOf('--model') + 1] ?? ''
					})
			const r = run('opus', [], {codex: CODEX_OK, env: {FAKE_FINDING: '1', FAKE_ARGS: argsFile}})
			expect(models()).toEqual(['opus', 'opus', 'opus', 'opus'])
			expect(r.stdout).toContain('Claude ran as claude:opus.')
			expect(r.json.coverage.claudeModel).toBe('opus')
			rmSync(argsFile)
			run('sonnet', ['--light'], {codex: CODEX_USAGE_LIMIT, env: {FAKE_FINDING: '1', FAKE_ARGS: argsFile, DUAL_REVIEW_CLAUDE_MODEL: 'sonnet'}})
			expect(models()).toEqual(['sonnet', 'sonnet'])
		})

		it('escalates a P1 Claude finding Codex refuted to uncertain, and lets a refuted P2 go', () => {
			const p1 = run('escalate-p1', [], {codex: CODEX_OK, env: {FAKE_FINDING: '1', FAKE_SEVERITY: 'P1'}})
			expect(p1.log.filter(l => l.startsWith('codex:'))).toEqual(['codex:review', expect.stringMatching(/^codex:verify /)])
			expect(p1.status).toBe(1)
			expect(p1.stdout).toContain('## Uncertain: read the code and decide (4)')
			expect(p1.stdout).toContain('refuted by codex, escalated: P1 from Opus')
			expect(p1.stdout).toContain('_Check:_ a guard prevents it')
			const p2 = run('escalate-p2', [], {codex: CODEX_OK, env: {FAKE_FINDING: '1'}})
			expect(p2.status).toBe(0)
			expect(p2.stdout).toContain('## Refuted (4)')
		})
	})

	it('records the reviewed diff for check-head only after a complete review against origin/main', () => {
		const record = path.join(git('rev-parse', '--absolute-git-dir').stdout.trim(), 'dual-review', 'reviewed.json')
		rmSync(record, {force: true})
		expect(run('no-origin', ['--light'], {codex: CODEX_USAGE_LIMIT}).status).toBe(0)
		expect(existsSync(record)).toBe(false)

		git('update-ref', 'refs/remotes/origin/main', 'main')
		try {
			expect(run('reviewer-failed', ['--light'], {codex: CODEX_USAGE_LIMIT, env: {FAKE_CLAUDE_FAIL: '1'}}).status).toBe(2)
			expect(existsSync(record)).toBe(false)
			expect(run('recorded', ['--light'], {codex: CODEX_USAGE_LIMIT}).status).toBe(0)
			expect(JSON.parse(readFileSync(record, 'utf8'))).toMatchObject({head: git('rev-parse', 'HEAD').stdout.trim(), mergeBase: git('rev-parse', 'main').stdout.trim()})
		} finally {
			git('update-ref', '-d', 'refs/remotes/origin/main')
			rmSync(record, {force: true})
		}
	})

	it('compares against origin/HEAD’s branch by default and keeps reports and the record in the git dir', () => {
		const gitDir = git('rev-parse', '--absolute-git-dir').stdout.trim()
		const record = path.join(gitDir, 'dual-review', 'reviewed.json')
		git('update-ref', 'refs/remotes/origin/trunk', 'main')
		git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/trunk')
		try {
			const r = run('defaults', ['--light'], {codex: CODEX_USAGE_LIMIT, base: null, out: false})
			expect(r.status).toBe(0)
			expect(r.json.base).toBe(git('rev-parse', 'main').stdout.trim().slice(0, 12))
			expect(r.reportDir.startsWith(path.join(gitDir, 'dual-review') + path.sep)).toBe(true)
			expect(git('status', '--porcelain').stdout).toBe('')
			expect(JSON.parse(readFileSync(record, 'utf8'))).toMatchObject({mergeBase: git('rev-parse', 'main').stdout.trim()})
		} finally {
			git('symbolic-ref', '--delete', 'refs/remotes/origin/HEAD')
			git('update-ref', '-d', 'refs/remotes/origin/trunk')
			rmSync(record, {force: true})
		}
	})

	it('gives every reviewer the project description and both learnings files', () => {
		const learnings = path.join(repo, '.agents', 'memory', 'review-learnings.md')
		const extra = path.join(root, 'my-learnings.md')
		const prompts = path.join(root, 'prompts.txt')
		mkdirSync(path.dirname(learnings), {recursive: true})
		writeFileSync(learnings, '---\nname: review-learnings\n---\n- Repo rule.\n')
		writeFileSync(extra, '- My rule.\n')
		writeFileSync(path.join(repo, 'AGENTS.md'), '# Repo\n\nRepo makes widgets.\n')
		try {
			const r = run('context', [], {codex: CODEX_USAGE_LIMIT, env: {FAKE_PROMPT: prompts, DUAL_REVIEW_LEARNINGS: extra, FAKE_FINDING: '1'}})
			expect(r.status).toBe(1)
			const sent = readFileSync(prompts, 'utf8').split('\n=====\n').filter(Boolean)
			expect(sent).toHaveLength(5)
			for (const prompt of sent) {
				expect(prompt).toContain('the repository "repo"')
				expect(prompt).toContain('from its AGENTS.md:\n> Repo makes widgets.')
				expect(prompt).toContain('- Repo rule.\n\n- My rule.')
				expect(prompt).not.toContain('name: review-learnings')
			}
		} finally {
			rmSync(path.join(repo, '.agents'), {recursive: true, force: true})
			rmSync(path.join(repo, 'AGENTS.md'), {force: true})
		}
	})

	it('--help prints the usage and the repository context it would use, and exits 0', () => {
		const r = spawnSync(process.execPath, [RUN_TS, '--help'], {cwd: repo, encoding: 'utf8', env: {...process.env, DUAL_REVIEW_CLAUDE_MODEL: '', DUAL_REVIEW_FALLBACK_MODEL: ''}})
		expect(r.status).toBe(0)
		expect(r.stdout).toContain('Usage: bun run.ts')
		expect(r.stdout).toMatch(/project: +repo/)
		expect(r.stdout).toMatch(/base: +main \(origin\/main not found; using the local branch\)/)
		expect(r.stdout).toMatch(/learnings: +none/)
		expect(r.stdout).toContain('DUAL_REVIEW_CLAUDE_MODEL')
		expect(r.stdout).toContain('DUAL_REVIEW_FALLBACK_MODEL')
		expect(r.stdout).toMatch(/claude: +claude:opus/)
		expect(r.stdout).toMatch(new RegExp(`fallback: +opencode:${MIMO}`))
	})

	it('exits 2, never 1, when it cannot start', () => {
		for (const args of [['--bogus'], ['--base', 'no-such-ref']]) {
			const r = spawnSync(process.execPath, [RUN_TS, ...args], {cwd: repo, encoding: 'utf8'})
			expect(r.status).toBe(2)
			expect(r.stderr).toStartWith('dual review: ')
		}
		const outside = spawnSync(process.execPath, [RUN_TS, '--light'], {cwd: root, encoding: 'utf8'})
		expect(outside.status).toBe(2)
	})
})
