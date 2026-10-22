import {describe, expect, it} from 'bun:test'

import {
	claudeArgs,
	claudeModelFrom,
	classifyCodexFailure,
	coverageSummary,
	fallbackModelFrom,
	lastJsonObject,
	needsAction,
	parseChangedRanges,
	parseOpencodeOutput,
	parseReviewOutput,
	parseVerdicts,
	renderReport,
	resolveCandidates,
	reviewJsonSchema,
	toCandidates,
	verdictJsonSchema,
	verifierFor,
	type Candidate,
	type Checked,
	type Coverage,
	type Engine,
	type Finding
} from '../scripts/core'

const ROOT = '/repo'

function finding(overrides: Partial<Finding> = {}): Finding {
	return {title: 'Drop the stale job', body: 'When the queue restarts, the job is lost.', file: 'src/main/queue.ts', lineStart: 10, lineEnd: 12, severity: 'P2', confidence: 0.8, introduced: true, ...overrides}
}

function candidates(engine: Engine, lane: string, ...findings: Finding[]): Candidate[] {
	return toCandidates(engine, lane, findings)
}

const verdict = (id: string, v: 'confirmed' | 'refuted' | 'uncertain', introduced = true) => ({id, verdict: v, reason: `${v} because of the code`, introduced})

describe('parseReviewOutput', () => {
	it('accepts a review and makes file paths repo-relative', () => {
		const out = parseReviewOutput({findings: [finding({file: '/repo/src/main/queue.ts'}), finding({file: './src/a.ts'}), finding({file: 'src\\b.ts'})]}, ROOT)
		expect(out.map(f => f.file)).toEqual(['src/main/queue.ts', 'src/a.ts', 'src/b.ts'])
	})

	it('normalizes Windows absolute paths whatever the drive letter case', () => {
		const out = parseReviewOutput({findings: [finding({file: 'C:\\repo\\src\\a.ts'}), finding({file: 'c:\\repo\\src\\b.ts'})]}, 'C:\\repo')
		expect(out.map(f => f.file)).toEqual(['src/a.ts', 'src/b.ts'])
	})

	it('strips a priority tag the reviewer put in the title', () => {
		const [out] = parseReviewOutput({findings: [finding({title: '[P2] Keep the job'})]}, ROOT)
		expect(out?.title).toBe('Keep the job')
	})

	it('clamps confidence and orders a reversed line range', () => {
		const [out] = parseReviewOutput({findings: [finding({confidence: 4, lineStart: 20, lineEnd: 5})]}, ROOT)
		expect(out).toMatchObject({confidence: 1, lineStart: 5, lineEnd: 20})
	})

	it('rejects a review missing required fields', () => {
		expect(() => parseReviewOutput({findings: [{title: 'x'}]}, ROOT)).toThrow()
		expect(() => parseReviewOutput('not json', ROOT)).toThrow()
	})
})

describe('JSON schemas', () => {
	// The Claude CLI rejects a draft-2020-12 $schema reference, and Codex's strict
	// structured output rejects bounds keywords.
	it.each([
		['review', reviewJsonSchema],
		['verdict', verdictJsonSchema]
	])('the %s schema carries no $schema reference or bounds, and closes every object', (_name, schema) => {
		const text = JSON.stringify(schema)
		expect(schema).not.toHaveProperty('$schema')
		expect(text).not.toMatch(/"(minLength|maxLength|minimum|maximum|minItems)"/)
		expect(text.match(/"type":"object"/g)?.length).toBe(text.match(/"additionalProperties":false/g)?.length)
	})
})

