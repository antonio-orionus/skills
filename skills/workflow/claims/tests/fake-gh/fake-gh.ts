// Answers the few gh calls the claims CLI makes from a JSON file named by
// FAKE_GH_STATE: {issues: [{number, title, body, state, labels, comments}], prs: [...]}.
import {readFileSync} from 'node:fs'

interface Item {
	number: number
	title: string
	body: string
	state: 'open' | 'closed'
	labels?: string[]
	comments?: {createdAt: string; body: string}[]
}
const state = JSON.parse(readFileSync(process.env.FAKE_GH_STATE ?? '', 'utf8')) as {issues: Item[]; prs: Item[]}
const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
	const i = args.indexOf(name)
	return i === -1 ? undefined : args[i + 1]
}
const pick = (item: Item, fields: string): Record<string, unknown> => Object.fromEntries(fields.split(',').map(f => [f, item[f as keyof Item]]))

const [noun, verb] = args
if (noun === 'issue' && verb === 'list') {
	const label = flag('--label')
	const open = state.issues.filter(i => i.state === 'open' && (label === undefined || (i.labels ?? []).includes(label)))
	console.log(JSON.stringify(open.map(i => pick(i, flag('--json') ?? 'number'))))
} else if (noun === 'pr' && verb === 'list') {
	console.log(JSON.stringify(state.prs.filter(p => p.state === 'open').map(p => pick(p, flag('--json') ?? 'number'))))
} else if (noun === 'issue' && verb === 'view') {
	const item = state.issues.find(i => i.number === Number(args[2]))
	if (!item) process.exit(1)
	console.log(JSON.stringify({comments: item.comments ?? []}))
} else if (noun === 'api') {
	const number = Number(/issues\/(\d+)/.exec(verb ?? '')?.[1])
	const item = [...state.issues, ...state.prs].find(i => i.number === number)
	if (!item) process.exit(1)
	console.log(item.state)
} else {
	console.error(`fake gh: unhandled ${args.join(' ')}`)
	process.exit(2)
}
