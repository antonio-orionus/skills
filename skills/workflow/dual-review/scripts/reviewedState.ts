// What the last dual review saw, so check-head can refuse to push anything
// else. The record is the commit the review started on and its merge-base with
// the default branch. A push passes when replaying that reviewed change onto
// the branch's current base gives HEAD's tree exactly: a clean rebase or a
// merge of the default branch does, while any edit, an edit moved elsewhere, a
// resolved conflict, or a squash that drags a stale tree along does not, and
// needs a new review. It lives in this worktree's git dir, never in the tree.

import {mkdir, readFile, writeFile} from 'node:fs/promises'
import path from 'node:path'
import type {Git} from './git'
import {reviewDir} from './repo'
import * as s from './validate'

const STATE_FILE = 'reviewed.json'
const RUN_SCRIPT = path.join(import.meta.dir, 'run.ts')

// Unknown keys are accepted and dropped, so a record from a newer version still reads.
const reviewedStateSchema = s.looseObject({head: s.string(), mergeBase: s.string(), recordedAt: s.string()})
type ReviewedState = s.Infer<typeof reviewedStateSchema>
export type ReviewedSnapshot = Omit<ReviewedState, 'recordedAt'>

export type ReviewCheck = {ok: true} | {ok: false; reason: string}

export const statePath = (git: Git): string => path.join(reviewDir(git), STATE_FILE)

function parseState(text: string): ReviewedState | null {
	try {
		const result = reviewedStateSchema.safeParse(JSON.parse(text))
		return result.success ? result.data : null
	} catch {
		return null
	}
}

// Taken before the reviewers start, of the exact commit they are given: HEAD
// at the end may hold commits no reviewer saw.
export function reviewedSnapshot(git: Git, base: string, commit: string): ReviewedSnapshot {
	const head = git(['rev-parse', '--verify', `${commit}^{commit}`]).trim()
	return {head, mergeBase: git(['merge-base', base, head]).trim()}
}

export async function recordReviewed(git: Git, snapshot: ReviewedSnapshot): Promise<void> {
	const state: ReviewedState = {...snapshot, recordedAt: new Date().toISOString()}
	const file = statePath(git)
	await mkdir(path.dirname(file), {recursive: true})
	await writeFile(file, `${JSON.stringify(state, null, '\t')}\n`)
}

// The tree of the reviewed change merged onto `onto`, or null when it does not
// merge cleanly or its commits are gone (the reflog keeps a squashed-away head).
function replayedTree(git: Git, state: ReviewedState, onto: string): string | null {
	try {
		return git(['merge-tree', '--write-tree', `--merge-base=${state.mergeBase}`, onto, state.head])
			.split('\n')[0]
			.trim()
	} catch {
		return null
	}
}

export async function checkReviewed(git: Git, base: string): Promise<ReviewCheck> {
	let text: string
	try {
		text = await readFile(statePath(git), 'utf8')
	} catch (err) {
		if (err instanceof Error && 'code' in err && err.code === 'ENOENT') return {ok: false, reason: `no review recorded in this worktree; run bun ${RUN_SCRIPT}`}
		throw err
	}
	const state = parseState(text)
	if (state === null) return {ok: false, reason: `unreadable review record at ${statePath(git)}; run bun ${RUN_SCRIPT} again`}
	const reviewed = state.head.slice(0, 12)
	const replayed = replayedTree(git, state, git(['merge-base', base, 'HEAD']).trim())
	if (replayed === null) return {ok: false, reason: `the review of ${reviewed} does not replay cleanly onto the branch's current base (a conflict, or the reviewed commit is gone); run bun ${RUN_SCRIPT} on the branch again`}
	if (replayed === git(['rev-parse', 'HEAD^{tree}']).trim()) return {ok: true}
	return {ok: false, reason: `the branch changed since the review of ${reviewed}; review the new commits with bun ${RUN_SCRIPT} --light --base ${reviewed}, or the whole branch again`}
}