// What the CLIs were handed before the validator replaced zod, byte for byte.
const REVIEW_SCHEMA = {type: 'object', properties: {findings: {type: 'array', items: {type: 'object', properties: {title: {type: 'string'}, body: {type: 'string'}, file: {type: 'string'}, lineStart: {type: 'number'}, lineEnd: {type: 'number'}, severity: {type: 'string', enum: ['P0', 'P1', 'P2', 'P3']}, confidence: {type: 'number'}, introduced: {type: 'boolean'}}, required: ['title', 'body', 'file', 'lineStart', 'lineEnd', 'severity', 'confidence', 'introduced'], additionalProperties: false}}}, required: ['findings'], additionalProperties: false}
const VERDICT_SCHEMA = {type: 'object', properties: {verdicts: {type: 'array', items: {type: 'object', properties: {id: {type: 'string'}, verdict: {type: 'string', enum: ['confirmed', 'refuted', 'uncertain']}, reason: {type: 'string'}, introduced: {type: 'boolean'}}, required: ['id', 'verdict', 'reason', 'introduced'], additionalProperties: false}}}, required: ['verdicts'], additionalProperties: false}

describe('wire schemas', () => {
	it('match the schemas the CLIs have always been given, key order included', () => {
		expect(JSON.stringify(reviewJsonSchema)).toBe(JSON.stringify(REVIEW_SCHEMA))
		expect(JSON.stringify(verdictJsonSchema)).toBe(JSON.stringify(VERDICT_SCHEMA))
	})

	it('reject a finding with an unknown key, an unknown severity or a non-number line', () => {
		expect(() => parseReviewOutput({findings: [{...finding(), extra: 1}]}, ROOT)).toThrow(/findings\[0\]\.extra: unrecognized key/)
		expect(() => parseReviewOutput({findings: [{...finding(), severity: 'P4'}]}, ROOT)).toThrow(/findings\[0\]\.severity/)
		expect(() => parseReviewOutput({findings: [{...finding(), lineStart: '3'}]}, ROOT)).toThrow(/findings\[0\]\.lineStart: expected finite number, received string/)
		expect(() => parseVerdicts({verdicts: [], note: 'x'}, [])).toThrow(/note: unrecognized key/)
	})
})

describe('parseVerdicts', () => {
	it('keeps only verdicts for the reports this verifier was given', () => {
		const verdicts = parseVerdicts({verdicts: [verdict('a', 'confirmed'), verdict('b', 'refuted')]}, ['a'])
		expect([...verdicts.keys()]).toEqual(['a'])
	})
})

describe('parseChangedRanges', () => {
	const diff = [
		'diff --git a/src/a.ts b/src/a.ts',
		'--- a/src/a.ts',
		'+++ b/src/a.ts',
		'@@ -10,2 +12,3 @@ function x() {',
		'@@ -40 +44,0 @@',
		'diff --git a/src/old.ts b/src/new.ts',
		'--- a/src/old.ts',
		'+++ b/src/new.ts',
		'@@ -1 +1 @@',
		'diff --git a/src/gone.ts b/src/gone.ts',
		'--- a/src/gone.ts',
		'+++ /dev/null',
		'@@ -1,3 +0,0 @@',
		'--- a/src/my file.ts\t',
		'+++ b/src/my file.ts\t',
		'@@ -1 +1 @@',
		'--- "a/src/quoted.ts"',
		'+++ "b/src/quoted.ts"',
		'@@ -2 +2 @@'
	].join('\n')

	it('maps each new-side file to its changed line ranges', () => {
		const ranges = parseChangedRanges(diff)
		expect(ranges.get('src/a.ts')).toEqual([
			[12, 14],
			[44, 44]
		])
		expect(ranges.get('src/new.ts')).toEqual([[1, 1]])
		expect(ranges.has('src/gone.ts')).toBe(false)
	})

	it('drops the tab git appends to names with spaces and unquotes quoted names', () => {
		const ranges = parseChangedRanges(diff)
		expect(ranges.get('src/my file.ts')).toEqual([[1, 1]])
		expect(ranges.get('src/quoted.ts')).toEqual([[2, 2]])
	})
})

