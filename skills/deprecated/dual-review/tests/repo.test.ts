import {afterEach, beforeEach, describe, expect, it} from 'bun:test'
import {spawnSync} from 'node:child_process'
import {mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'

import {gitIn, type Git} from '../scripts/git'
import {LEARNINGS_FILE, defaultBranch, describeProject, firstParagraph, readLearnings, refExists, repoName, reviewDir} from '../scripts/repo'

const ENV = {...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t'}

let root: string
let repo: string
let git: Git

const sh = (cwd: string, ...args: string[]): string => {
	const result = spawnSync('git', args, {cwd, encoding: 'utf8', env: ENV})
	if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`)
	return result.stdout.trim()
}

beforeEach(() => {
	root = realpathSync(mkdtempSync(path.join(tmpdir(), 'dual-review-repo-')))
	repo = path.join(root, 'widget')
	mkdirSync(repo)
	sh(repo, 'init', '-q', '-b', 'trunk')
	writeFileSync(path.join(repo, 'a.txt'), 'a\n')
	sh(repo, 'add', '-A')
	sh(repo, 'commit', '-qm', 'initial')
	git = gitIn(repo, ENV)
})

afterEach(() => rmSync(root, {recursive: true, force: true}))

describe('firstParagraph', () => {
	it('skips frontmatter, headings, badges, imports and code, and joins the paragraph', () => {
		const md = ['---', 'name: x', '---', '', '# Widget', '', '[![CI](https://x/badge.svg)](https://x)', '<p align="center"><img src="logo.png"></p>', '@~/.agents/AGENTS.md', '', '```bash', 'npm i widget', '```', '', 'Widget renders charts', 'from CSV files.', '', 'Second paragraph.'].join('\n')
		expect(firstParagraph(md)).toBe('Widget renders charts from CSV files.')
	})

	it('treats a setext heading as a heading', () => {
		expect(firstParagraph('Widget\n======\n\nRenders charts.\n')).toBe('Renders charts.')
	})

	it('returns null when there is no prose, and shortens a very long paragraph', () => {
		expect(firstParagraph('# Title\n\n| a | b |\n|---|---|\n')).toBeNull()
		const long = firstParagraph('word '.repeat(400))
		expect(long?.length).toBe(600)
		expect(long?.endsWith('…')).toBe(true)
	})
})

describe('describeProject', () => {
	it('prefers AGENTS.md, then CLAUDE.md, then README.md', async () => {
		writeFileSync(path.join(repo, 'README.md'), '# Widget\n\nFrom the readme.\n')
		expect(await describeProject(repo, 'widget')).toEqual({name: 'widget', summary: 'From the readme.', source: 'README.md'})
		writeFileSync(path.join(repo, 'CLAUDE.md'), 'From claude.\n')
		expect((await describeProject(repo, 'widget')).source).toBe('CLAUDE.md')
		writeFileSync(path.join(repo, 'AGENTS.md'), '# Rules\n\nFrom agents.\n')
		expect(await describeProject(repo, 'widget')).toMatchObject({summary: 'From agents.', source: 'AGENTS.md'})
	})

	it('falls through a file with no paragraph, and to the name alone when none has one', async () => {
		writeFileSync(path.join(repo, 'CLAUDE.md'), '@AGENTS.md\n')
		expect(await describeProject(repo, 'widget')).toEqual({name: 'widget', summary: null, source: null})
		writeFileSync(path.join(repo, 'README.md'), 'From the readme.\n')
		expect((await describeProject(repo, 'widget')).source).toBe('README.md')
	})
})

describe('defaultBranch', () => {
	it('reads the remote default branch from origin/HEAD', () => {
		const origin = path.join(root, 'origin.git')
		sh(root, 'clone', '-q', '--bare', repo, origin)
		const clone = path.join(root, 'clone')
		sh(root, 'clone', '-q', origin, clone)
		const cloneGit = gitIn(clone, ENV)
		expect(defaultBranch(cloneGit)).toEqual({branch: 'trunk', remoteRef: 'origin/trunk'})
		expect(refExists(cloneGit, 'origin/trunk')).toBe(true)
	})

	it('falls back to main without origin/HEAD', () => {
		expect(defaultBranch(git)).toEqual({branch: 'main', remoteRef: 'origin/main'})
		expect(refExists(git, 'origin/main')).toBe(false)
		sh(repo, 'update-ref', 'refs/remotes/origin/develop', 'HEAD')
		sh(repo, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/develop')
		expect(defaultBranch(git).remoteRef).toBe('origin/develop')
	})
})

describe('repoName', () => {
	it('takes the origin URL’s last segment, whatever its form', () => {
		sh(repo, 'remote', 'add', 'origin', 'placeholder')
		for (const url of ['git@github.com:acme/widget.git', 'https://github.com/acme/widget', 'https://github.com/acme/widget.git/', 'github-alias:acme/widget.git']) {
			sh(repo, 'remote', 'set-url', 'origin', url)
			expect(repoName(git, repo)).toBe('widget')
		}
	})

	it('names a linked worktree after the main checkout when there is no origin', () => {
		const worktree = path.join(root, 'fix-branch')
		sh(repo, 'worktree', 'add', '-q', '-b', 'fix', worktree)
		expect(repoName(gitIn(worktree, ENV), worktree)).toBe('widget')
	})
})

describe('reviewDir', () => {
	it('lives in each worktree’s own git dir, outside the working tree', () => {
		expect(reviewDir(git)).toBe(path.join(repo, '.git', 'dual-review'))
		const worktree = path.join(root, 'wt')
		sh(repo, 'worktree', 'add', '-q', '-b', 'wt', worktree)
		const dir = reviewDir(gitIn(worktree, ENV))
		expect(dir).toBe(path.join(repo, '.git', 'worktrees', 'wt', 'dual-review'))
		expect(dir.startsWith(worktree)).toBe(false)
	})
})

describe('readLearnings', () => {
	const repoFile = () => path.join(repo, LEARNINGS_FILE)

	it('is empty when neither file exists', async () => {
		expect(await readLearnings(repo, undefined)).toEqual({text: '', sources: []})
		expect(await readLearnings(repo, path.join(root, 'missing.md'))).toEqual({text: '', sources: []})
	})

	it('reads the repository file without its frontmatter, then the extra file', async () => {
		mkdirSync(path.dirname(repoFile()), {recursive: true})
		writeFileSync(repoFile(), '---\nname: review-learnings\n---\n\n- Repo rule.\n')
		const extra = path.join(root, 'mine.md')
		writeFileSync(extra, '- My rule.\n')
		expect(await readLearnings(repo, extra)).toEqual({text: '- Repo rule.\n\n- My rule.', sources: [repoFile(), extra]})
		expect(await readLearnings(repo, repoFile())).toEqual({text: '- Repo rule.', sources: [repoFile()]})
	})

	it('reads the extra file alone when the repository has none', async () => {
		const extra = path.join(root, 'mine.md')
		writeFileSync(extra, '- My rule.\n')
		expect(await readLearnings(repo, extra)).toEqual({text: '- My rule.', sources: [extra]})
	})
})
