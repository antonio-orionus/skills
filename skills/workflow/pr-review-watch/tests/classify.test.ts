import {describe, expect, test} from 'bun:test'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {
	DEFAULT_BOTS,
	type IssueComment,
	type Review,
	type Snapshot,
	classify,
	compactThreadBody,
	decideTrigger,
	findingsOrClean,
	headReviewCounts,
	isBot,
	parseCommandReply,
	parseCooldownSeconds,
	parseCoveredCommit,
	parseReviewCounts,
	parseSkip,
	parseSummary,
} from '../scripts/classify'

// Fixtures are real CodeRabbit comment bodies from antonio-orionus/arroxy PRs
// (link scope tokens and org ids redacted).
const fx = (name: string): string => readFileSync(join(import.meta.dir, 'fixtures', name), 'utf8')

const BOT = 'coderabbitai[bot]'
const ME = 'antonio-orionus'
const HEAD = '90ba71610e3e15ee262a701fbe94ad64cef9ce06'
const OLD = '5fb9d4bf45435d3c5dd51804f10ccf967f192dfa'
const T0 = '2026-10-20T06:00:00Z' // head committed
const T1 = '2026-10-20T06:05:00Z'
const T2 = '2026-10-20T06:10:00Z'

let nextId = 1
const comment = (login: string, body: string, createdAt = T1, updatedAt = createdAt): IssueComment => ({id: nextId++, login, body, createdAt, updatedAt})
const summary = (name: string, updatedAt = T1): IssueComment => comment(BOT, fx(name), '2026-10-19T00:00:00Z', updatedAt)
const trigger = (createdAt = T1): IssueComment => comment(ME, '@coderabbitai review', createdAt)
const reply = (name: string, createdAt = T2): IssueComment => comment(BOT, fx(name), createdAt)

function snap(comments: IssueComment[], over: Partial<Snapshot['pr']> = {}, reviews: Review[] = []): Snapshot {
	return {
		pr: {number: 1, url: 'u', state: 'OPEN', isDraft: false, headSha: HEAD, headCommittedAt: T0, ...over},
		comments,
		reviews,
		bots: DEFAULT_BOTS,
		now: T2,
	}
}

describe('bot logins', () => {
	test('REST and GraphQL spellings match the default list', () => {
		for (const login of ['coderabbitai', 'coderabbitai[bot]', 'coderabbit[bot]', 'CodeRabbitAI']) expect(isBot(login, DEFAULT_BOTS)).toBe(true)
		expect(isBot('antonio-orionus', DEFAULT_BOTS)).toBe(false)
	})
	test('list is configurable', () => {
		expect(isBot('copilot-pull-request-reviewer[bot]', [...DEFAULT_BOTS, 'copilot-pull-request-reviewer'])).toBe(true)
	})
})

describe('summary comment parsing', () => {
	test('reviewed summary exposes the covered commit', () => {
		const s = parseSummary(summary('summary-reviewed.md'))
		expect(s.coveredCommit).toBe(HEAD)
		expect(s.inProgress).toBe(false)
		expect(s.rateLimited).toBe(false)
		expect(s.skip).toBeNull()
	})
	test('auto-review-disabled skip with no prior review', () => {
		const s = parseSummary(summary('summary-skipped-auto-disabled.md'))
		expect(s.coveredCommit).toBeNull()
		expect(s.skip?.kind).toBe('auto-review-disabled')
		expect(s.skip?.reason).toStartWith('Auto reviews are disabled')
	})
	test('skip block alongside an older review keeps that review commit', () => {
		const s = parseSummary(summary('summary-skipped-with-coverage.md'))
		expect(s.coveredCommit).toBe(OLD)
		expect(s.skip?.kind).toBe('auto-review-disabled')
	})
	test('rate-limited summary with cooldown', () => {
		const s = parseSummary(summary('summary-rate-limited.md'))
		expect(s.rateLimited).toBe(true)
		expect(s.cooldownSeconds).toBe(23 * 60)
		expect(s.coveredCommit).toBeNull() // the "between A and B" range is the attempted one, not covered
	})
	test('rate-limit block over an older walkthrough', () => {
		const s = parseSummary(summary('summary-rate-limited-with-walkthrough.md'))
		expect(s.rateLimited).toBe(true)
		expect(s.cooldownSeconds).toBe(44 * 60)
		expect(s.coveredCommit).toBe('0868505d47959028e01e208ce017b5dc33caac43')
	})
	test('in-progress summary', () => {
		const s = parseSummary(summary('summary-in-progress.md'))
		expect(s.inProgress).toBe(true)
		expect(s.coveredCommit).toBeNull()
	})
	test('older recent-review range format', () => {
		const sha = 'a'.repeat(40)
		expect(parseCoveredCommit(`<!-- recent_review_start -->\nReviewing files that changed from the base of the PR and between ${'b'.repeat(40)} and ${sha}.\n<!-- recent_review_end -->`)).toBe(sha)
	})
	test('draft and too-many-files skip reasons (wording synthesized)', () => {
		expect(parseSkip('> [!IMPORTANT]\n> ## Review skipped\n> \n> Draft detected.\n> \n> <details>')?.kind).toBe('draft')
		expect(parseSkip('> ## Review skipped\n> \n> 348 files exceed the limit of 100.\n')).toMatchObject({kind: 'too-many-files', files: 348, limit: 100})
	})
})