describe('verifierFor', () => {
	// Overlapping lines do not prove two tools made the same claim, so agreement
	// never skips the check; it is only noted in the report.
	it('always sends a report to the other tool, even when both tools flagged the same lines', () => {
		const all = [...candidates('codex', 'review', finding()), ...candidates('claude', 'regressions', finding()), ...candidates('claude', 'tests', finding())]
		expect(all.map(c => verifierFor(c, true))).toEqual(['claude', 'codex', 'codex'])
	})

	it('has Claude check its own reports in a second pass when Codex is unavailable', () => {
		const all = [...candidates('claude', 'regressions', finding()), ...candidates('claude', 'tests', finding())]
		expect(all.map(c => verifierFor(c, false))).toEqual(['claude', 'claude'])
	})

	// OpenCode is the weakest model in the run: it finds, it never judges.
	it('has Claude check every OpenCode report and never hands one to OpenCode or Codex', () => {
		const all = candidates('opencode', 'review', finding(), finding({lineStart: 300}))
		expect(all.map(c => verifierFor(c, true))).toEqual(['claude', 'claude'])
		expect(all.map(c => verifierFor(c, false))).toEqual(['claude', 'claude'])
	})
})

// What run.ts hands over: each verdict stamped with the tool that gave it.
function checkedBy(all: Candidate[], verdicts: ReturnType<typeof verdict>[], codexAvailable = true): Map<string, Checked> {
	const parsed = parseVerdicts(
		{verdicts},
		all.map(c => c.id)
	)
	return new Map(
		[...parsed].map(([id, v]) => [
			id,
			{
				verdict: v,
				by: verifierFor(
					all.find(c => c.id === id)!,
					codexAvailable
				)
			}
		])
	)
}

describe('resolveCandidates', () => {
	const changed = new Map([['src/main/queue.ts', [[10, 12] as const]]])
	const resolve = (all: Candidate[], verdicts: ReturnType<typeof verdict>[]) => resolveCandidates(all, checkedBy(all, verdicts), changed)

	it('notes when the other tool flagged overlapping lines but still uses the verdict', () => {
		const all = [...candidates('codex', 'review', finding()), ...candidates('claude', 'regressions', finding())]
		expect(resolve(all, [verdict(all[0].id, 'refuted'), verdict(all[1].id, 'confirmed')]).map(r => [r.status, r.corroborated, r.verifiedBy, r.action])).toEqual([
			['refuted', true, 'claude', null],
			['confirmed', true, 'codex', 'fix']
		])
	})

	it('applies each report’s own verdict, so a refuted report leaves the action list and its neighbour stays', () => {
		const all = candidates('codex', 'review', finding({severity: 'P1'}), finding({title: 'Real bug', lineStart: 12, lineEnd: 12}))
		expect(resolve(all, [verdict(all[0].id, 'refuted'), verdict(all[1].id, 'confirmed')]).map(r => [r.title, r.status, r.action])).toEqual([
			['Drop the stale job', 'refuted', null],
			['Real bug', 'confirmed', 'fix']
		])
	})

	it('treats a report the verifier skipped as uncertain', () => {
		expect(resolve(candidates('claude', 'tests', finding()), [])[0]?.status).toBe('uncertain')
	})

	it('lets the verifier’s view of who introduced the bug decide fix or backlog', () => {
		const all = candidates('claude', 'tests', finding({introduced: true, lineStart: 300, lineEnd: 301}))
		expect(resolve(all, [verdict(all[0].id, 'confirmed', false)])[0]).toMatchObject({introduced: false, action: 'backlog'})
	})

	it('keeps a pre-existing bug inside the changed lines in this change and sends one outside them to the backlog', () => {
		const all = candidates('codex', 'review', finding(), finding({lineStart: 300, lineEnd: 301}))
		expect(
			resolve(
				all,
				all.map(c => verdict(c.id, 'confirmed', false))
			).map(r => r.action)
		).toEqual(['fix', 'backlog'])
	})

	// Opus is the strongest model in the run, so a weaker checker refuting one of
	// its serious findings sends it to the reader instead of dropping it.
	it('escalates a P0 or P1 Claude report that Codex refuted to uncertain, keeping the reason', () => {
		const all = candidates('claude', 'regressions', finding({severity: 'P0'}), finding({severity: 'P1', lineStart: 40}), finding({severity: 'P2', lineStart: 80}))
		const out = resolve(
			all,
			all.map(c => verdict(c.id, 'refuted'))
		)
		expect(out.map(r => [r.severity, r.status, r.escalated, r.verifiedBy])).toEqual([
			['P0', 'uncertain', true, 'codex'],
			['P1', 'uncertain', true, 'codex'],
			['P2', 'refuted', false, 'codex']
		])
		expect(out[1]?.reason).toBe('refuted because of the code')
		expect(needsAction(out)).toBe(true)
	})

	it('lets Claude’s refutation of a Codex or OpenCode report stand, whatever its severity', () => {
		const all = [...candidates('codex', 'review', finding({severity: 'P0'})), ...candidates('opencode', 'review', finding({severity: 'P1'}))]
		expect(resolve(all, all.map(c => verdict(c.id, 'refuted'))).map(r => [r.status, r.escalated])).toEqual([
			['refuted', false],
			['refuted', false]
		])
	})

	it('lets a second Claude pass refute a P0 Claude report', () => {
		const all = candidates('claude', 'regressions', finding({severity: 'P0'}))
		expect(resolveCandidates(all, checkedBy(all, [verdict(all[0].id, 'refuted')], false), changed)[0]).toMatchObject({status: 'refuted', escalated: false, verifiedBy: 'claude'})
	})
})

