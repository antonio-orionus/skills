import {spawnSync} from 'node:child_process'
import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {afterEach, beforeEach, describe, expect, it} from 'bun:test'
import {gitIn, revertedFiles, type Git} from '../scripts/git'
import {checkReviewed, recordReviewed, reviewedSnapshot, statePath} from '../scripts/reviewedState'

const CHECK_HEAD = path.join(import.meta.dir, '..', 'scripts', 'check-head.ts')

const ENV = {...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t'}

let root: string
let origin: string
let clone: string
let git: Git

const sh = (cwd: string, ...args: string[]): string => {
	const result = spawnSync('git', args, {cwd, encoding: 'utf8', env: ENV})
	if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`)
	return result.stdout.trim()
}

// Lands a commit on origin's main the way a merged PR would, from a second clone.
async function landOnMain(files: Record<string, string | null>, message: string): Promise<void> {
	const other = path.join(root, 'other')
	sh(other, 'pull', '-q', 'origin', 'main')
	for (const [file, content] of Object.entries(files)) {
		if (content === null) sh(other, 'rm', '-q', file)
		else await writeFile(path.join(other, file), content)
	}
	sh(other, 'add', '-A')
	sh(other, 'commit', '-qm', message)
	sh(other, 'push', '-q', 'origin', 'main')
}

async function commit(files: Record<string, string>, message: string): Promise<void> {
	for (const [file, content] of Object.entries(files)) await writeFile(path.join(clone, file), content)
	sh(clone, 'add', '-A')
	sh(clone, 'commit', '-qm', message)
}

beforeEach(async () => {
	root = await mkdtemp(path.join(tmpdir(), 'dual-review-state-'))
	origin = path.join(root, 'origin.git')
	clone = path.join(root, 'clone')
	sh(root, 'init', '-q', '--bare', '-b', 'main', origin)
	sh(root, 'clone', '-q', origin, 'other')
	sh(path.join(root, 'other'), 'switch', '-qc', 'main')
	await writeFile(path.join(root, 'other', 'a.txt'), 'a1\n')
	await writeFile(path.join(root, 'other', 'b.txt'), 'b1\n')
	sh(path.join(root, 'other'), 'add', '-A')
	sh(path.join(root, 'other'), 'commit', '-qm', 'initial')
	sh(path.join(root, 'other'), 'push', '-q', 'origin', 'main')
	sh(root, 'clone', '-q', origin, 'clone')
	sh(clone, 'switch', '-qc', 'feat/x')
	git = gitIn(clone, ENV)
})

afterEach(async () => {
	await rm(root, {recursive: true, force: true})
})

// The stale-squash sequence: two branch commits, main moves on, then a squash by
// `reset --soft origin/main` re-parents the stale index onto the new main.
async function staleSquash(): Promise<void> {
	await commit({'mine.txt': 'mine\n'}, 'feat: one')
	await commit({'mine.txt': 'mine 2\n'}, 'feat: two')
	await landOnMain({'a.txt': 'a2\n', 'new.txt': 'added on main\n'}, 'fix: other lane')
	sh(clone, 'fetch', '-q', 'origin')
	sh(clone, 'reset', '-q', '--soft', 'origin/main')
	sh(clone, 'commit', '-qm', 'feat: squashed')
}

describe('revertedFiles', () => {
	it('catches the stale-index squash that a two-dot/three-dot comparison misses', async () => {
		await staleSquash()
		const twoDot = sh(clone, 'diff', '--name-only', 'origin/main', 'HEAD')
		const threeDot = sh(clone, 'diff', '--name-only', 'origin/main...HEAD')
		expect(twoDot).toBe(threeDot)
		expect(revertedFiles(git, 'origin/main', 'HEAD').map(r => [r.file, r.undoes])).toEqual([
			['a.txt', expect.stringMatching(/fix: other lane/)],
			['new.txt', expect.stringMatching(/fix: other lane/)]
		])
	})

	it('still catches it after main moves on again', async () => {
		await staleSquash()
		await landOnMain({'b.txt': 'b2\n'}, 'fix: third lane')
		sh(clone, 'fetch', '-q', 'origin')
		expect(revertedFiles(git, 'origin/main', 'HEAD').map(r => r.file)).toEqual(['a.txt', 'new.txt'])
	})

	it('passes a branch that is only behind main', async () => {
		await commit({'mine.txt': 'mine\n'}, 'feat: one')
		await landOnMain({'a.txt': 'a2\n'}, 'fix: other lane')
		sh(clone, 'fetch', '-q', 'origin')
		expect(revertedFiles(git, 'origin/main', 'HEAD')).toEqual([])
	})

	it('passes a squash onto the merge-base', async () => {
		await commit({'mine.txt': 'mine\n'}, 'feat: one')
		await commit({'mine.txt': 'mine 2\n'}, 'feat: two')
		await landOnMain({'a.txt': 'a2\n'}, 'fix: other lane')
		sh(clone, 'fetch', '-q', 'origin')
		sh(clone, 'reset', '-q', '--soft', sh(clone, 'merge-base', 'origin/main', 'HEAD'))
		sh(clone, 'commit', '-qm', 'feat: squashed')
		expect(revertedFiles(git, 'origin/main', 'HEAD')).toEqual([])
	})

	it('passes an edit that does not restore an earlier version', async () => {
		await landOnMain({'a.txt': 'a2\n'}, 'fix: other lane')
		sh(clone, 'pull', '-q', '--rebase', 'origin', 'main')
		await commit({'a.txt': 'a3\n'}, 'feat: edit a')
		expect(revertedFiles(git, 'origin/main', 'HEAD')).toEqual([])
	})

	it('passes deleting a file main added and then edited on its own', async () => {
		await landOnMain({'doc.txt': 'v1\n', 'a.txt': 'a2\n'}, 'feat: add doc')
		await landOnMain({'doc.txt': 'v2\n'}, 'docs: edit doc')
		await landOnMain({'note.txt': 'note\n'}, 'docs: add note')
		sh(clone, 'pull', '-q', '--rebase', 'origin', 'main')
		sh(clone, 'rm', '-q', 'doc.txt', 'note.txt')
		sh(clone, 'commit', '-qm', 'chore: retire doc and note')
		expect(revertedFiles(git, 'origin/main', 'HEAD')).toEqual([])
	})

	it('flags a deliberate revert too', async () => {
		await landOnMain({'a.txt': 'a2\n'}, 'fix: other lane')
		sh(clone, 'pull', '-q', '--rebase', 'origin', 'main')
		await commit({'a.txt': 'a1\n'}, 'revert: other lane')
		expect(revertedFiles(git, 'origin/main', 'HEAD').map(r => r.file)).toEqual(['a.txt'])
	})
})

describe('reviewed state', () => {
	const review = (commit = 'HEAD') => recordReviewed(git, reviewedSnapshot(git, 'origin/main', commit))
	const check = () => checkReviewed(git, 'origin/main')
	const changed = {ok: false, reason: expect.stringMatching(/changed since the review/)}

	it('passes a clean rebase and a merge of main, and refuses the stale squash', async () => {
		await commit({'mine.txt': 'mine\n'}, 'feat: one')
		await review()
		await landOnMain({'a.txt': 'a2\n'}, 'fix: other lane')
		sh(clone, 'fetch', '-q', 'origin')
		sh(clone, 'rebase', '-q', 'origin/main')
		expect(await check()).toEqual({ok: true})

		sh(clone, 'reset', '-q', '--hard', 'ORIG_HEAD')
		sh(clone, 'merge', '-q', '--no-edit', 'origin/main')
		expect(await check()).toEqual({ok: true})

		sh(clone, 'reset', '-q', '--hard', 'ORIG_HEAD')
		sh(clone, 'reset', '-q', '--soft', 'origin/main')
		sh(clone, 'commit', '-qm', 'feat: squashed')
		expect(await check()).toEqual(changed)
	})

	it('tells the same edit apart by where it sits', async () => {
		const src = (a: string, b: string) => `function a() {\n\treturn ${a}\n}\n\nfunction b() {\n\treturn ${b}\n}\n`
		await landOnMain({'f.ts': src('true', 'true')}, 'feat: f')
		sh(clone, 'pull', '-q', '--rebase', 'origin', 'main')
		await commit({'f.ts': src('false', 'true')}, 'fix: a')
		await review()
		sh(clone, 'reset', '-q', '--hard', 'HEAD~1')
		await commit({'f.ts': src('true', 'false')}, 'fix: b')
		expect(await check()).toEqual(changed)
	})

	it('tells apart repeated blocks whose surrounding lines are identical', async () => {
		const block = (value: string) => ['\tif (x) {', '\t\tone()', '\t\ttwo()', '\t\tthree()', `\t\treturn ${value}`, '\t\tfour()', '\t\tfive()', '\t\tsix()', '\t}']
		const src = (first: string, second: string) => ['function f(x) {', '\tif (mode === 1) {', ...block(first), '\t}', '\tif (mode === 2) {', ...block(second), '\t}', '}', ''].join('\n')
		await landOnMain({'f.ts': src('true', 'true')}, 'feat: f')
		sh(clone, 'pull', '-q', '--rebase', 'origin', 'main')
		await commit({'f.ts': src('false', 'true')}, 'fix: first')
		await review()
		sh(clone, 'reset', '-q', '--hard', 'HEAD~1')
		await commit({'f.ts': src('true', 'false')}, 'fix: second')
		expect(await check()).toEqual(changed)
	})

	it('passes a rebase over main editing the same file elsewhere, and refuses a hand-resolved conflict', async () => {
		const lines = (top: string, bottom: string) => [top, ...Array.from({length: 20}, (_, i) => `line ${i}`), bottom, ''].join('\n')
		await landOnMain({'f.txt': lines('top', 'bottom')}, 'feat: f')
		sh(clone, 'pull', '-q', '--rebase', 'origin', 'main')
		await commit({'f.txt': lines('top', 'bottom edited')}, 'fix: bottom')
		await review()
		await landOnMain({'f.txt': lines('top edited\nadded', 'bottom')}, 'fix: top')
		sh(clone, 'pull', '-q', '--rebase', 'origin', 'main')
		expect(await check()).toEqual({ok: true})

		await landOnMain({'f.txt': lines('top edited\nadded', 'bottom from main')}, 'fix: bottom on main')
		sh(clone, 'fetch', '-q', 'origin')
		spawnSync('git', ['rebase', '-q', 'origin/main'], {cwd: clone, env: ENV})
		await writeFile(path.join(clone, 'f.txt'), lines('top edited\nadded', 'bottom edited'))
		sh(clone, 'add', 'f.txt')
		sh(clone, '-c', 'core.editor=true', 'rebase', '--continue')
		expect(await check()).toMatchObject({ok: false, reason: expect.stringMatching(/does not replay cleanly/)})
	})

	it('records the commit the review started on, not one that landed while it ran', async () => {
		await commit({'mine.txt': 'mine\n'}, 'feat: one')
		const started = reviewedSnapshot(git, 'origin/main', 'HEAD')
		await commit({'mine.txt': 'mine 2\n'}, 'fix: landed during review')
		await recordReviewed(git, started)
		expect(await check()).toEqual(changed)
		sh(clone, 'reset', '-q', '--hard', 'HEAD~1')
		expect(await check()).toEqual({ok: true})
	})

	it('refuses an unreviewed branch and a change made after review', async () => {
		await commit({'mine.txt': 'mine\n'}, 'feat: one')
		expect(await check()).toMatchObject({ok: false, reason: expect.stringMatching(/no review recorded/)})
		await review()
		expect(await check()).toEqual({ok: true})
		await commit({'mine.txt': 'mine 2\n'}, 'fix: after review')
		expect(await check()).toEqual(changed)
	})

	it("check-head refuses a reviewed head that changes files another session claims", async () => {
		const claims = path.join(import.meta.dir, '..', '..', 'claims', 'scripts', 'claims.ts')
		const as = (owner: string) => ({...ENV, CLAUDE_CODE_HOST_SESSION_ID: undefined, CLAIMS_OWNER: owner})
		await commit({'mine.txt': 'mine\n'}, 'feat: one')
		await review()
		expect(spawnSync(process.execPath, [claims, 'claim', 'path:mine.txt', '--note', 'queue fix'], {cwd: clone, encoding: 'utf8', env: as('local_other')}).status).toBe(0)
		const mine = spawnSync(process.execPath, [CHECK_HEAD], {cwd: clone, encoding: 'utf8', env: as('local_me')})
		expect(mine).toMatchObject({status: 1, stderr: expect.stringMatching(/mine\.txt\s+held by local_other/)})
		expect(spawnSync(process.execPath, [CHECK_HEAD], {cwd: clone, encoding: 'utf8', env: as('local_other')}).status).toBe(0)
	})

	it('check-head passes only the reviewed head, and names the files it pushes', async () => {
		const checkHead = () => spawnSync(process.execPath, [CHECK_HEAD], {cwd: clone, encoding: 'utf8', env: ENV})
		await commit({'mine.txt': 'mine\n'}, 'feat: one')
		expect(checkHead()).toMatchObject({status: 1, stderr: expect.stringMatching(/no review recorded/)})
		await review()
		expect(checkHead()).toMatchObject({status: 0, stdout: expect.stringMatching(/mine\.txt/)})

		await commit({'mine.txt': 'mine 2\n'}, 'feat: two')
		await review()
		await landOnMain({'a.txt': 'a2\n'}, 'fix: other lane')
		sh(clone, 'fetch', '-q', 'origin')
		sh(clone, 'reset', '-q', '--soft', 'origin/main')
		sh(clone, 'commit', '-qm', 'feat: squashed')
		expect(checkHead()).toMatchObject({status: 1, stderr: expect.stringMatching(/undoes 1 file[\s\S]*a\.txt/)})
	})

	it('keeps the record in the worktree’s git dir, and refuses a record it cannot read', async () => {
		await commit({'mine.txt': 'mine\n'}, 'feat: one')
		await review()
		expect(statePath(git)).toBe(path.join(sh(clone, 'rev-parse', '--absolute-git-dir'), 'dual-review', 'reviewed.json'))
		expect(sh(clone, 'status', '--porcelain')).toBe('')
		await writeFile(statePath(git), '{"head": 1}')
		expect(await check()).toMatchObject({ok: false, reason: expect.stringMatching(/unreadable review record/)})
	})
})

describe('check-head on a repository whose default branch is not main', () => {
	it('fetches and measures against origin/HEAD’s branch', async () => {
		const other = path.join(root, 'other')
		sh(other, 'switch', '-qc', 'trunk')
		sh(other, 'push', '-q', 'origin', 'trunk')
		sh(origin, 'symbolic-ref', 'HEAD', 'refs/heads/trunk')
		sh(origin, 'branch', '-qD', 'main')
		const fresh = path.join(root, 'fresh')
		sh(root, 'clone', '-q', origin, 'fresh')
		sh(fresh, 'switch', '-qc', 'feat/y')
		await writeFile(path.join(fresh, 'mine.txt'), 'mine\n')
		sh(fresh, 'add', '-A')
		sh(fresh, 'commit', '-qm', 'feat: one')
		const freshGit = gitIn(fresh, ENV)
		await recordReviewed(freshGit, reviewedSnapshot(freshGit, 'origin/trunk', 'HEAD'))
		const result = spawnSync(process.execPath, [CHECK_HEAD], {cwd: fresh, encoding: 'utf8', env: ENV})
		expect(result).toMatchObject({status: 0, stdout: expect.stringContaining('against origin/trunk'), stderr: expect.stringContaining('undoes nothing on trunk')})
	})
})
