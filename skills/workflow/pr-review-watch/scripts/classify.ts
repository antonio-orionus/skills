// Pure parsing and classification of CodeRabbit PR state. No I/O here: every
// function takes recorded GitHub data and returns a plain value, so the rules
// are tested against real comment bodies (tests/fixtures).

export const DEFAULT_BOTS = ['coderabbitai', 'coderabbitai[bot]', 'coderabbit[bot]']

export interface IssueComment {
	id: number
	login: string
	body: string
	createdAt: string
	updatedAt: string
}

export interface Review {
	login: string
	commitId: string
	body: string
	submittedAt: string
}

export interface PullRequest {
	number: number
	url: string
	state: 'OPEN' | 'CLOSED' | 'MERGED'
	isDraft: boolean
	headSha: string
	headCommittedAt: string
}

export interface Snapshot {
	pr: PullRequest
	comments: IssueComment[]
	reviews: Review[]
	bots: string[]
	now: string
}

// ---------------------------------------------------------------- logins

export const normalizeLogin = (login: string): string => login.toLowerCase().replace(/\[bot\]$/, '')

export const isBot = (login: string, bots: string[]): boolean => bots.map(normalizeLogin).includes(normalizeLogin(login))

// ---------------------------------------------------------------- markers

const SUMMARY_MARKER = 'auto-generated comment: summarize by coderabbit.ai'
const REPLY_MARKER = 'CodeRabbit review command invocation'
const IN_PROGRESS_MARKER = 'auto-generated comment: review in progress by coderabbit.ai'
const RATE_LIMIT_MARKER = 'auto-generated comment: rate limited by coderabbit.ai'
const TRIGGER_RE = /@coderabbit(?:ai)?\s+(?:full\s+)?review\b/i

export const isSummaryComment = (body: string): boolean => body.includes(SUMMARY_MARKER)
export const isCommandReply = (body: string): boolean => body.includes(REPLY_MARKER)
export const isTriggerComment = (body: string): boolean => TRIGGER_RE.test(body)

// ---------------------------------------------------------------- durations

const UNIT_SECONDS: Record<string, number> = {hour: 3600, minute: 60, second: 1}

// "23 minutes", "1 hour and 5 minutes", "2 minutes and 30 seconds" -> seconds
export function parseDurationSeconds(text: string): number | null {
	let total = 0
	let matched = false
	for (const m of text.matchAll(/(\d+)\s*(hour|minute|second)s?/gi)) {
		total += Number(m[1]) * UNIT_SECONDS[m[2]!.toLowerCase()]!
		matched = true
	}
	return matched ? total : null
}

// Cooldown stated in a rate-limit block. Current wording:
//   **Next included review available in 23 minutes.**
// Older wording:
//   Please wait **12 minutes and 5 seconds** before requesting another review.
export function parseCooldownSeconds(body: string): number | null {
	const current = body.match(/available in\s+([^.*\n]+)/i)
	if (current) return parseDurationSeconds(current[1]!)
	const legacy = body.match(/wait\s+\*\*([^*]+)\*\*/i)
	if (legacy) return parseDurationSeconds(legacy[1]!)
	return null
}

// ---------------------------------------------------------------- summary

export type SkipKind = 'auto-review-disabled' | 'draft' | 'too-many-files' | 'other'

export interface Skip {
	kind: SkipKind
	reason: string
	files?: number
	limit?: number
}

export interface Summary {
	coveredCommit: string | null
	inProgress: boolean
	rateLimited: boolean
	cooldownSeconds: number | null
	skip: Skip | null
	updatedAt: string
}

const stripHtmlComments = (s: string): string => s.replace(/<!--[\s\S]*?-->/g, '')

function block(body: string, marker: string): string | null {
	const start = body.indexOf(`<!-- This is an ${marker} -->`)
	if (start < 0) return null
	const end = body.indexOf(`<!-- end of ${marker} -->`, start)
	return body.slice(start, end < 0 ? undefined : end)
}

export function tooManyFiles(text: string): {files: number; limit: number} | null {
	const m = text.match(/(\d+)\s+files exceed the limit of\s+(\d+)/i)
	return m ? {files: Number(m[1]), limit: Number(m[2])} : null
}

