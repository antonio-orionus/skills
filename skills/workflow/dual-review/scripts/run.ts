#!/usr/bin/env bun
// Local dual review: Claude (four focused lanes, pinned to Opus) and Codex (one
// whole-change pass) review the same diff in parallel through their own CLIs, on
// the logged-in subscriptions, with no API keys. Each tool then checks every
// finding the other one reported. Writes report.md and report.json and prints the
// report.
//
//   bun run.ts [--base <rev>] [--light] [--out <dir>]
//
// --base defaults to the remote's default branch (origin/HEAD, else origin/main);
// pass the previous review's head to review only the commits since. --light runs
// Codex alone (Claude still checks its findings), for mechanical changes and fix
// rounds.
//
// When Codex cannot run (usage limit, not logged in, not installed) it is
// skipped and the report says so. The OpenCode fallback (read-only `plan` agent,
// model from DUAL_REVIEW_FALLBACK_MODEL) takes its whole-change slot, and Claude
// checks its findings; OpenCode never checks anything. Without the fallback
// (`none`, no binary, or a failed run) --light runs one whole-change Claude
// reviewer instead. Claude's own findings are then checked in a second Claude
// pass. A P0 or P1 Claude finding that Codex refutes is left uncertain for the
// reader rather than dropped. Exits 1 when something in this change must be fixed or decided
// (backlog entries alone do not count), 2 when a reviewer failed, so coverage is
// partial, when no reviewer completed at all, or when the run could not start.
// A run that exits 0 or 1 records the commit it reviewed, for check-head.ts.