describe('needsAction', () => {
	const changed = new Map<string, [number, number][]>()
	const resolveOne = (v: 'confirmed' | 'refuted' | 'uncertain', introduced: boolean) => {
		const all = candidates('codex', 'review', finding())
		return resolveCandidates(all, checkedBy(all, [verdict(all[0].id, v, introduced)]), changed)
	}

	it('is true for a bug to fix or an uncertain report', () => {
		expect(needsAction(resolveOne('confirmed', true))).toBe(true)
		expect(needsAction(resolveOne('uncertain', false))).toBe(true)
	})

	it('is false when every report is refuted or belongs in the backlog', () => {
		expect(needsAction(resolveOne('confirmed', false))).toBe(false)
		expect(needsAction(resolveOne('refuted', true))).toBe(false)
	})
})

const USAGE_LIMIT = {reason: 'usage-limit', detail: 'You’ve hit your usage limit. Try again at Oct 27th, 2026 9:20 AM.'} as const
const MIMO = 'openrouter/xiaomi/mimo-v2.6-pro'
const BOTH: Coverage = {
	reviewers: ['codex:review', 'claude:regressions'],
	verifiers: ['claude', 'codex'],
	checks: [
		{author: 'codex', by: 'claude'},
		{author: 'claude', by: 'codex'}
	],
	codexSkipped: null,
	fallback: null,
	claudeModel: 'opus'
}
const NO_CODEX: Coverage = {reviewers: ['claude:review'], verifiers: ['claude'], checks: [{author: 'claude', by: 'claude'}], codexSkipped: USAGE_LIMIT, fallback: {status: 'disabled'}, claudeModel: 'opus'}
const WITH_FALLBACK: Coverage = {
	reviewers: ['opencode:review', 'claude:regressions'],
	verifiers: ['claude'],
	checks: [
		{author: 'opencode', by: 'claude'},
		{author: 'claude', by: 'claude'}
	],
	codexSkipped: USAGE_LIMIT,
	fallback: {status: 'reviewed', model: MIMO},
	claudeModel: 'opus'
}

// Copied from `codex exec` on 2026-10-21, when the subscription ran out.
const USAGE_LIMIT_STDERR = `Reading additional input from stdin...
2026-10-20T22:48:18.338693Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when Client(HttpRequest(HttpRequest("http/request failed: error sending request for url (http://127.0.0.1:3141/)")))
ERROR: You’ve hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/settings/usage to purchase more credits or try again at Oct 27th, 2026 9:20 AM.
`