export function parseSkip(body: string): Skip | null {
	const idx = body.search(/^>?\s*#+\s*Review skipped/m)
	if (idx < 0) return null
	const lines: string[] = []
	for (const raw of body.slice(idx).split('\n').slice(1)) {
		if (!raw.startsWith('>')) break
		const line = stripHtmlComments(raw.replace(/^>\s?/, '')).trim()
		if (line.startsWith('<')) break // a nested <details> block follows the reason
		if (line) lines.push(line)
	}
	const reason = lines.join(' ')
	const tm = tooManyFiles(reason)
	if (tm) return {kind: 'too-many-files', reason, ...tm}
	if (/auto reviews? (are|is) disabled/i.test(reason)) return {kind: 'auto-review-disabled', reason}
	if (/draft/i.test(reason)) return {kind: 'draft', reason}
	return {kind: 'other', reason}
}

export function parseCoveredCommit(body: string): string | null {
	const cov = body.match(/final_review_risk_coverage:(\{[^}]*\})/)
	if (cov) {
		try {
			const parsed: unknown = JSON.parse(cov[1]!)
			if (parsed && typeof parsed === 'object' && 'coveredCommitId' in parsed && typeof parsed.coveredCommitId === 'string') {
				const kind = 'kind' in parsed && typeof parsed.kind === 'string' ? parsed.kind : 'reviewed'
				if (!/skip|fail|limit|progress/i.test(kind)) return parsed.coveredCommitId
			}
		} catch {
			// fall through to the next signal
		}
	}
	const assessed = body.match(/change_assessment_commit:"([0-9a-f]{40})"/)
	if (assessed) return assessed[1]!
	// Older summaries: "Reviewing files ... between <base> and <head>" inside the recent-review block.
	const recent = body.match(/<!-- recent_review_start -->([\s\S]*?)<!-- recent_review_end -->/)
	const range = recent?.[1]!.match(/between\s+[0-9a-f]{7,40}\s+and\s+([0-9a-f]{40})/)
	return range ? range[1]! : null
}

export function parseSummary(c: IssueComment): Summary {
	const rate = block(c.body, 'auto-generated comment: rate limited by coderabbit.ai')
	return {
		coveredCommit: parseCoveredCommit(c.body),
		inProgress: c.body.includes(IN_PROGRESS_MARKER),
		rateLimited: c.body.includes(RATE_LIMIT_MARKER),
		cooldownSeconds: rate ? parseCooldownSeconds(rate) : null,
		skip: parseSkip(c.body),
		updatedAt: c.updatedAt,
	}
}

// ---------------------------------------------------------------- command replies

export type ReplyOutcome =
	| {kind: 'finished'; full: boolean}
	| {kind: 'failed'}
	| {kind: 'rate-limited'}
	| {kind: 'too-many-files'; files: number; limit: number}
	| {kind: 'head-changed'}
	| {kind: 'already-reviewed'}
	| {kind: 'closed'}
	| {kind: 'pending'; text: string}

// The reply to "@coderabbitai review" is posted at once and edited in place
// when the run ends; its first text line after <summary> carries the outcome.
export function parseCommandReply(body: string): ReplyOutcome {
	const text = stripHtmlComments(body)
		.replace(/<[^>]+>/g, ' ')
		.replace(/^>.*$/gm, '')
		.replace(/\s+/g, ' ')
		.trim()
	if (/full review finished/i.test(text)) return {kind: 'finished', full: true}
	if (/review finished/i.test(text)) return {kind: 'finished', full: false}
	if (/review failed/i.test(text)) return {kind: 'failed'}
	if (/rate limited/i.test(text)) return {kind: 'rate-limited'}
	const tm = tooManyFiles(text)
	if (tm) return {kind: 'too-many-files', ...tm}
	if (/head commit changed|base or head changed/i.test(text)) return {kind: 'head-changed'}
	if (/already reviewed/i.test(text)) return {kind: 'already-reviewed'}
	if (/pull request is closed/i.test(text)) return {kind: 'closed'}
	return {kind: 'pending', text: text.slice(0, 200)}
}

// ---------------------------------------------------------------- reviews

export interface ReviewCounts {
	actionable: number
	nitpicks: number
	outsideDiff: number
	duplicates: number
}

const count = (body: string, re: RegExp): number => Number(body.match(re)?.[1] ?? 0)

export function parseReviewCounts(body: string): ReviewCounts {
	return {
		actionable: count(body, /Actionable comments posted:\s*(\d+)/i),
		nitpicks: count(body, /Nitpick comments\s*\((\d+)\)/i),
		outsideDiff: count(body, /Outside diff range comments\s*\((\d+)\)/i),
		duplicates: count(body, /Duplicate comments\s*\((\d+)\)/i),
	}
}

export const isReviewRun = (body: string): boolean => /Actionable comments posted:\s*\d+/i.test(body)

// ---------------------------------------------------------------- classification

