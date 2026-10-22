import {describe, expect, it} from 'bun:test'
import {claim, claimableIssues, emptyStore, holder, issuesNamedByPrs, latestDecision, locations, parseTarget, pathsHeldByOthers, release} from '../scripts/store'

const NOW = new Date('2026-10-22T12:00:00Z')
const TTL = 24 * 3600 * 1000
const hoursAgo = (h: number): Date => new Date(NOW.getTime() - h * 3600 * 1000)

describe('parseTarget', () => {
	it('accepts issues, PRs and paths, with #N as an issue', () => {
		expect(parseTarget('#581')).toBe('issue:581')
		expect(parseTarget('issue:581')).toBe('issue:581')
		expect(parseTarget('pr:621')).toBe('pr:621')
		expect(parseTarget('path:src/main/**')).toBe('path:src/main/**')
	})
	it('rejects anything else', () => {
		expect(() => parseTarget('581')).toThrow()
		expect(() => parseTarget('issue:abc')).toThrow()
		expect(() => parseTarget('path:')).toThrow()
	})
})

describe('claim', () => {
	it("records the owner, refuses another session's claim and renews one's own", () => {
		const first = claim(emptyStore(), ['issue:581'], 'local_a', hoursAgo(2), {note: 'link intake'})
		expect(first.refused).toEqual([])
		const second = claim(first.store, ['issue:581', 'issue:600'], 'local_b', NOW)
		expect(second.refused.map(c => [c.target, c.owner])).toEqual([['issue:581', 'local_a']])
		expect(holder(second.store, 'issue:600', NOW, TTL)?.owner).toBe('local_b')
		const renewed = claim(second.store, ['issue:581'], 'local_a', NOW)
		const held = holder(renewed.store, 'issue:581', NOW, TTL)
		expect(held?.renewed).toBe(NOW.toISOString())
		expect(held?.since).toBe(hoursAgo(2).toISOString())
		expect(held?.note).toBe('link intake')
	})
	it('lets another session take a claim that expired', () => {
		const old = claim(emptyStore(), ['issue:581'], 'local_a', hoursAgo(30)).store
		const taken = claim(old, ['issue:581'], 'local_b', NOW, {ttlMs: TTL})
		expect(taken.refused).toEqual([])
		expect(holder(taken.store, 'issue:581', NOW, TTL)?.owner).toBe('local_b')
	})
})

describe('release', () => {
	it("drops one's own claims and keeps others' unless forced", () => {
		let store = claim(emptyStore(), ['issue:1', 'issue:2'], 'local_a', NOW).store
		store = claim(store, ['issue:3'], 'local_b', NOW).store
		expect(release(store, null, 'local_a', false).claims.map(c => c.target)).toEqual(['issue:3'])
		expect(release(store, ['issue:3'], 'local_a', false).claims.map(c => c.target)).toEqual(['issue:1', 'issue:2', 'issue:3'])
		expect(release(store, ['issue:3'], 'local_a', true).claims.map(c => c.target)).toEqual(['issue:1', 'issue:2'])
	})
})

describe('pathsHeldByOthers', () => {
	it("matches files against other sessions' live path claims only", () => {
		let store = claim(emptyStore(), ['path:src/main/services/**'], 'local_a', NOW).store
		store = claim(store, ['path:src/renderer/App.tsx'], 'local_b', NOW).store
		store = claim(store, ['path:docs/**'], 'local_c', hoursAgo(30)).store
		const files = ['src/main/services/DownloadService.ts', 'src/renderer/App.tsx', 'docs/x.md', 'README.md']
		expect(pathsHeldByOthers(store, files, 'local_b', NOW, TTL).map(h => [h.file, h.claim.owner])).toEqual([['src/main/services/DownloadService.ts', 'local_a']])
	})
})

describe('issuesNamedByPrs', () => {
	it('takes closing keywords, not bare mentions', () => {
		const prs = [
			{number: 621, title: 'fix(downloads): x', body: 'Fixes #619\nSee also #500'},
			{number: 627, title: 'fix: y (closes #605)', body: ''},
			{number: 630, title: 'z', body: 'Resolved #12, related to #13'}
		]
		expect([...issuesNamedByPrs(prs)].sort((a, b) => a - b)).toEqual([12, 605, 619])
	})
})

describe('locations', () => {
	it('reads backticked file references, with or without a line', () => {
		expect(locations('**Where**\n`src/main/a.ts:12` and `src/renderer/b.tsx`, not `bun run check`')).toEqual(['src/main/a.ts', 'src/renderer/b.tsx'])
	})
})

describe('claimableIssues', () => {
	it('leaves out claimed issues, issues an open PR fixes, and issues in paths another session holds', () => {
		let store = claim(emptyStore(), ['issue:2'], 'local_a', NOW).store
		store = claim(store, ['path:src/main/**'], 'local_b', NOW).store
		const issues = [
			{number: 1, title: 'free', body: '`src/renderer/x.ts:1`'},
			{number: 2, title: 'claimed', body: ''},
			{number: 3, title: 'has a PR', body: ''},
			{number: 4, title: 'in a held path', body: '**Where**\n`src/main/y.ts:9`'}
		]
		const prs = [{number: 10, title: 't', body: 'Fixes #3'}]
		expect(claimableIssues(issues, prs, store, 'local_a', NOW, TTL).map(i => i.number)).toEqual([1])
		expect(claimableIssues(issues, prs, store, 'local_b', NOW, TTL).map(i => i.number)).toEqual([1, 4])
	})
})

describe('latestDecision', () => {
	it('returns the newest marked decision without its markers', () => {
		const comments = [
			{createdAt: '2026-10-22T08:56:00Z', body: '> *Posted by an agent.*\n<!-- agent:v1 -->\n<!-- decision:v1 -->\n\nTake its video.'},
			{createdAt: '2026-10-22T09:00:00Z', body: 'Unrelated note.'},
			{createdAt: '2026-10-22T11:30:00Z', body: '> *Posted by an agent.*\n<!-- agent:v1 -->\n<!-- decision:v1 -->\n\nAsk on that row.'}
		]
		expect(latestDecision(comments)).toEqual({createdAt: '2026-10-22T11:30:00Z', text: 'Ask on that row.'})
		expect(latestDecision([{createdAt: 'x', body: 'no marker'}])).toBeNull()
	})
})
