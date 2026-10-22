// Pure half of the dual review: parse what each reviewer returns, merge findings
// that point at the same code, decide which tool checks which finding, and sort
// the result into "fix in this change" and "backlog". run.ts does the I/O.

import path from 'node:path'
import * as v from './validate'

const SEVERITIES = ['P0', 'P1', 'P2', 'P3'] as const

// "ui": a defect in what the user sees or how the interface is to use, which
// only Claude judges; "code": everything else, bugs in UI code included.
const AREAS = ['code', 'ui'] as const

// The wire schemas carry no bounds (`minLength`, integer limits): Codex's strict
// structured output rejects some JSON Schema keywords, so values are checked and
// normalized after parsing instead.
const findingSchema = v.object({title: v.string(), body: v.string(), file: v.string(), lineStart: v.number(), lineEnd: v.number(), severity: v.enumOf(SEVERITIES), confidence: v.number(), introduced: v.boolean(), area: v.enumOf(AREAS)})

const reviewOutputSchema = v.object({findings: v.array(findingSchema)})

const verdictSchema = v.object({id: v.string(), verdict: v.enumOf(['confirmed', 'refuted', 'uncertain']), reason: v.string(), introduced: v.boolean()})

const verdictOutputSchema = v.object({verdicts: v.array(verdictSchema)})

export type Finding = v.Infer<typeof findingSchema>
export type Verdict = v.Infer<typeof verdictSchema>
// Ranked by strength: Claude (Opus) first, Codex second, the OpenCode fallback
// last. Roles follow the ranking; see verifierFor and resolveCandidates.
export type Engine = 'claude' | 'codex' | 'opencode'

export type OutputJsonSchema = v.JsonSchema

// No `$schema` key: the Claude CLI rejects a draft-2020-12 reference.
export const reviewJsonSchema: OutputJsonSchema = reviewOutputSchema.jsonSchema()
export const verdictJsonSchema: OutputJsonSchema = verdictOutputSchema.jsonSchema()

const toSlashes = (file: string): string => file.replaceAll('\\', '/')