describe('cooldown text', () => {
	test.each([
		['**Next included review available in 23 minutes.**', 1380],
		['**Next included review available in 1 hour and 5 minutes.**', 3900],
		['Please wait **12 minutes and 5 seconds** before requesting another review.', 725],
		['no number here', null],
	])('%s', (text, seconds) => expect(parseCooldownSeconds(text)).toBe(seconds))
})

describe('review command replies', () => {
	test.each([
		['reply-finished.md', {kind: 'finished', full: false}],
		['reply-full-finished.md', {kind: 'finished', full: true}],
		['reply-failed.md', {kind: 'failed'}],
		['reply-rate-limited.md', {kind: 'rate-limited'}],
		['reply-too-many-files.md', {kind: 'too-many-files', files: 123, limit: 100}],
		['reply-head-changed.md', {kind: 'head-changed'}],
		['reply-base-or-head-changed.md', {kind: 'head-changed'}],
		['reply-already-reviewed.md', {kind: 'already-reviewed'}],
		['reply-closed.md', {kind: 'closed'}],
	])('%s', (name, expected) => expect(parseCommandReply(fx(name))).toEqual(expected as never))

	test('an unedited placeholder reply is pending', () => {
		const body = '<!-- This is an auto-generated reply by CodeRabbit -->\n<!-- CodeRabbit review command invocation: v2:x -->\n<details>\n<summary>✅ Actions performed</summary>\n\nReview triggered.\n\n</details>'
		expect(parseCommandReply(body).kind).toBe('pending')
	})
})

describe('review bodies', () => {
	test('actionable count from a real review', () => {
		expect(parseReviewCounts(fx('review-actionable.md'))).toEqual({actionable: 1, nitpicks: 0, outsideDiff: 0, duplicates: 0})
	})
	test('nitpick and outside-diff sections (wording from CodeRabbit docs)', () => {
		const body = '**Actionable comments posted: 0**\n<details>\n<summary>🧹 Nitpick comments (3)</summary>\n</details>\n<details>\n<summary>⚠️ Outside diff range comments (2)</summary>'
		expect(parseReviewCounts(body)).toEqual({actionable: 0, nitpicks: 3, outsideDiff: 2, duplicates: 0})
	})
})

describe('classify', () => {
	test('head covered by the summary', () => {
		expect(classify(snap([summary('summary-reviewed.md')]))).toEqual({state: 'covered', commit: HEAD})
	})

	test('head covered by a review on the head commit even before the summary updates', () => {
		const r: Review = {login: 'coderabbitai', commitId: HEAD, body: fx('review-actionable.md'), submittedAt: T2}
		expect(classify(snap([summary('summary-skipped-with-coverage.md')], {}, [r])).state).toBe('covered')
	})

	test('push after the reviewed commit: auto reviews disabled -> skipped', () => {
		const s = classify(snap([summary('summary-skipped-with-coverage.md')]))
		expect(s).toMatchObject({state: 'skipped', reason: 'auto-review-disabled'})
	})

	test('stale summary (older than the head commit) is not trusted for skip/limit', () => {
		expect(classify(snap([summary('summary-rate-limited.md', '2026-10-19T23:00:00Z')])).state).toBe('pending')
	})

	test('in progress', () => {
		expect(classify(snap([summary('summary-in-progress.md')])).state).toBe('pending')
	})

	test('rate limited from the summary, with retry time', () => {
		expect(classify(snap([summary('summary-rate-limited.md', T1)]))).toEqual({
			state: 'rate-limited',
			cooldownSeconds: 1380,
			retryAt: '2026-10-20T06:28:00.000Z',
			source: 'summary',
		})
	})

	test('fresh trigger with no reply yet is pending even if the summary says skipped', () => {
		expect(classify(snap([summary('summary-skipped-auto-disabled.md'), trigger()])).state).toBe('pending')
	})

	test('trigger -> rate limited reply, cooldown taken from the summary', () => {
		const s = classify(snap([summary('summary-rate-limited.md', T2), trigger(), reply('reply-rate-limited.md')]))
		expect(s).toMatchObject({state: 'rate-limited', cooldownSeconds: 1380, source: 'reply'})
	})

	test.each([
		['reply-failed.md', {state: 'review-failed'}],
		['reply-too-many-files.md', {state: 'too-many-files', files: 123, limit: 100}],
		['reply-closed.md', {state: 'skipped', reason: 'closed'}],
		['reply-finished.md', {state: 'covered'}],
		['reply-already-reviewed.md', {state: 'covered'}],
		['reply-head-changed.md', {state: 'aborted-by-push'}],
	])('trigger -> %s', (name, expected) => {
		expect(classify(snap([summary('summary-skipped-auto-disabled.md'), trigger(), reply(name)]))).toMatchObject(expected)
	})

	test('a trigger posted before the head commit is ignored', () => {
		const s = classify(snap([summary('summary-skipped-auto-disabled.md'), trigger('2026-10-19T12:00:00Z'), reply('reply-failed.md', '2026-10-19T12:01:00Z')]))
		expect(s).toMatchObject({state: 'skipped', reason: 'auto-review-disabled'})
	})

	test('head moved while waiting', () => {
		expect(classify(snap([summary('summary-reviewed.md')]), {initialHead: OLD})).toEqual({state: 'aborted-by-push', from: OLD, to: HEAD})
	})

	test('merged without a review of the head', () => {
		expect(classify(snap([summary('summary-in-progress.md')], {state: 'MERGED'}))).toMatchObject({state: 'skipped', reason: 'merged'})
	})

	test('merged after a rate-limited trigger reports merged, not rate-limited', () => {
		const s = classify(snap([summary('summary-rate-limited.md', T2), trigger(), reply('reply-rate-limited.md')], {state: 'MERGED'}))
		expect(s).toMatchObject({state: 'skipped', reason: 'merged'})
	})

	test('draft with no summary', () => {
		expect(classify(snap([], {isDraft: true}))).toMatchObject({state: 'skipped', reason: 'draft'})
	})

	test('no summary yet on an open PR keeps waiting', () => {
		expect(classify(snap([])).state).toBe('pending')
	})

	test('bot comments that mention the trigger phrase are not triggers', () => {
		const s = classify(snap([comment(BOT, 'invoke the `@coderabbitai review` command', T1)]))
		expect(s.state).toBe('pending')
	})
})