export type Status =
	| {state: 'covered'; commit: string; reply?: ReplyOutcome['kind']}
	| {state: 'pending'; phase: PendingPhase; why: string}
	| {state: 'rate-limited'; cooldownSeconds: number | null; retryAt: string | null; source: 'reply' | 'summary'}
	| {state: 'too-many-files'; files: number | null; limit: number | null}
	| {state: 'review-failed'}
	| {state: 'aborted-by-push'; from: string; to: string}
	| {state: 'skipped'; reason: SkipKind | 'closed' | 'merged'; detail: string}

// command: a review command is in flight; in-progress: CodeRabbit says it is reviewing;
// awaiting-pickup / no-summary: nothing says a review is running for this head.
export type PendingPhase = 'command' | 'in-progress' | 'awaiting-pickup' | 'no-summary'

export interface ClassifyOptions {
	// Head SHA when waiting began; a different head now means the review was overtaken by a push.
	initialHead?: string
}

const at = (iso: string): number => Date.parse(iso)

function retryAt(summary: Summary | null): string | null {
	if (!summary || summary.cooldownSeconds === null) return null
	return new Date(at(summary.updatedAt) + summary.cooldownSeconds * 1000).toISOString()
}

export function latestSummary(s: Snapshot): Summary | null {
	const found = s.comments
		.filter(c => isBot(c.login, s.bots) && isSummaryComment(c.body))
		.sort((a, b) => at(b.updatedAt) - at(a.updatedAt))[0]
	return found ? parseSummary(found) : null
}

export interface TriggerState {
	trigger: IssueComment
	reply: IssueComment | null
	outcome: ReplyOutcome | null
	fresh: boolean
}

// The newest "@coderabbitai review" posted by a person, and the bot reply that answers it.
export function latestTrigger(s: Snapshot): TriggerState | null {
	const trigger = s.comments
		.filter(c => !isBot(c.login, s.bots) && isTriggerComment(c.body))
		.sort((a, b) => at(b.createdAt) - at(a.createdAt))[0]
	if (!trigger) return null
	const reply =
		s.comments
			.filter(c => isBot(c.login, s.bots) && isCommandReply(c.body) && at(c.createdAt) >= at(trigger.createdAt))
			.sort((a, b) => at(a.createdAt) - at(b.createdAt))[0] ?? null
	return {
		trigger,
		reply,
		outcome: reply ? parseCommandReply(reply.body) : null,
		fresh: at(trigger.createdAt) >= at(s.pr.headCommittedAt),
	}
}

export function headCovered(s: Snapshot, summary: Summary | null): boolean {
	if (summary?.coveredCommit === s.pr.headSha) return true
	return s.reviews.some(r => isBot(r.login, s.bots) && r.commitId === s.pr.headSha && isReviewRun(r.body))
}

export function classify(s: Snapshot, opts: ClassifyOptions = {}): Status {
	const head = s.pr.headSha
	if (opts.initialHead && opts.initialHead !== head) return {state: 'aborted-by-push', from: opts.initialHead, to: head}

	const summary = latestSummary(s)
	const trig = latestTrigger(s)
	const triggerLive = trig?.fresh === true
	const outcome = triggerLive ? trig.outcome : null

	if (triggerLive && (outcome === null || outcome.kind === 'pending')) return {state: 'pending', phase: 'command', why: trig.reply ? 'review command acknowledged, run in progress' : 'review command posted, no reply yet'}
	if (headCovered(s, summary)) return {state: 'covered', commit: head, ...(outcome ? {reply: outcome.kind} : {})}

	if (s.pr.state !== 'OPEN') return {state: 'skipped', reason: s.pr.state === 'MERGED' ? 'merged' : 'closed', detail: `PR is ${s.pr.state.toLowerCase()} and head ${head.slice(0, 7)} was never reviewed`}

	if (outcome) {
		switch (outcome.kind) {
			case 'finished':
			case 'already-reviewed':
				return {state: 'covered', commit: head, reply: outcome.kind}
			case 'failed':
				return {state: 'review-failed'}
			case 'rate-limited':
				return {state: 'rate-limited', cooldownSeconds: summary?.rateLimited ? summary.cooldownSeconds : null, retryAt: summary?.rateLimited ? retryAt(summary) : null, source: 'reply'}
			case 'too-many-files':
				return {state: 'too-many-files', files: outcome.files, limit: outcome.limit}
			case 'head-changed':
				return {state: 'aborted-by-push', from: opts.initialHead ?? 'unknown', to: head}
			case 'closed':
				return {state: 'skipped', reason: 'closed', detail: 'CodeRabbit: pull request is closed'}
		}
	}

	const summaryFresh = summary !== null && at(summary.updatedAt) >= at(s.pr.headCommittedAt)
	if (summary && summaryFresh) {
		if (summary.inProgress) return {state: 'pending', phase: 'in-progress', why: 'CodeRabbit is reviewing new changes'}
		if (summary.rateLimited) return {state: 'rate-limited', cooldownSeconds: summary.cooldownSeconds, retryAt: retryAt(summary), source: 'summary'}
		if (summary.skip) {
			if (summary.skip.kind === 'too-many-files') return {state: 'too-many-files', files: summary.skip.files ?? null, limit: summary.skip.limit ?? null}
			return {state: 'skipped', reason: summary.skip.kind, detail: summary.skip.reason}
		}
	}
	if (s.pr.isDraft) return {state: 'skipped', reason: 'draft', detail: 'PR is a draft; CodeRabbit skips drafts unless triggered'}
	return summary
		? {state: 'pending', phase: 'awaiting-pickup', why: 'nothing reviewed or running for the head commit yet'}
		: {state: 'pending', phase: 'no-summary', why: 'no CodeRabbit summary comment yet'}
}