describe('classifyCodexFailure', () => {
	it('recognizes the real usage-limit message and keeps its own line as the detail', () => {
		const out = classifyCodexFailure(USAGE_LIMIT_STDERR)
		expect(out?.reason).toBe('usage-limit')
		expect(out?.detail).toContain('try again at Oct 27th, 2026 9:20 AM')
		expect(out?.detail).not.toContain('rmcp')
	})

	it('recognizes a logged-out Codex', () => {
		expect(classifyCodexFailure('ERROR: Not logged in. Run `codex login` to authenticate.')?.reason).toBe('auth')
		expect(classifyCodexFailure('ERROR: unexpected status 401 Unauthorized: Missing bearer or basic authentication')?.reason).toBe('auth')
	})

	it('recognizes a missing binary from the spawn error code', () => {
		expect(classifyCodexFailure('', 'ENOENT')).toMatchObject({reason: 'missing'})
	})

	it('ignores prompt echoes and transport noise that merely mention a limit or a login', () => {
		const echoed = ['user', '- 101ddda5 feat(review): fall back to Claude when Codex hits a usage limit, is not logged in or sign in fails', '2026-10-20T22:48:18Z ERROR rmcp::transport::worker: authentication required', 'ERROR: the stream closed before the result'].join('\n')
		expect(classifyCodexFailure(echoed)).toBeNull()
	})

	it('leaves any other failure to be reported as a failed reviewer', () => {
		expect(classifyCodexFailure('ERROR: the output schema is invalid')).toBeNull()
		expect(classifyCodexFailure('')).toBeNull()
	})
})

describe('coverage in the report', () => {
	const report = (coverage: Coverage, failures: string[] = []) => renderReport({base: 'abc1234', head: 'def5678', resolved: [], failures, coverage})

	it('says Codex was skipped, why, and who checked instead, in a line a PR body can quote', () => {
		const line = coverageSummary(NO_CODEX)
		expect(line).toContain('Codex skipped (usage limit')
		expect(line).toContain('claude:review')
		expect(line).toContain('second Claude pass')
		expect(report(NO_CODEX)).toContain(line)
	})

	it('lists both tools and the Claude model when Codex ran', () => {
		expect(coverageSummary(BOTH)).toBe('Reviewed by codex:review, claude:regressions; findings cross-checked by claude and codex. Claude ran as claude:opus.')
	})

	it('names the fallback reviewer and says Claude checked its findings', () => {
		const line = coverageSummary(WITH_FALLBACK)
		expect(line).toStartWith(`Codex skipped (usage limit: ${USAGE_LIMIT.detail}); fallback reviewer opencode:${MIMO}, checked by Claude.`)
		expect(line).toContain('Reviewed by opencode:review, claude:regressions')
		expect(line).toContain("OpenCode's findings checked by Claude")
		expect(line).toContain("Claude's findings checked in a second Claude pass")
		expect(line).toContain('claude:opus')
	})

	it('says why no fallback reviewer ran', () => {
		const line = (fallback: Coverage['fallback']) => coverageSummary({...NO_CODEX, fallback})
		expect(line({status: 'disabled'})).toContain('no fallback reviewer (DUAL_REVIEW_FALLBACK_MODEL=none)')
		expect(line({status: 'missing', model: MIMO, detail: 'the opencode binary was not found on PATH'})).toContain(`fallback reviewer opencode:${MIMO} not run (the opencode binary was not found on PATH)`)
		expect(line({status: 'failed', model: MIMO, detail: 'Model unavailable'})).toContain(`fallback reviewer opencode:${MIMO} failed (Model unavailable)`)
		expect(line({status: 'invalid', model: MIMO, detail: 'no JSON object in the reply'})).toContain(`fallback reviewer opencode:${MIMO} returned no valid review (no JSON object in the reply)`)
	})

	it('says plainly when nothing reviewed the change', () => {
		const none: Coverage = {...NO_CODEX, reviewers: [], verifiers: [], checks: []}
		expect(coverageSummary(none)).toContain('No reviewer completed')
		expect(report(none, ['claude review-claude-review exited with 1'])).not.toContain('Every reviewer finished.')
	})
})