import {spawn} from 'node:child_process'
import {mkdir, readFile, writeFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {parseArgs} from 'node:util'
import {
	CLAUDE_MODEL_ENV,
	FALLBACK_MODEL_ENV,
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
	type CodexUnavailability,
	type Coverage,
	type Engine,
	type Fallback,
	type OutputJsonSchema
} from './core'
import {gitIn, type Git} from './git'
import {CLAUDE_LANES, OPENCODE_RETRY, WHOLE_CHANGE_LANE, opencodePrompt, reviewPrompt, verifyPrompt, type Lane, type ReviewScope} from './prompts'
import {LEARNINGS_ENV, LEARNINGS_FILE, defaultBranch, describeProject, readLearnings, refExists, repoName, reviewDir} from './repo'
import {recordReviewed, reviewedSnapshot} from './reviewedState'

const TIMEOUT_MS = 30 * 60 * 1000

const USAGE = `Usage: bun run.ts [--base <rev>] [--light] [--out <dir>]

Reviews the current branch's change (merge-base of <rev> and HEAD, to HEAD)
with Codex and Claude, then has each tool check the other's findings.

  --base <rev>  compare against <rev> (default: the remote's default branch)
  --light       Codex only, checked by Claude; for mechanical changes and fix rounds
  --out <dir>   write logs and reports here (default: <git dir>/dual-review/<head>-<time>)
  --help        print this and the repository context the run would use

Models:
  ${CLAUDE_MODEL_ENV}    every Claude lane and check (default: opus)
  ${FALLBACK_MODEL_ENV}  when Codex is unavailable (usage limit, not logged
      in, not installed), an OpenCode reviewer on this model takes Codex's
      whole-change slot, read-only (opencode run --agent plan), and Claude checks
      its findings (default: openrouter/xiaomi/mimo-v2.6-pro; none switches it
      off). Without it --light has Claude review the whole change instead.

Exit codes: 0 nothing to fix or decide in this change; 1 something to fix or
decide; 2 coverage is partial, nothing was reviewed, or the run could not start.`

interface ProcessResult {
	ok: boolean
	stdout: string
	stderr: string
	// The spawn error code (ENOENT for a missing binary), when the process never started.
	spawnCode: string | undefined
	detail: string
}

// stdin is closed: `opencode run` waits for input on an open pipe.
function runProcess(cmd: string, args: string[], logFile: string, cwd?: string): Promise<ProcessResult> {
	return new Promise(resolve => {
		const child = spawn(cmd, args, {cwd, stdio: ['ignore', 'pipe', 'pipe']})
		let stdout = ''
		let stderr = ''
		const timer = setTimeout(() => child.kill('SIGTERM'), TIMEOUT_MS)
		// Decoding per stream, not per chunk, keeps a multi-byte character split
		// across two chunks intact.
		child.stdout.setEncoding('utf8')
		child.stderr.setEncoding('utf8')
		child.stdout.on('data', (chunk: string) => (stdout += chunk))
		child.stderr.on('data', (chunk: string) => (stderr += chunk))
		let done = false
		const finish = (ok: boolean, detail: string, spawnCode?: string): void => {
			if (done) return
			done = true
			clearTimeout(timer)
			void writeFile(logFile, `${stdout}\n--- stderr ---\n${stderr}`).finally(() => resolve({ok, stdout, stderr, spawnCode, detail}))
		}
		child.on('error', err => finish(false, `could not start: ${err.message}`, 'code' in err && typeof err.code === 'string' ? err.code : undefined))
		// Bun can report a failed spawn as `close` with the negated errno before (or
		// without) the `error` event; node reports it as `error` only.
		child.on('close', (code, signal) => finish(code === 0, code === 0 ? '' : `exited with ${code ?? signal}; see ${logFile}`, code !== null && code < 0 ? errnoName(-code) : undefined))
	})
}

const errnoName = (errno: number): string | undefined => Object.entries(os.constants.errno).find(([, value]) => value === errno)?.[0]

class AgentError extends Error {}

// Codex cannot be used at all right now; not a reviewer failure, because Claude stands in.
class CodexUnavailableError extends AgentError {
	constructor(readonly unavailability: CodexUnavailability) {
		super(`codex unavailable: ${unavailability.reason}: ${unavailability.detail}`)
	}
}

async function runCodex(prompt: string, schema: OutputJsonSchema, {outDir}: Agents, name: string): Promise<string> {
	const schemaFile = path.join(outDir, `${name}.schema.json`)
	const resultFile = path.join(outDir, `${name}.json`)
	await writeFile(schemaFile, JSON.stringify(schema))
	const result = await runProcess('codex', ['exec', '--sandbox', 'read-only', '--output-schema', schemaFile, '--output-last-message', resultFile, prompt], path.join(outDir, `${name}.log`))
	if (!result.ok) {
		const unavailable = classifyCodexFailure(`${result.stderr}\n${result.stdout}`, result.spawnCode)
		throw unavailable ? new CodexUnavailableError(unavailable) : new AgentError(`codex ${name} ${result.detail}`)
	}
	return readFile(resultFile, 'utf8')
}

// The OpenCode fallback cannot run at all: Claude stands in, as without one.
class FallbackUnavailableError extends AgentError {
	constructor(readonly fallback: Fallback) {
		super(`opencode unavailable: ${fallback.status}`)
	}
}

// What one run needs to start an agent.
interface Agents {
	outDir: string
	repoRoot: string
	claudeModel: string
	// null: the fallback is switched off.
	fallbackModel: string | null
}

async function runClaude(prompt: string, schema: OutputJsonSchema, agents: Agents, name: string): Promise<string> {
	const result = await runProcess('claude', claudeArgs(prompt, schema, agents.claudeModel), path.join(agents.outDir, `${name}.log`))
	if (!result.ok) throw new AgentError(`claude ${name} ${result.detail}`)
	const envelope: unknown = JSON.parse(result.stdout)
	if (typeof envelope !== 'object' || envelope === null || !('structured_output' in envelope)) throw new Error('no structured_output in the response envelope')
	return JSON.stringify(envelope.structured_output)
}

const describeError = (err: unknown): string => (err instanceof Error ? err.message : String(err))

const firstLine = (err: unknown): string => describeError(err).split('\n')[0] ?? ''

// One `opencode run`, read-only (the `plan` agent) from the repository root. A
// missing binary, a non-zero exit or an error event means OpenCode cannot serve
// as the fallback; the caller judges the reply.
async function opencodeTurn(model: string, message: string, sessionId: string | null, agents: Agents, logName: string): Promise<{text: string; sessionId: string | null}> {
	const args = ['run', '--standalone', '--agent', 'plan', '-m', model, '--format', 'json', ...(sessionId === null ? [] : ['--session', sessionId]), message]
	const logFile = path.join(agents.outDir, `${logName}.log`)
	const result = await runProcess('opencode', args, logFile, agents.repoRoot)
	if (result.spawnCode === 'ENOENT') throw new FallbackUnavailableError({status: 'missing', model, detail: 'the opencode binary was not found on PATH'})
	const output = parseOpencodeOutput(result.stdout)
	if (output.error !== null || !result.ok) throw new FallbackUnavailableError({status: 'failed', model, detail: output.error ?? result.detail})
	return output
}

// OpenCode has no structured output: the schema rides in the prompt, the last
// JSON object of the reply is validated, and a reply without a valid one gets
// one follow-up in the same session before it counts as a failed reviewer.
async function runOpencode<T>(prompt: string, schema: OutputJsonSchema, agents: Agents, name: string, parse: (value: unknown) => T): Promise<T> {
	const model = agents.fallbackModel
	if (model === null) throw new FallbackUnavailableError({status: 'disabled'})
	const judge = (text: string): {ok: true; value: T} | {ok: false; problem: string} => {
		const value = lastJsonObject(text)
		if (value === undefined) return {ok: false, problem: 'no JSON object in the reply'}
		try {
			return {ok: true, value: parse(value)}
		} catch (err) {
			return {ok: false, problem: firstLine(err)}
		}
	}
	const full = opencodePrompt(prompt, schema)
	const first = await opencodeTurn(model, full, null, agents, name)
	const firstJudged = judge(first.text)
	if (firstJudged.ok) return firstJudged.value
	// Without a session id to continue, the follow-up rides on the whole prompt again.
	const retry = await opencodeTurn(model, first.sessionId === null ? `${full}\n\n${OPENCODE_RETRY}` : OPENCODE_RETRY, first.sessionId, agents, `${name}-retry`)
	const retryJudged = judge(retry.text)
	if (retryJudged.ok) return retryJudged.value
	throw new InvalidFallbackReplyError(model, `opencode ${name} returned no valid JSON for the schema, twice (${retryJudged.problem}); see ${path.join(agents.outDir, `${name}-retry.log`)}`, retryJudged.problem)
}

// OpenCode ran but never returned a valid review: a failed reviewer.
class InvalidFallbackReplyError extends AgentError {
	constructor(
		readonly model: string,
		message: string,
		readonly problem: string
	) {
		super(message)
	}
}

// Runs one agent and parses its answer, so every failure — the process, the
// envelope, or a reply that breaks the schema — names the agent and its log.
async function runAgent<T>(engine: Engine, prompt: string, schema: OutputJsonSchema, agents: Agents, name: string, parse: (value: unknown) => T): Promise<T> {
	if (engine === 'opencode') return runOpencode(prompt, schema, agents, name, parse)
	try {
		const text = await (engine === 'codex' ? runCodex : runClaude)(prompt, schema, agents, name)
		const value: unknown = JSON.parse(text)
		return parse(value)
	} catch (err) {
		if (err instanceof AgentError) throw err
		throw new AgentError(`${engine} ${name} returned an unusable answer (${firstLine(err)}); see ${path.join(agents.outDir, `${name}.log`)}`)
	}
}

async function review(engine: Engine, lane: Lane, scope: ReviewScope, agents: Agents): Promise<Candidate[]> {
	const findings = await runAgent(engine, reviewPrompt(scope, lane), reviewJsonSchema, agents, `review-${engine}-${lane.id}`, value => parseReviewOutput(value, agents.repoRoot))
	return toCandidates(engine, lane.id, findings)
}

// `author` is the tool that reported them; the same tool checking them is the
// Codex-unavailable self-check. Only Claude and Codex ever check.
async function verify(engine: 'claude' | 'codex', author: Engine, reports: readonly Candidate[], scope: ReviewScope, agents: Agents): Promise<Map<string, Checked>> {
	if (reports.length === 0) return new Map()
	const ids = reports.map(r => r.id)
	const payload = reports.map(r => ({id: r.id, title: r.title, body: r.body, file: r.file, lineStart: r.lineStart, lineEnd: r.lineEnd, severity: r.severity}))
	const name = engine === author ? `verify-${engine}-self` : `verify-${engine}-of-${author}`
	const verdicts = await runAgent(engine, verifyPrompt(scope, JSON.stringify(payload, null, 2), engine === author), verdictJsonSchema, agents, name, value => parseVerdicts(value, ids))
	return new Map([...verdicts].map(([id, verdict]) => [id, {verdict, by: engine}]))
}

// The base a run compares against when --base is not given: the remote's
// default branch, or the local branch of that name in a repository without one.
function defaultBase(git: Git): {base: string; remoteRef: string; remoteExists: boolean} {
	const {branch, remoteRef} = defaultBranch(git)
	const remoteExists = refExists(git, remoteRef)
	return {base: remoteExists || !refExists(git, branch) ? remoteRef : branch, remoteRef, remoteExists}
}

async function printContext(): Promise<void> {
	let git: Git
	let repoRoot: string
	try {
		git = gitIn(process.cwd())
		repoRoot = git(['rev-parse', '--show-toplevel']).trim()
	} catch {
		console.log('\nNot inside a git work tree: run it from the repository to review.')
		return
	}
	const {base, remoteRef, remoteExists} = defaultBase(git)
	const project = await describeProject(repoRoot, repoName(git, repoRoot))
	const learnings = await readLearnings(repoRoot, process.env[LEARNINGS_ENV])
	const fallbackModel = fallbackModelFrom(process.env)
	const fallback = fallbackModel === null ? `none (${FALLBACK_MODEL_ENV}=none)` : `opencode:${fallbackModel} when Codex is unavailable${Bun.which('opencode') === null ? ' (opencode is not on PATH, so Claude would stand in)' : ''}`
	console.log(`
Repository context:
  root:       ${repoRoot}
  project:    ${project.name}${project.source ? ` (described from ${project.source})` : ' (no AGENTS.md, CLAUDE.md or README.md paragraph found)'}
  base:       ${base}${remoteExists ? '' : ` (${remoteRef} not found${base === remoteRef ? '' : '; using the local branch'})`}
  learnings:  ${learnings.sources.length > 0 ? learnings.sources.join(', ') : `none (${LEARNINGS_FILE} or $${LEARNINGS_ENV})`}
  reports:    ${reviewDir(git)}
  claude:     claude:${claudeModelFrom(process.env)}
  fallback:   ${fallback}`)
}

async function main(): Promise<number> {
	const {values} = parseArgs({options: {base: {type: 'string'}, light: {type: 'boolean', default: false}, out: {type: 'string'}, help: {type: 'boolean', short: 'h', default: false}}})
	if (values.help) {
		console.log(USAGE)
		await printContext()
		return 0
	}
	const git = gitIn(process.cwd())
	const run = (args: string[]): string => git(args).trim()
	const repoRoot = run(['rev-parse', '--show-toplevel'])
	const {base: fallbackBase, remoteRef, remoteExists} = defaultBase(git)
	const base = values.base ?? fallbackBase
	// Resolved once: every reviewer and the review record name this commit, even
	// if HEAD moves while the review runs.
	const headSha = run(['rev-parse', '--verify', 'HEAD^{commit}'])
	const head = run(['rev-parse', '--short', headSha])
	const mergeBase = run(['merge-base', base, headSha]).slice(0, 12)
	const files = run(['diff', '--stat=200', `${mergeBase}...${headSha}`])
	if (files === '') {
		console.error(`dual review: nothing to review between ${base} and HEAD.`)
		return 2
	}
	// check-head measures against the remote's default branch, so without it there is nothing to record.
	const reviewed = remoteExists ? reviewedSnapshot(git, remoteRef, headSha) : null
	const outDir = path.resolve(repoRoot, values.out ?? path.join(reviewDir(git), `${head}-${Date.now()}`))
	await mkdir(outDir, {recursive: true})
	const learnings = await readLearnings(repoRoot, process.env[LEARNINGS_ENV])
	const project = await describeProject(repoRoot, repoName(git, repoRoot))
	const scope: ReviewScope = {project, mergeBase, head, commits: run(['log', '--format=- %h %s%n%w(0,2,2)%b', `${mergeBase}..${headSha}`]), files, learnings: learnings.text}
	const changed = parseChangedRanges(run(['-c', 'core.quotePath=false', 'diff', '-U0', '--no-color', '--no-ext-diff', `${mergeBase}...${headSha}`]))

	const failures: string[] = []
	const codex: {skipped: CodexUnavailability | null} = {skipped: null}
	// A Codex call that finds Codex unusable ends its use for the rest of the run.
	const noteSkip = (err: unknown): boolean => {
		if (!(err instanceof CodexUnavailableError)) return false
		codex.skipped ??= err.unavailability
		return true
	}

	const agents: Agents = {outDir, repoRoot, claudeModel: claudeModelFrom(process.env), fallbackModel: fallbackModelFrom(process.env)}
	const ran: string[] = []
	// Runs one reviewer; a failure is recorded and yields no findings.
	const runOne = async (engine: Engine, lane: Lane): Promise<Candidate[]> => {
		try {
			const found = await review(engine, lane, scope, agents)
			ran.push(`${engine}:${lane.id}`)
			return found
		} catch (err) {
			if (engine === 'codex' && noteSkip(err)) return standIn()
			failures.push(describeError(err))
			return []
		}
	}

	// Codex's whole-change slot when Codex is unavailable: the OpenCode fallback,
	// else (switched off, missing, failed to run) Claude in a light run, as
	// before; a full run then keeps its four Claude lanes alone.
	const fallback: {status: Fallback | null} = {status: null}
	const standIn = async (): Promise<Candidate[]> => {
		const reason = codex.skipped?.reason ?? 'unavailable'
		if (agents.fallbackModel !== null) {
			console.error(`dual review: Codex is unavailable (${reason}); opencode:${agents.fallbackModel} reviews the whole change in its place`)
			try {
				const found = await review('opencode', WHOLE_CHANGE_LANE, scope, agents)
				ran.push(`opencode:${WHOLE_CHANGE_LANE.id}`)
				fallback.status = {status: 'reviewed', model: agents.fallbackModel}
				return found
			} catch (err) {
				if (err instanceof InvalidFallbackReplyError) {
					fallback.status = {status: 'invalid', model: err.model, detail: err.problem}
					failures.push(describeError(err))
					return []
				}
				if (!(err instanceof FallbackUnavailableError)) throw err
				fallback.status = err.fallback
				console.error(`dual review: the OpenCode fallback did not run (${describeError(err)})`)
			}
		} else fallback.status = {status: 'disabled'}
		if (!values.light) return []
		console.error(`dual review: a single Claude reviewer takes Codex's place`)
		return runOne('claude', WHOLE_CHANGE_LANE)
	}

	const first: (readonly [Engine, Lane])[] = [['codex', WHOLE_CHANGE_LANE], ...(values.light ? [] : CLAUDE_LANES.map(lane => ['claude', lane] as const))]
	console.error(`dual review: ${first.map(([e, l]) => `${e}:${l.id}`).join(', ')} on ${mergeBase}..${head}; claude:${agents.claudeModel}; logs in ${outDir}`)
	const all = (await Promise.all(first.map(([engine, lane]) => runOne(engine, lane)))).flat()

	const checks = new Map<string, Checked>()
	const check = async (author: Engine, reports: readonly Candidate[]): Promise<void> => {
		const engine = verifierFor(reports[0], codex.skipped === null)
		try {
			for (const [id, c] of await verify(engine, author, reports, scope, agents)) checks.set(id, c)
		} catch (err) {
			// Codex ran out between the review and the check: Claude checks in its place.
			if (engine === 'codex' && noteSkip(err)) return check(author, reports)
			failures.push(describeError(err))
		}
	}
	const AUTHORS = ['claude', 'codex', 'opencode'] as const
	const byAuthor = (engine: Engine): Candidate[] => all.filter(c => c.engine === engine)
	console.error(`dual review: ${all.length} findings go to checking (${AUTHORS.map(a => `${byAuthor(a).length} by ${a}`).join(', ')})`)
	await Promise.all(AUTHORS.filter(author => byAuthor(author).length > 0).map(author => check(author, byAuthor(author))))

	const pairs = new Map<string, {author: Engine; by: Engine}>()
	for (const c of all) {
		const by = checks.get(c.id)?.by
		if (by !== undefined) pairs.set(`${c.engine}>${by}`, {author: c.engine, by})
	}
	const coverage: Coverage = {reviewers: ran, verifiers: [...new Set([...checks.values()].map(c => c.by))], checks: [...pairs.values()], codexSkipped: codex.skipped, fallback: fallback.status, claudeModel: agents.claudeModel}
	if (ran.length === 0 && failures.length === 0) failures.push('no reviewer completed')

	const resolved = resolveCandidates(all, checks, changed)
	const report = renderReport({base: mergeBase, head, resolved, failures, coverage})
	await writeFile(path.join(outDir, 'report.md'), report)
	await writeFile(path.join(outDir, 'report.json'), JSON.stringify({base: mergeBase, head, failures, coverage, resolved}, null, '\t'))
	console.log(report)
	console.error(`dual review: ${coverageSummary(coverage)}`)
	console.error(`dual review: report at ${path.join(outDir, 'report.md')}`)
	if (failures.length > 0) return 2
	// A complete review, whatever it found, is what check-head lets through:
	// the commit the reviewers were given, not whatever HEAD is now.
	if (reviewed === null) console.error(`dual review: no ${remoteRef}, so this review is not recorded for check-head`)
	else {
		await recordReviewed(git, reviewed)
		if (run(['rev-parse', 'HEAD']) !== headSha) console.error(`dual review: HEAD moved while the review ran; recorded ${head} as reviewed, and the commits after it still need a review`)
	}
	return needsAction(resolved) ? 1 : 0
}

// A run that cannot start (bad arguments, not a repository, an unknown base)
// reviewed nothing, which is exit 2, never the "something to fix" of exit 1.
process.exitCode = await main().catch((err: unknown) => {
	console.error(`dual review: ${describeError(err)}`)
	return 2
})