describe('findings vs clean', () => {
	test('open threads -> findings', () => expect(findingsOrClean({unresolvedThreads: 2, headReview: null})).toBe('findings'))
	test('all threads resolved -> clean', () => {
		const r: Review = {login: BOT, commitId: HEAD, body: fx('review-actionable.md'), submittedAt: T2}
		expect(findingsOrClean({unresolvedThreads: 0, headReview: headReviewCounts(snap([], {}, [r]))})).toBe('clean')
	})
	test('nitpicks only in the review body -> findings', () => {
		expect(findingsOrClean({unresolvedThreads: 0, headReview: {actionable: 0, nitpicks: 2, outsideDiff: 0, duplicates: 0}})).toBe('findings')
	})
	test('no review object at all (clean CodeRabbit run) -> clean', () => expect(findingsOrClean({unresolvedThreads: 0, headReview: null})).toBe('clean'))
})

describe('thread body compaction', () => {
	test('real thread root: severity, title, no hidden blocks', () => {
		const c = compactThreadBody(fx('thread-root.md'))
		expect(c.severity).toBe('🩺 Stability & Availability | 🟠 Major | ⚡ Quick win')
		expect(c.title).toBe('Create the override directory before setting `userData`.')
		expect(c.text).not.toContain('<details>')
		expect(c.text).not.toContain('Prompt for AI Agents')
		expect(c.text).not.toContain('<!--')
	})
})

describe('trigger decision', () => {
	test('covered head: do not post', () => expect(decideTrigger({state: 'covered', commit: HEAD}, T2).post).toBe(false))
	test('command in flight or review running: do not post', () => {
		expect(decideTrigger({state: 'pending', phase: 'command', why: ''}, T2).post).toBe(false)
		expect(decideTrigger({state: 'pending', phase: 'in-progress', why: ''}, T2).post).toBe(false)
	})
	test('nothing running for the head: post', () => expect(decideTrigger({state: 'pending', phase: 'awaiting-pickup', why: ''}, T2).post).toBe(true))
	test('auto reviews disabled: post', () => expect(decideTrigger(classify(snap([summary('summary-skipped-with-coverage.md')])), T2).post).toBe(true))
	test('inside the cooldown: wait, report retryAt; --force overrides', () => {
		const s = classify(snap([summary('summary-rate-limited.md', T1)]))
		expect(decideTrigger(s, T2)).toEqual({post: false, why: 'rate limited', retryAt: '2026-10-20T06:28:00.000Z'})
		expect(decideTrigger(s, '2026-10-20T06:29:00Z').post).toBe(true)
		expect(decideTrigger(s, T2, true).post).toBe(true)
	})
	test('too many files or closed: do not post', () => {
		expect(decideTrigger({state: 'too-many-files', files: 123, limit: 100}, T2).post).toBe(false)
		expect(decideTrigger({state: 'skipped', reason: 'merged', detail: ''}, T2).post).toBe(false)
	})
})
