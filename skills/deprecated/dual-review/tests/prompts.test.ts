import {describe, expect, it} from 'bun:test'

import {CLAUDE_LANES, OPENCODE_RETRY, UI_LANE, WHOLE_CHANGE_LANE, opencodePrompt, reviewPrompt, verifyPrompt, type ReviewScope} from '../scripts/prompts'

const LEARNINGS = '- Do not raise security hardening: this tool runs locally (2026-10-20).'
const SCOPE: ReviewScope = {project: {name: 'widget', summary: 'Widget renders charts from CSV files.', source: 'AGENTS.md'}, mergeBase: 'abc', head: 'def', commits: '- def a change', files: ' a.ts | 1 +', learnings: LEARNINGS, screenshots: []}

const allPrompts = (scope: ReviewScope): string[] => [...[WHOLE_CHANGE_LANE, ...CLAUDE_LANES, UI_LANE].map(lane => reviewPrompt(scope, lane)), verifyPrompt(scope, '[]', false), verifyPrompt(scope, '[]', true), verifyPrompt(scope, '[]', true, true)]

const occurrences = (text: string, needle: string): number => text.split(needle).length - 1

describe('dual review prompts', () => {
	// Out-of-scope rules have one home, the learnings: a copy in the prompt itself drifts from it.
	it('carry the learnings exactly once in every review and verify prompt', () => {
		for (const prompt of allPrompts(SCOPE)) {
			expect(occurrences(prompt, LEARNINGS)).toBe(1)
			expect(occurrences(prompt, 'security hardening')).toBe(1)
		}
	})

	it('leave the learnings block out when there are none', () => {
		for (const prompt of allPrompts({...SCOPE, learnings: '  '})) expect(prompt).not.toContain('Lessons from earlier reviews')
	})

	it('name the project and quote its description', () => {
		for (const prompt of allPrompts(SCOPE)) {
			expect(prompt).toContain('the repository "widget"')
			expect(prompt).toContain('from its AGENTS.md:\n> Widget renders charts from CSV files.')
		}
		for (const prompt of allPrompts({...SCOPE, project: {name: 'widget', summary: null, source: null}})) expect(prompt).not.toContain('About the project')
	})

	it('point at the repository’s documented rules instead of any one project’s files or commands', () => {
		const text = allPrompts(SCOPE).join('\n')
		expect(text).toContain('AGENTS.md or CLAUDE.md at the root and in changed folders, and the docs they point to')
		expect(text).toContain("the repository's linters, type checker and checks")
		expect(text).not.toMatch(/GLOSSARY|DESIGN\.md|bun run|oxlint|knip|shadcn|yt-dlp|Electron|i18n/)
	})

	it('keep the markers the fake reviewer in run.test.ts splits on', () => {
		expect(reviewPrompt(SCOPE, CLAUDE_LANES[0])).toContain('Your focus:\nRegressions')
		expect(verifyPrompt(SCOPE, '[]', false)).toContain('Findings to check (JSON, one entry per id):\n[]\n\nFor each id')
	})

	it('show the screenshots to the UI lane and to a UI check only', () => {
		const shots = {...SCOPE, screenshots: ['/shots/settings-dark.png', '/shots/queue-empty.png']}
		const block = 'Screenshots of the change, rendered (open each with Read; the file name says what it shows):\n- /shots/settings-dark.png\n- /shots/queue-empty.png'
		expect(reviewPrompt(shots, UI_LANE)).toContain(block)
		expect(verifyPrompt(shots, '[]', true, true)).toContain(block)
		for (const prompt of [...[WHOLE_CHANGE_LANE, ...CLAUDE_LANES].map(lane => reviewPrompt(shots, lane)), verifyPrompt(shots, '[]', false)]) expect(prompt).not.toContain('Screenshots of the change')
		expect(reviewPrompt(SCOPE, UI_LANE)).not.toContain('Screenshots of the change')
	})

	it('treat a visual or usability defect as a finding, not as style, and leave its judgment out of the whole-change lane', () => {
		for (const prompt of allPrompts(SCOPE)) expect(prompt).not.toMatch(/- Style,|\(style,/)
		expect(reviewPrompt(SCOPE, WHOLE_CHANGE_LANE)).toContain('A visual or usability defect in the UI is not style.')
		expect(reviewPrompt(SCOPE, WHOLE_CHANGE_LANE)).toContain('leave judgments of looks and usability to the UI reviewer')
		expect(reviewPrompt(SCOPE, UI_LANE)).toContain('Your focus:\nWhat the user sees')
	})

	// OpenCode has no structured-output flag, so the schema travels in the prompt.
	it('give OpenCode the schema and ask for one bare JSON object', () => {
		const schema = {type: 'object', properties: {findings: {type: 'array'}}}
		const prompt = opencodePrompt(reviewPrompt(SCOPE, WHOLE_CHANGE_LANE), schema)
		expect(prompt).toStartWith(reviewPrompt(SCOPE, WHOLE_CHANGE_LANE))
		expect(prompt).toContain(JSON.stringify(schema))
		expect(prompt).toContain('Reply with only one JSON object matching this schema')
		expect(OPENCODE_RETRY).toContain('not valid JSON for the schema')
	})
})
