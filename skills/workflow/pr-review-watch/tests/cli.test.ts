import {afterEach, beforeEach, describe, expect, test} from 'bun:test'
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

// Drives the real CLI against tests/fake-gh/gh, which replays scripted poll steps.
const CLI = join(import.meta.dir, '..', 'scripts', 'pr-review.ts')
const FAKE_BIN = join(import.meta.dir, 'fake-gh')
const fx = (name: string): string => readFileSync(join(import.meta.dir, 'fixtures', name), 'utf8')

const HEAD = '90ba71610e3e15ee262a701fbe94ad64cef9ce06'
const OTHER = 'b'.repeat(40)
const bot = (body: string, updatedAt = '2026-10-20T06:30:00Z') => ({id: 1, login: 'coderabbitai[bot]', body, createdAt: '2026-10-20T06:01:00Z', updatedAt})
const openThread = {
	id: 'PRRT_x',
	isResolved: false,
	isOutdated: false,
	path: 'src/a.ts',
	line: 3,
	startLine: null,
	originalLine: 3,
	originalStartLine: null,
	first: {totalCount: 1, nodes: [{databaseId: 9, url: 'https://github.com/o/r/pull/7#discussion_r9', body: fx('thread-root.md'), author: {login: 'coderabbitai'}}]},
	last: {nodes: [{author: {login: 'coderabbitai'}}]},
}

let dir: string
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'pr-review-cli-'))
})
afterEach(() => rmSync(dir, {recursive: true, force: true}))

function run(scenario: object, ...args: string[]): {code: number; json: Record<string, unknown>; stderr: string; posted: string} {
	const file = join(dir, 'scenario.json')
	writeFileSync(file, JSON.stringify(scenario))
	const log = join(dir, 'posted.log')
	const proc = Bun.spawnSync(['bun', CLI, ...args], {
		env: {...process.env, PATH: `${FAKE_BIN}:${process.env.PATH}`, FAKE_GH_SCENARIO: file, FAKE_GH_LOG: log},
		stdout: 'pipe',
		stderr: 'pipe',
	})
	const stdout = proc.stdout.toString().trim().split('\n').at(-1) ?? '{}'
	return {code: proc.exitCode ?? -1, json: JSON.parse(stdout), stderr: proc.stderr.toString(), posted: existsSync(log) ? readFileSync(log, 'utf8') : ''}
}

describe('wait', () => {
	test('polls through in-progress to findings', () => {
		const r = run(
			{
				steps: [
					{head: HEAD, comments: [bot(fx('summary-in-progress.md'))]},
					{head: HEAD, comments: [bot(fx('summary-reviewed.md'))]},
				],
				threads: [openThread],
			},
			'wait',
			'--interval',
			'0.05',
		)
		expect(r.code).toBe(10)
		expect(r.json).toMatchObject({state: 'findings', pr: 7, threads: 1})
		expect(r.stderr).toContain('pending: CodeRabbit is reviewing new changes')
	})

	test('clean when the head is covered and no thread is open', () => {
		const r = run({steps: [{head: HEAD, comments: [bot(fx('summary-reviewed.md'))]}]}, 'wait')
		expect(r.code).toBe(0)
		expect(r.json.state).toBe('clean')
	})

	test('push while waiting -> aborted-by-push', () => {
		const r = run(
			{
				steps: [
					{head: HEAD, comments: [bot(fx('summary-in-progress.md'))]},
					{head: OTHER, comments: [bot(fx('summary-in-progress.md'))]},
				],
			},
			'wait',
			'--interval',
			'0.05',
		)
		expect(r.code).toBe(23)
		expect(r.json).toMatchObject({state: 'aborted-by-push', from: HEAD, to: OTHER})
	})

	test('a transient gh failure is retried, not fatal', () => {
		const r = run({steps: [{head: HEAD, comments: [bot(fx('summary-reviewed.md'))]}], failFirstCommentsFetch: true}, 'wait', '--interval', '0.05')
		expect(r.code).toBe(0)
		expect(r.json.state).toBe('clean')
		expect(r.stderr).toContain('poll failed (1/5)')
	})

	test('timeout while still pending', () => {
		const r = run({steps: [{head: HEAD, comments: [bot(fx('summary-in-progress.md'))]}]}, 'wait', '--interval', '0.05', '--timeout', '0.2')
		expect(r.code).toBe(30)
		expect(r.json).toMatchObject({state: 'timeout', lastPending: 'CodeRabbit is reviewing new changes'})
	})

	test('rate limited exits 20 with the cooldown', () => {
		const r = run({steps: [{head: OTHER, comments: [bot(fx('summary-rate-limited.md'), '2026-10-20T06:10:00Z')]}]}, 'wait')
		expect(r.code).toBe(20)
		expect(r.json).toMatchObject({state: 'rate-limited', cooldownSeconds: 1380, retryAt: '2026-10-20T06:33:00.000Z'})
	})
})

describe('trigger', () => {
	test('posts when auto reviews are off for the head', () => {
		const r = run({steps: [{head: OTHER, comments: [bot(fx('summary-skipped-with-coverage.md'))]}]}, 'trigger')
		expect(r.json).toMatchObject({action: 'posted', state: 'skipped'})
		expect(r.posted).toContain('--body @coderabbitai review')
	})

	test('does nothing when the head is already reviewed', () => {
		const r = run({steps: [{head: HEAD, comments: [bot(fx('summary-reviewed.md'))]}]}, 'trigger')
		expect(r.json).toMatchObject({action: 'none', state: 'covered'})
		expect(r.posted).toBe('')
	})
})

describe('threads', () => {
	test('compact JSON with severity and title', () => {
		const r = run({steps: [{head: HEAD, comments: []}], threads: [openThread, {...openThread, id: 'PRRT_resolved', isResolved: true}]}, 'threads')
		expect(r.json.count).toBe(1)
		expect(r.json.threads).toEqual([
			expect.objectContaining({id: 'PRRT_x', path: 'src/a.ts', line: 3, severity: '🩺 Stability & Availability | 🟠 Major | ⚡ Quick win', title: 'Create the override directory before setting `userData`.'}),
		])
	})
})

test('usage error exits 2', () => {
	expect(run({steps: []}, 'bogus').code).toBe(2)
})
