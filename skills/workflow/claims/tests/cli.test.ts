import {spawnSync} from 'node:child_process'
import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {afterEach, beforeEach, describe, expect, it} from 'bun:test'

// Drives the real CLI in a scratch clone, against tests/fake-gh/gh.
const CLI = path.join(import.meta.dir, '..', 'scripts', 'claims.ts')
const FAKE_BIN = path.join(import.meta.dir, 'fake-gh')
const GIT_ENV = {GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t'}

let root: string
let repo: string
let ghState: string

const git = (...args: string[]): string => {
	const result = spawnSync('git', args, {cwd: repo, encoding: 'utf8', env: {...process.env, ...GIT_ENV}})
	if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`)
	return result.stdout.trim()
}

function run(owner: string | null, ...args: string[]): {code: number; out: string; err: string} {
	const env: Record<string, string | undefined> = {...process.env, ...GIT_ENV, PATH: `${FAKE_BIN}:${process.env.PATH}`, FAKE_GH_STATE: ghState, CLAUDE_CODE_HOST_SESSION_ID: undefined, CLAIMS_OWNER: owner ?? undefined}
	const result = spawnSync('bun', [CLI, ...args], {cwd: repo, encoding: 'utf8', env})
	return {code: result.status ?? -1, out: result.stdout, err: result.stderr}
}

const setGh = (state: object): Promise<void> => writeFile(ghState, JSON.stringify(state))

beforeEach(async () => {
	root = await mkdtemp(path.join(tmpdir(), 'claims-cli-'))
	const origin = path.join(root, 'origin.git')
	spawnSync('git', ['init', '-q', '--bare', '-b', 'main', origin])
	repo = path.join(root, 'clone')
	spawnSync('git', ['clone', '-q', origin, repo], {env: {...process.env, ...GIT_ENV}})
	await writeFile(path.join(repo, 'a.ts'), 'a\n')
	git('add', '.')
	git('commit', '-qm', 'init')
	git('push', '-q', 'origin', 'main')
	git('remote', 'set-head', 'origin', 'main')
	ghState = path.join(root, 'gh.json')
	await setGh({
		issues: [
			{number: 1, title: 'free', body: '`src/renderer/x.ts:1`', state: 'open', labels: ['ready-for-agent']},
			{number: 2, title: 'in a held path', body: '`src/main/y.ts:2`', state: 'open', labels: ['ready-for-agent']},
			{number: 3, title: 'fixed by a PR', body: '', state: 'open', labels: ['ready-for-agent']},
			{number: 4, title: 'done', body: '', state: 'closed', labels: []},
			{
				number: 5,
				title: 'decided',
				body: '',
				state: 'open',
				labels: [],
				comments: [
					{createdAt: '2026-10-22T08:56:00Z', body: '<!-- decision:v1 -->\nTake its video.'},
					{createdAt: '2026-10-22T11:30:00Z', body: '<!-- decision:v1 -->\nAsk on that row.'}
				]
			}
		],
		prs: [{number: 10, title: 'fix', body: 'Fixes #3', state: 'open'}]
	})
})

afterEach(async () => {
	await rm(root, {recursive: true, force: true})
})

describe('claims CLI', () => {
	it("refuses another session's claim and names its owner", () => {
		expect(run('local_a', 'claim', '#1', '--note', 'drain worker').code).toBe(0)
		const refused = run('local_b', 'claim', '#1')
		expect(refused.code).toBe(1)
		expect(refused.err).toContain('issue:1 is held by local_a')
		expect(run('local_b', 'who', '#1').code).toBe(1)
		expect(run('local_a', 'who', '#1').code).toBe(0)
	})

	it('drops a claim once its issue is closed', async () => {
		expect(run('local_a', 'claim', '#1').code).toBe(0)
		expect(run(null, 'list').out).toContain('issue:1  local_a')
		await setGh({issues: [{number: 1, title: 'free', body: '', state: 'closed'}], prs: []})
		expect(run(null, 'list').out).toBe('')
		expect(run('local_b', 'who', '#1').out).toContain('issue:1 is free')
	})

	it('gives a target to exactly one of several sessions claiming at once', async () => {
		const env = (owner: string): Record<string, string | undefined> => ({...process.env, ...GIT_ENV, PATH: `${FAKE_BIN}:${process.env.PATH}`, FAKE_GH_STATE: ghState, CLAUDE_CODE_HOST_SESSION_ID: undefined, CLAIMS_OWNER: owner})
		const racers = ['local_a', 'local_b', 'local_c', 'local_d'].map(owner => Bun.spawn(['bun', CLI, 'claim', '#1'], {cwd: repo, env: env(owner), stdout: 'ignore', stderr: 'ignore'}).exited)
		const codes = await Promise.all(racers)
		expect(codes.filter(c => c === 0)).toHaveLength(1)
		expect(codes.filter(c => c === 1)).toHaveLength(3)
	})

	it('needs an owner to claim', () => {
		const result = run(null, 'claim', '#1')
		expect(result.code).toBe(2)
		expect(result.err).toContain('CLAIMS_OWNER')
	})

	it("lists only issues nobody holds, no PR fixes and no other session's path covers", () => {
		expect(run('local_b', 'claim', 'path:src/main/**').code).toBe(0)
		expect(run('local_a', 'claimable').out.trim()).toBe('#1 free')
		expect(run('local_b', 'claimable').out.trim()).toBe('#1 free\n#2 in a held path')
	})

	it("refuses a branch that changes files another session holds, and passes one's own", async () => {
		git('checkout', '-qb', 'work')
		await writeFile(path.join(repo, 'a.ts'), 'changed\n')
		git('commit', '-qam', 'edit')
		expect(run('local_b', 'claim', 'path:a.ts').code).toBe(0)
		const blocked = run('local_a', 'check-paths')
		expect(blocked.code).toBe(1)
		expect(blocked.err).toContain('a.ts')
		expect(blocked.err).toContain('local_b')
		expect(run('local_b', 'check-paths').code).toBe(0)
	})

	it('prints the latest recorded decision on an issue', () => {
		const result = run(null, 'decision', '5')
		expect(result.code).toBe(0)
		expect(result.out).toContain('Ask on that row.')
		expect(result.out).not.toContain('Take its video.')
		expect(run(null, 'decision', '1').code).toBe(1)
	})
})