function repoRelative(file: string, repoRoot: string): string {
	const slashed = toSlashes(file)
	if (/^[A-Za-z]:\//.test(slashed)) return toSlashes(path.win32.relative(repoRoot, file))
	const relative = path.posix.isAbsolute(slashed) ? path.posix.relative(toSlashes(repoRoot), slashed) : slashed
	return relative.replace(/^\.\//, '')
}

// Codex habitually tags titles "[P2] ..."; severity already has its own field.
const PRIORITY_TAG = /^\s*\[P[0-3]\]\s*/

// A finding without a title or a file cannot be checked or acted on, so it is dropped.
export function parseReviewOutput(value: unknown, repoRoot: string): Finding[] {
	return reviewOutputSchema
		.parse(value)
		.findings.filter(f => f.title.trim() !== '' && f.file.trim() !== '')
		.map(f => {
			const [a, b] = [Math.round(f.lineStart), Math.round(f.lineEnd)]
			return {...f, title: f.title.replace(PRIORITY_TAG, ''), file: repoRelative(f.file, repoRoot), lineStart: Math.max(1, Math.min(a, b)), lineEnd: Math.max(1, a, b), confidence: Math.min(1, Math.max(0, f.confidence))}
		})
}

// A verifier may only judge the groups it was given; anything else it returns
// would overwrite the other verifier's verdict.
export function parseVerdicts(value: unknown, assignedIds: readonly string[]): Map<string, Verdict> {
	const assigned = new Set(assignedIds)
	return new Map(
		verdictOutputSchema
			.parse(value)
			.verdicts.filter(verdict => assigned.has(verdict.id))
			.map(verdict => [verdict.id, verdict])
	)
}

export type LineRange = readonly [start: number, end: number]
export type ChangedRanges = ReadonlyMap<string, readonly LineRange[]>

const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/

// Reads `git diff -U0`. A pure deletion (`+N,0`) still marks line N, the spot
// where the removed code used to sit, since a finding about the removal points there.
export function parseChangedRanges(diff: string): Map<string, LineRange[]> {
	const ranges = new Map<string, LineRange[]>()
	let current: LineRange[] | null = null
	for (const line of diff.split(/\r?\n/)) {
		if (line.startsWith('+++ ')) {
			// Git appends a tab to names containing spaces and quotes names with
			// special characters (core.quotePath=false keeps non-ASCII unquoted).
			const target = line
				.slice(4)
				.replace(/\t$/, '')
				.replace(/^"(.*)"$/, '$1')
			current = target === '/dev/null' ? null : []
			if (current) ranges.set(target.replace(/^b\//, ''), current)
			continue
		}
		const hunk = HUNK.exec(line)
		if (!hunk || !current) continue
		const start = Number(hunk[1])
		const count = hunk[2] === undefined ? 1 : Number(hunk[2])
		current.push([start, start + Math.max(count, 1) - 1])
	}
	return ranges
}

export interface Candidate extends Finding {
	id: string
	engine: Engine
	lane: string
}

export function toCandidates(engine: Engine, lane: string, findings: readonly Finding[]): Candidate[] {
	return findings.map((f, i) => ({...f, id: `${engine}-${lane}-${i + 1}`, engine, lane}))
}

// Pre-existing bugs this close to a changed line still count as in the change.
const LINE_SLACK = 3

const overlap = (a: Finding, b: Finding): boolean => a.file === b.file && a.lineStart <= b.lineEnd && b.lineStart <= a.lineEnd

const rank = (f: Finding): number => SEVERITIES.indexOf(f.severity) - f.confidence

// Each tool checks every report of the other, one by one: a model re-reading
// its own claim tends to share the blind spot that produced it. Both tools
// flagging the same lines is not a shortcut: overlapping locations do not prove
// they made the same claim. With Codex unavailable Claude checks its own
// reports in a fresh pass, the weaker substitute the report says it is.
// OpenCode, the weakest model, never checks anything: Claude checks its reports.
// UI findings stay with Claude even when Codex is available: Codex finds bugs in
// UI code well but judges looks and usability poorly, so it never gets to drop
// one of Claude's.
export function verifierFor(c: Candidate, codexAvailable: boolean): 'claude' | 'codex' {
	return c.engine === 'claude' && c.area === 'code' && codexAvailable ? 'codex' : 'claude'
}

// Files whose change can alter what the user sees; any of them in the diff
// brings in the UI lane.
const UI_FILE = /\.(?:tsx|jsx|vue|svelte|astro|html|css|scss|sass|less)$/i

export const touchesUi = (files: Iterable<string>): boolean => [...files].some(f => UI_FILE.test(f))

export const SCREENSHOT_FILE = /\.(?:png|jpe?g|webp|gif)$/i

export interface Checked {
	verdict: Verdict
	by: Engine
}

// Read-only tools only; the permission mode makes anything else a denial
// instead of a prompt nobody is there to answer.
const CLAUDE_TOOLS = ['Read', 'Grep', 'Glob', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)', 'Bash(git blame:*)', 'mcp__codegraph__codegraph_explore']

// The headless Claude call for a lane or a check. Hooks are off: a user-level
// PreToolUse hook that rewrites commands (one that turns `git diff` into
// `wrapper git diff`) leaves them outside the allow-list, so the lane is denied
// the diff it reviews, and no other hook belongs in a review either.
// `extraDirs`: folders outside the repository Claude may read, the screenshots.
export function claudeArgs(prompt: string, schema: OutputJsonSchema, model: string, extraDirs: readonly string[] = []): string[] {
	return ['-p', '--model', model, '--output-format', 'json', '--json-schema', JSON.stringify(schema), '--settings', JSON.stringify({disableAllHooks: true}), '--permission-mode', 'default', ...extraDirs.flatMap(dir => ['--add-dir', dir]), '--allowedTools', ...CLAUDE_TOOLS, '--disallowedTools', 'Edit', 'Write', 'NotebookEdit', '--', prompt]
}

export interface CodexModel {
	model: string
	effort: string
}

// The headless Codex call, pinned to a model and effort so the user's own
// Codex default never decides which model reviews.
export function codexArgs(prompt: string, schemaFile: string, resultFile: string, {model, effort}: CodexModel): string[] {
	return ['exec', '-m', model, '-c', `model_reasoning_effort="${effort}"`, '--sandbox', 'read-only', '--output-schema', schemaFile, '--output-last-message', resultFile, prompt]
}

export const CLAUDE_MODEL_ENV = 'DUAL_REVIEW_CLAUDE_MODEL'
export const CODEX_MODEL_ENV = 'DUAL_REVIEW_CODEX_MODEL'
export const CODEX_EFFORT_ENV = 'DUAL_REVIEW_CODEX_EFFORT'
export const FALLBACK_MODEL_ENV = 'DUAL_REVIEW_FALLBACK_MODEL'
const DEFAULT_CLAUDE_MODEL = 'opus'
// The newest Sol, never Astra; move it on when a newer Sol ships.
const DEFAULT_CODEX_MODEL = 'gpt-6.1-sol'
const DEFAULT_CODEX_EFFORT = 'high'
const DEFAULT_FALLBACK_MODEL = 'openrouter/xiaomi/mimo-v2.6-pro'

type Env = Readonly<Record<string, string | undefined>>

// The model every Claude lane and check runs on, pinned so a CLI default never
// quietly swaps the strongest reviewer for a weaker one.
export const claudeModelFrom = (env: Env): string => env[CLAUDE_MODEL_ENV]?.trim() || DEFAULT_CLAUDE_MODEL

export const codexModelFrom = (env: Env): CodexModel => ({model: env[CODEX_MODEL_ENV]?.trim() || DEFAULT_CODEX_MODEL, effort: env[CODEX_EFFORT_ENV]?.trim() || DEFAULT_CODEX_EFFORT})

// The OpenCode model that takes Codex's reviewer slot when Codex is unavailable;
// null when the fallback is switched off with `none`.
export function fallbackModelFrom(env: Env): string | null {
	const value = env[FALLBACK_MODEL_ENV]?.trim() || DEFAULT_FALLBACK_MODEL
	return value.toLowerCase() === 'none' ? null : value
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g

// Index of the brace closing the object opened at `start`, skipping braces in
// JSON strings; -1 when it never closes.
function closingBrace(text: string, start: number): number {
	let depth = 0
	let inString = false
	let escaped = false
	for (let i = start; i < text.length; i++) {
		const ch = text[i]
		if (inString) {
			if (escaped) escaped = false
			else if (ch === '\\') escaped = true
			else if (ch === '"') inString = false
		} else if (ch === '"') inString = true
		else if (ch === '{') depth++
		else if (ch === '}' && --depth === 0) return i
	}
	return -1
}

// The last top-level JSON object in a model's free-text reply: OpenCode has no
// structured-output flag, so the reply may carry ANSI codes, tool-call progress
// lines, prose and a ```json fence around the object. A brace in prose that
// does not open valid JSON is skipped. undefined when there is none.
export function lastJsonObject(text: string): unknown {
	const clean = text.replace(ANSI, '')
	let last: unknown
	for (let i = clean.indexOf('{'); i !== -1; ) {
		const end = closingBrace(clean, i)
		if (end !== -1) {
			try {
				last = JSON.parse(clean.slice(i, end + 1))
				i = clean.indexOf('{', end + 1)
				continue
			} catch {
				// Not JSON from this brace: try the next one.
			}
		}
		i = clean.indexOf('{', i + 1)
	}
	return last
}

export interface OpencodeOutput {
	// The model's reply: its text parts, or the raw output when it printed no events.
	text: string
	sessionId: string | null
	error: string | null
}

// Reads `opencode run --format json`: one event per line ({type, sessionID,
// part}); the reply is in the `text` events' parts, an `error` event carries a
// failure such as an unknown model. Lines that are not events are ignored.
export function parseOpencodeOutput(stdout: string): OpencodeOutput {
	const texts = new Map<string, string>()
	let sessionId: string | null = null
	let error: string | null = null
	let events = 0
	for (const line of stdout.split(/\r?\n/)) {
		if (!line.trim().startsWith('{')) continue
		let event: unknown
		try {
			event = JSON.parse(line)
		} catch {
			continue
		}
		if (!isRecord(event) || typeof event.type !== 'string') continue
		events++
		if (sessionId === null && typeof event.sessionID === 'string') sessionId = event.sessionID
		if (event.type === 'error') error = isRecord(event.error) && typeof event.error.message === 'string' ? event.error.message : JSON.stringify(event.error ?? event)
		const part = event.part
		if (event.type === 'text' && isRecord(part) && typeof part.text === 'string') texts.set(typeof part.id === 'string' ? part.id : `#${texts.size}`, part.text)
	}
	return {text: events === 0 ? stdout : [...texts.values()].join('\n'), sessionId, error}
}

// What became of the OpenCode reviewer when Codex was unavailable: it reviewed,
// it was switched off, its binary was missing, it failed to run (Claude then
// stands in, as without a fallback), or it never returned a valid review (a
// failed reviewer).
export type Fallback = {status: 'reviewed'; model: string} | {status: 'disabled'} | {status: 'missing' | 'failed' | 'invalid'; model: string; detail: string}

function describeFallback(fallback: Fallback): string {
	switch (fallback.status) {
		case 'reviewed':
			return `fallback reviewer opencode:${fallback.model}, checked by Claude`
		case 'disabled':
			return `no fallback reviewer (${FALLBACK_MODEL_ENV}=none)`
		case 'missing':
			return `fallback reviewer opencode:${fallback.model} not run (${fallback.detail})`
		case 'failed':
			return `fallback reviewer opencode:${fallback.model} failed (${fallback.detail})`
		case 'invalid':
			return `fallback reviewer opencode:${fallback.model} returned no valid review (${fallback.detail})`
	}
}

// Why Codex took no part. `missing` and `auth` come from the first failed run;
// anything else a failed Codex run prints is a real reviewer failure.
export type CodexUnavailableReason = 'usage-limit' | 'auth' | 'missing'

export interface CodexUnavailability {
	reason: CodexUnavailableReason
	detail: string
}

const CODEX_UNAVAILABLE: readonly (readonly [CodexUnavailableReason, RegExp])[] = [
	['usage-limit', /usage limit|exceeded your (?:current )?quota|insufficient[_ ]quota/i],
	['auth', /not logged in|codex login|unauthori[sz]ed|authentication (?:failed|required|error)|sign in|log in/i]
]

// Reads what a failed `codex exec` printed. Only Codex's own "ERROR:" lines
// count: the rest of the output echoes the prompt (commit messages, diffs) and
// MCP transport noise, either of which can mention a usage limit or a login.
export function classifyCodexFailure(output: string, spawnErrorCode?: string): CodexUnavailability | null {
	if (spawnErrorCode === 'ENOENT') return {reason: 'missing', detail: 'the codex binary was not found on PATH'}
	const errors = output.split(/\r?\n/).flatMap(l => (l.startsWith('ERROR:') ? [l.slice('ERROR:'.length).trim()] : []))
	for (const [reason, pattern] of CODEX_UNAVAILABLE) {
		const line = errors.find(l => pattern.test(l))
		if (line !== undefined) return {reason, detail: line}
	}
	return null
}

const UNAVAILABLE_LABEL: Record<CodexUnavailableReason, string> = {'usage-limit': 'usage limit', auth: 'not logged in', missing: 'not installed'}

// Who actually reviewed and checked the change, for the report and the PR body.
export interface Coverage {
	reviewers: readonly string[]
	verifiers: readonly Engine[]
	// Whose findings each checker checked, one entry per pair that ran.
	checks: readonly {author: Engine; by: Engine}[]
	codexSkipped: CodexUnavailability | null
	// Set when Codex was skipped before the review, so its slot needed a stand-in.
	fallback: Fallback | null
	claudeModel: string
	codexModel: CodexModel
	// Screenshots the UI lane was given; 0 when it judged from the code alone.
	screenshots: number
}

const ENGINE_NAME: Record<Engine, string> = {claude: 'Claude', codex: 'Codex', opencode: 'OpenCode'}

function describeCheck({author, by}: {author: Engine; by: Engine}): string {
	if (author === by) return `${ENGINE_NAME[author]}'s findings checked in a second ${ENGINE_NAME[by]} pass, not by Codex, so a blind spot the first pass had may remain`
	return `${ENGINE_NAME[author]}'s findings checked by ${ENGINE_NAME[by]}`
}

function describeUi(reviewers: readonly string[], screenshots: number): string {
	if (!reviewers.includes('claude:ui')) return ''
	const seen = screenshots === 0 ? 'judged from the code alone, with no screenshots' : `saw ${screenshots} screenshot${screenshots === 1 ? '' : 's'}`
	return ` The UI lane ${seen}; only Claude checks UI findings.`
}

export function coverageSummary({reviewers, verifiers, checks, codexSkipped, fallback, claudeModel, codexModel, screenshots}: Coverage): string {
	const skipped = codexSkipped ? `Codex skipped (${UNAVAILABLE_LABEL[codexSkipped.reason]}: ${codexSkipped.detail})${fallback ? `; ${describeFallback(fallback)}` : ''}. ` : ''
	if (reviewers.length === 0) return `${skipped}No reviewer completed, so nothing reviewed this change.`
	const checkers = verifiers.length === 0 ? 'no findings needed checking' : codexSkipped ? checks.map(describeCheck).join('; ') : `findings cross-checked by ${verifiers.join(' and ')}`
	const claudeRan = verifiers.includes('claude') || reviewers.some(r => r.startsWith('claude:'))
	const codexRan = verifiers.includes('codex') || reviewers.some(r => r.startsWith('codex:'))
	const models = `${claudeRan ? ` Claude ran as claude:${claudeModel}.` : ''}${codexRan ? ` Codex ran as codex:${codexModel.model} at ${codexModel.effort} effort.` : ''}`
	return `${skipped}Reviewed by ${reviewers.join(', ')}; ${checkers}.${models}${describeUi(reviewers, screenshots)}`
}

export type Status = Verdict['verdict']
export type Action = 'fix' | 'backlog'

export interface ResolvedCandidate extends Candidate {
	status: Status
	reason: string
	// null: no verdict came back.
	verifiedBy: Engine | null
	action: Action | null
	// Reviewers of the other tool that flagged overlapping lines; shown, never trusted.
	alsoFlaggedBy: string[]
	corroborated: boolean
	// A weaker checker refuted a serious Claude finding, so it is left to the reader.
	escalated: boolean
}

const SERIOUS: ReadonlySet<Finding['severity']> = new Set(['P0', 'P1'])

// Claude (Opus) is the strongest model in the run: a weaker checker's refutation
// of one of its P0 or P1 findings does not drop it.
const escalates = (c: Candidate, check: Checked | undefined): boolean => c.engine === 'claude' && check !== undefined && check.by !== 'claude' && check.verdict.verdict === 'refuted' && SERIOUS.has(c.severity)

const touchesChange = (f: Finding, changed: ChangedRanges): boolean => (changed.get(f.file) ?? []).some(([start, end]) => f.lineStart <= end + LINE_SLACK && start <= f.lineEnd + LINE_SLACK)

// A bug the change introduced, or one sitting in the lines it changed, belongs
// to this change; anything else is a pre-existing bug for the backlog.
export function resolveCandidates(all: readonly Candidate[], checks: ReadonlyMap<string, Checked>, changed: ChangedRanges): ResolvedCandidate[] {
	return all.map(c => {
		const check = checks.get(c.id)
		const verdict = check?.verdict
		const escalated = escalates(c, check)
		const status: Status = escalated ? 'uncertain' : (verdict?.verdict ?? 'uncertain')
		const introduced = verdict?.introduced ?? c.introduced
		const action: Action | null = status === 'refuted' ? null : introduced || touchesChange(c, changed) ? 'fix' : 'backlog'
		const alsoFlaggedBy = [...new Set(all.filter(o => o.engine !== c.engine && overlap(o, c)).map(o => `${o.engine}:${o.lane}`))]
		return {...c, introduced, status, reason: verdict?.reason ?? 'The verifier returned no verdict.', verifiedBy: check?.by ?? null, action, alsoFlaggedBy, corroborated: alsoFlaggedBy.length > 0, escalated}
	})
}

// Backlog entries are reported but do not block: they are not this change's to fix.
export const needsAction = (resolved: readonly ResolvedCandidate[]): boolean => resolved.some(r => r.status === 'uncertain' || (r.status === 'confirmed' && r.action === 'fix'))

// Every report is listed in full: grouping nearby reports would hide a second,
// different defect behind the first one's text.
// "Opus" for the CLI's aliases, the model id as given otherwise.
const claudeModelName = (model: string): string => (/^(?:opus|sonnet|haiku)$/i.test(model) ? model[0].toUpperCase() + model.slice(1).toLowerCase() : model)

function renderEntry(r: ResolvedCandidate, claudeModel: string): string {
	const where = `${r.file}:${r.lineStart}${r.lineEnd === r.lineStart ? '' : `-${r.lineEnd}`}`
	const also = r.alsoFlaggedBy.length === 0 ? '' : `; also flagged by ${r.alsoFlaggedBy.join(', ')}`
	const by = r.verifiedBy === null ? 'not checked' : r.escalated ? `refuted by ${r.verifiedBy}, escalated: ${r.severity} from ${claudeModelName(claudeModel)}` : r.verifiedBy === r.engine ? `${r.status} by a second ${r.engine} pass` : `${r.status} by ${r.verifiedBy}`
	const ui = r.area === 'ui' && r.lane !== 'ui' ? ', UI' : ''
	return [`- **[${r.severity}] ${r.title}** — \`${where}\` (${r.engine}:${r.lane}${ui}; ${by}${also})`, `  ${r.body.replaceAll('\n', '\n  ')}`, `  _Check:_ ${r.reason}`].join('\n')
}

function section(title: string, entries: readonly ResolvedCandidate[], claudeModel: string): string {
	const sorted = [...entries].sort((a, b) => a.file.localeCompare(b.file) || a.lineStart - b.lineStart || rank(a) - rank(b))
	return [`## ${title} (${entries.length})`, '', ...(sorted.length === 0 ? ['None.'] : sorted.map(r => renderEntry(r, claudeModel))), ''].join('\n')
}

export interface ReportInput {
	base: string
	head: string
	resolved: readonly ResolvedCandidate[]
	failures: readonly string[]
	coverage: Coverage
}

export function renderReport({base, head, resolved, failures, coverage}: ReportInput): string {
	const confirmed = resolved.filter(r => r.status === 'confirmed')
	return [
		`# Dual review of ${base}..${head}`,
		'',
		`**Review coverage:** ${coverageSummary(coverage)}`,
		'',
		failures.length === 0 ? 'Every reviewer that ran finished.' : `**Incomplete: some reviewers failed, so coverage is partial.**\n\n${failures.map(f => `- ${f}`).join('\n')}`,
		'',
		section(
			'Fix in this change',
			confirmed.filter(r => r.action === 'fix'),
			coverage.claudeModel
		),
		section(
			'Backlog',
			confirmed.filter(r => r.action === 'backlog'),
			coverage.claudeModel
		),
		section(
			'Uncertain: read the code and decide',
			resolved.filter(r => r.status === 'uncertain'),
			coverage.claudeModel
		),
		section(
			'Refuted',
			resolved.filter(r => r.status === 'refuted'),
			coverage.claudeModel
		)
	].join('\n')
}