describe('renderReport', () => {
	it('lists every report in full under fixes, backlog, uncertain and refuted, with any failed reviewer', () => {
		const all = [...candidates('codex', 'review', finding(), finding({file: 'src/far.ts'})), ...candidates('claude', 'regressions', finding({title: 'A different bug', body: 'Cancel leaves a temp file.'}), finding({file: 'src/wrong.ts'}), finding({file: 'src/maybe.ts'}))]
		const [codexQueue, codexFar, claudeQueue, claudeWrong] = all.map(c => c.id)
		const verdicts = checkedBy(all, [verdict(codexQueue, 'confirmed'), verdict(codexFar, 'confirmed', false), verdict(claudeQueue, 'confirmed'), verdict(claudeWrong, 'refuted')])
		const report = renderReport({base: 'abc1234', head: 'def5678', resolved: resolveCandidates(all, verdicts, new Map()), failures: ['claude review-claude-tests exited with 1'], coverage: BOTH})
		expect(report).toContain('## Fix in this change (2)')
		expect(report).toContain('Cancel leaves a temp file.')
		expect(report).toContain('also flagged by claude:regressions')
		expect(report).toContain('## Backlog (1)')
		expect(report).toContain('## Uncertain: read the code and decide (1)')
		expect(report).toContain('## Refuted (1)')
		expect(report).toContain('refuted because of the code')
		expect(report).toContain('claude review-claude-tests exited with 1')
	})

	it('files an escalated refutation under uncertain and says who refuted it and why it was kept', () => {
		const all = candidates('claude', 'regressions', finding({severity: 'P1'}))
		const report = renderReport({base: 'abc1234', head: 'def5678', resolved: resolveCandidates(all, checkedBy(all, [verdict(all[0].id, 'refuted')]), new Map()), failures: [], coverage: BOTH})
		expect(report).toContain('## Uncertain: read the code and decide (1)')
		expect(report).toContain('## Refuted (0)')
		expect(report).toContain('refuted by codex, escalated: P1 from Opus')
		expect(report).toContain('_Check:_ refuted because of the code')
	})
})

