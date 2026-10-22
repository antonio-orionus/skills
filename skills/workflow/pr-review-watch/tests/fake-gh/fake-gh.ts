// Stand-in for `gh` in CLI tests. Serves a scenario file (FAKE_GH_SCENARIO);
// each `pr view` call advances to the next poll step. Writes are logged to FAKE_GH_LOG.
import {appendFileSync, existsSync, readFileSync, writeFileSync} from 'node:fs'

interface Step {
	head: string
	state?: string
	comments: unknown[]
	reviews?: unknown[]
}
interface Scenario {
	steps: Step[]
	threads?: unknown[]
	failFirstCommentsFetch?: boolean
}

const args = process.argv.slice(2)
const scenario = JSON.parse(readFileSync(process.env.FAKE_GH_SCENARIO!, 'utf8')) as Scenario
const counterFile = `${process.env.FAKE_GH_SCENARIO}.step`
let step = existsSync(counterFile) ? Number(readFileSync(counterFile, 'utf8')) : -1
const cur = (): Step => scenario.steps[Math.min(Math.max(step, 0), scenario.steps.length - 1)]!
const out = (v: unknown): void => console.log(typeof v === 'string' ? v : JSON.stringify(v))
const lines = (items: unknown[]): void => items.forEach(i => out(i))

if (args[0] === 'pr' && args[1] === 'view') {
	step += 1
	writeFileSync(counterFile, String(step))
	const s = cur()
	out({number: 7, url: 'https://github.com/o/r/pull/7', state: s.state ?? 'OPEN', isDraft: false, headRefOid: s.head})
} else if (args[0] === 'pr' && args[1] === 'comment') {
	appendFileSync(process.env.FAKE_GH_LOG!, `${args.join(' ')}\n`)
} else if (args[0] === 'api' && args[1] === 'graphql') {
	out({data: {repository: {pullRequest: {reviewThreads: {pageInfo: {hasNextPage: false, endCursor: null}, nodes: scenario.threads ?? []}}}}})
} else if (args[0] === 'api' && args[1]?.startsWith('repos/') && args[1].includes('/commits/')) {
	out('2026-10-20T06:00:00Z')
} else if (args[0] === 'api' && args[2]?.includes('/issues/')) {
	const failed = `${process.env.FAKE_GH_SCENARIO}.failed`
	if (scenario.failFirstCommentsFetch && !existsSync(failed)) {
		writeFileSync(failed, '1')
		console.error('Post "https://api.github.com/graphql": net/http: TLS handshake timeout')
		process.exit(1)
	}
	lines(cur().comments)
} else if (args[0] === 'api' && args[2]?.includes('/reviews')) {
	lines(cur().reviews ?? [])
} else {
	console.error(`fake gh: unhandled ${args.join(' ')}`)
	process.exit(1)
}