// ---------------------------------------------------------------- final outcome

export interface Findings {
	unresolvedThreads: number
	headReview: ReviewCounts | null
}

export function headReviewCounts(s: Snapshot): ReviewCounts | null {
	const runs = s.reviews.filter(r => isBot(r.login, s.bots) && r.commitId === s.pr.headSha && isReviewRun(r.body))
	if (runs.length === 0) return null
	return runs.map(r => parseReviewCounts(r.body)).reduce((a, b) => ({
		actionable: a.actionable + b.actionable,
		nitpicks: a.nitpicks + b.nitpicks,
		outsideDiff: a.outsideDiff + b.outsideDiff,
		duplicates: a.duplicates + b.duplicates,
	}))
}

// Threads are the source of truth for actionable findings (they can already be
// resolved); nitpick and outside-diff findings live only in the review body.
export function findingsOrClean(f: Findings): 'findings' | 'clean' {
	const bodyOnly = f.headReview ? f.headReview.nitpicks + f.headReview.outsideDiff : 0
	return f.unresolvedThreads > 0 || bodyOnly > 0 ? 'findings' : 'clean'
}

// ---------------------------------------------------------------- thread bodies

// Compact a review-thread root comment: drop HTML comments and collapsed
// <details> blocks (analysis chains, agent prompts), keep the visible finding.
export function compactThreadBody(body: string, max = 1200): {severity: string | null; title: string | null; text: string} {
	const firstLine = body.split('\n', 1)[0]!.trim()
	const severity = /\|/.test(firstLine) && /^(\*\*|_)/.test(firstLine) ? firstLine.replace(/[*_]/g, '').trim() : null
	let text = stripHtmlComments(body)
	let prev: string
	do {
		prev = text
		text = text.replace(/<details>(?:(?!<details>)[\s\S])*?<\/details>/g, '')
	} while (text !== prev)
	text = text.replace(/\n{3,}/g, '\n\n').trim()
	if (severity) text = text.slice(firstLine.length).trim()
	const title = text.match(/^\*\*(.+?)\*\*/)?.[1] ?? null
	return {severity, title, text: text.length > max ? `${text.slice(0, max)}…` : text}
}

// ---------------------------------------------------------------- trigger decision

export interface TriggerDecision {
	post: boolean
	why: string
	retryAt?: string
}

// Post "@coderabbitai review" only when the head is not covered and nothing is running.
export function decideTrigger(status: Status, now: string, force = false): TriggerDecision {
	switch (status.state) {
		case 'covered':
			return {post: false, why: `head ${status.commit.slice(0, 7)} already reviewed`}
		case 'pending':
			if (status.phase === 'command' || status.phase === 'in-progress') return {post: false, why: status.why}
			return {post: true, why: status.why}
		case 'rate-limited':
			if (!force && status.retryAt && at(status.retryAt) > at(now)) return {post: false, why: 'rate limited', retryAt: status.retryAt}
			return {post: true, why: 'rate-limit cooldown over'}
		case 'too-many-files':
			return force ? {post: true, why: 'forced'} : {post: false, why: `${status.files ?? '?'} files exceed the limit of ${status.limit ?? '?'}; split the PR or raise the limit`}
		case 'skipped':
			if (status.reason === 'closed' || status.reason === 'merged') return {post: false, why: `PR is ${status.reason}`}
			return {post: true, why: status.detail}
		case 'review-failed':
			return {post: true, why: 'previous run failed'}
		case 'aborted-by-push':
			return {post: true, why: 'previous run was overtaken by a push'}
	}
}
