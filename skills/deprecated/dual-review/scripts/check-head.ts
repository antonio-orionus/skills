#!/usr/bin/env bun
// The pre-push check. Prints the branch's files against the remote's default
// branch, then refuses when the branch undoes work already on it, is not what
// the last run.ts review reviewed (so a squash or edit after review forces a
// new review), or changes files another session claims (the claims skill,
// when it is installed beside this one).
//
//   bun check-head.ts

import {spawnSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import path from 'node:path'
import {gitIn, revertedFiles} from './git'
import {defaultBranch} from './repo'
import {checkReviewed} from './reviewedState'

const CLAIMS = path.join(import.meta.dir, '..', '..', 'claims', 'scripts', 'claims.ts')

async function main(): Promise<number> {
	const git = gitIn(process.cwd())
	const {branch, remoteRef: base} = defaultBranch(git)
	if (spawnSync('git', ['fetch', '--quiet', 'origin', branch], {stdio: ['ignore', 'ignore', 'inherit']}).status !== 0) console.error(`check-head: could not fetch origin ${branch}; using the local ${base}.`)
	console.log(`Files this push changes against ${base} (check them against what the task declared):`)
	console.log(git(['diff', '--stat=200', `${base}...HEAD`]))

	const reverted = revertedFiles(git, base, 'HEAD')
	if (reverted.length > 0) {
		console.error(`check-head: the branch undoes ${reverted.length} file(s) already changed on ${branch}:`)
		for (const r of reverted) console.error(`  ${r.file}  (undoes ${r.undoes})`)
		console.error(`Restore the branch from \`git reflog\`, squash with \`git reset --soft $(git merge-base ${base} HEAD)\`, then rebase onto or merge ${base}.`)
		return 1
	}
	const reviewed = await checkReviewed(git, base)
	if (!reviewed.ok) {
		console.error(`check-head: ${reviewed.reason}.`)
		return 1
	}
	if (existsSync(CLAIMS)) {
		const claims = spawnSync(process.execPath, [CLAIMS, 'check-paths', '--base', base], {stdio: ['ignore', 'inherit', 'inherit']})
		if (claims.status === 1) return 1
		if (claims.status !== 0) console.error('check-head: the claims check could not run; pushing without it.')
	}
	console.error(`check-head: HEAD is the reviewed change and undoes nothing on ${branch}.`)
	return 0
}

process.exitCode = await main().catch((err: unknown) => {
	console.error(`check-head: ${err instanceof Error ? err.message : String(err)}`)
	return 1
})