describe('claudeArgs', () => {
	const args = claudeArgs('Review it', reviewJsonSchema, 'opus')
	const after = (flag: string) => args[args.indexOf(flag) + 1]

	// A user-level hook that rewrites `git diff` (to `wrapper git diff`) no longer
	// matches the allow-list, and the headless lane is denied the diff.
	it('runs the lane with every hook off, so its git commands reach the allow-list as written', () => {
		expect(JSON.parse(after('--settings'))).toEqual({disableAllHooks: true})
	})

	it('allows only read-only tools and passes the prompt last', () => {
		const allowed = args.slice(args.indexOf('--allowedTools') + 1, args.indexOf('--disallowedTools'))
		expect(allowed).toEqual(expect.arrayContaining(['Read', 'Bash(git diff:*)', 'Bash(git show:*)']))
		expect(allowed.some(tool => /Edit|Write|Bash\((?!git (?:diff|log|show|blame):)/.test(tool))).toBe(false)
		expect(after('--permission-mode')).toBe('default')
		expect(args.slice(-2)).toEqual(['--', 'Review it'])
	})

	it('pins the model', () => {
		expect(after('--model')).toBe('opus')
		const other = claudeArgs('x', reviewJsonSchema, 'sonnet')
		expect(other[other.indexOf('--model') + 1]).toBe('sonnet')
	})
})

describe('model settings', () => {
	it('runs Claude on Opus unless DUAL_REVIEW_CLAUDE_MODEL names another model', () => {
		expect(claudeModelFrom({})).toBe('opus')
		expect(claudeModelFrom({DUAL_REVIEW_CLAUDE_MODEL: ' '})).toBe('opus')
		expect(claudeModelFrom({DUAL_REVIEW_CLAUDE_MODEL: 'claude-opus-5-5'})).toBe('claude-opus-5-5')
	})

	it('uses MiMo for the fallback reviewer unless DUAL_REVIEW_FALLBACK_MODEL names another or none', () => {
		expect(fallbackModelFrom({})).toBe('openrouter/xiaomi/mimo-v2.6-pro')
		expect(fallbackModelFrom({DUAL_REVIEW_FALLBACK_MODEL: ''})).toBe('openrouter/xiaomi/mimo-v2.6-pro')
		expect(fallbackModelFrom({DUAL_REVIEW_FALLBACK_MODEL: 'opencode/glm-5.3'})).toBe('opencode/glm-5.3')
		expect(fallbackModelFrom({DUAL_REVIEW_FALLBACK_MODEL: 'none'})).toBeNull()
		expect(fallbackModelFrom({DUAL_REVIEW_FALLBACK_MODEL: ' NONE '})).toBeNull()
	})
})

describe('lastJsonObject', () => {
	it('finds the reply among ANSI codes, tool-call progress lines and a json fence', () => {
		const out = ['\u001b[0m\u001b[1m> plan · mimo-v2.6-pro\u001b[0m', '\u001b[2m→ Read src/a.ts {"path": "src/a.ts"}\u001b[0m', '$ git diff abc...def', 'Here is my review:', '```json', '{"findings": [{"title": "a {brace} and a \\"quote\\"", "n": 1}]}', '```', ''].join('\n')
		expect(lastJsonObject(out)).toEqual({findings: [{title: 'a {brace} and a "quote"', n: 1}]})
	})

	it('takes the last of several objects and skips a stray brace in prose', () => {
		expect(lastJsonObject('I will use {x} here. {"a": 1} then {"b": {"c": 2}} done')).toEqual({b: {c: 2}})
		expect(lastJsonObject('{"b": 1} and an unclosed { here')).toEqual({b: 1})
	})

	it('returns undefined when there is no JSON object', () => {
		expect(lastJsonObject('I could not review the change.')).toBeUndefined()
		expect(lastJsonObject('[1, 2]')).toBeUndefined()
	})
})

describe('parseOpencodeOutput', () => {
	// Shapes from `opencode run --format json` 2.1.1 (2026-10-22).
	const event = (type: string, extra: object) => JSON.stringify({type, timestamp: 1, sessionID: 'ses_1', ...extra})
	const text = (id: string, value: string) => event('text', {part: {id, type: 'text', text: value}})

	it('joins the text parts of the event stream and keeps the session id', () => {
		const stdout = [event('step_start', {part: {type: 'step-start'}}), event('tool_use', {part: {type: 'tool', tool: 'read', state: {status: 'completed', output: '{"not": "the reply"}'}}}), text('p1', 'Looking.'), text('p2', '{"findings": []}'), 'stray progress line', ''].join('\n')
		const out = parseOpencodeOutput(stdout)
		expect(out).toEqual({text: 'Looking.\n{"findings": []}', sessionId: 'ses_1', error: null})
		expect(lastJsonObject(out.text)).toEqual({findings: []})
	})

	it('keeps the last version of a text part sent more than once', () => {
		expect(parseOpencodeOutput([text('p1', '{"a"'), text('p1', '{"a": 1}')].join('\n')).text).toBe('{"a": 1}')
	})

	it('reports an error event', () => {
		expect(parseOpencodeOutput(event('error', {error: {type: 'provider.no-route', message: 'Model unavailable: x/y'}})).error).toBe('Model unavailable: x/y')
	})

	it('passes plain output through when there is no event stream', () => {
		expect(parseOpencodeOutput('\u001b[1mreview\u001b[0m\n{"findings": []}\n')).toEqual({text: '\u001b[1mreview\u001b[0m\n{"findings": []}\n', sessionId: null, error: null})
	})
})

