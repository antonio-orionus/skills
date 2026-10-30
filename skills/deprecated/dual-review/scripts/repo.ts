// What the review needs to know about the repository it runs in, read from the
// repository itself: its default branch, a description of the project, the
// review learnings it keeps, and where review output goes (its git dir, never
// the working tree).

import {readFile, realpath} from 'node:fs/promises'
import path from 'node:path'
import type {Git} from './git'

const REMOTE = 'origin'
const FALLBACK_BRANCH = 'main'

export interface DefaultBranch {
	// The branch name, e.g. `main`.
	branch: string
	// Its remote-tracking ref, e.g. `origin/main`; it may not exist locally.
	remoteRef: string
}

// The remote's default branch from `refs/remotes/origin/HEAD` (set by clone or
// `git remote set-head origin --auto`), else `main`.
export function defaultBranch(git: Git): DefaultBranch {
	const prefix = `refs/remotes/${REMOTE}/`
	let branch = FALLBACK_BRANCH
	try {
		const target = git(['symbolic-ref', '--quiet', `${prefix}HEAD`]).trim()
		if (target.startsWith(prefix) && target.length > prefix.length) branch = target.slice(prefix.length)
	} catch {
		// No origin/HEAD: keep the fallback.
	}
	return {branch, remoteRef: `${REMOTE}/${branch}`}
}

export function refExists(git: Git, ref: string): boolean {
	try {
		git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])
		return true
	} catch {
		return false
	}
}

// Where reports and the reviewed-state record go: this worktree's own git dir,
// so nothing lands in the working tree and worktrees do not share a record.
export const reviewDir = (git: Git): string => path.join(git(['rev-parse', '--absolute-git-dir']).trim(), 'dual-review')

const stripGitSuffix = (name: string): string => name.replace(/\.git$/, '')

// The repository's name: the origin URL's last segment, else the main
// checkout's folder (a linked worktree's own folder is often a branch name).
export function repoName(git: Git, repoRoot: string): string {
	try {
		const url = git(['remote', 'get-url', REMOTE])
			.trim()
			.replace(/[/\\]+$/, '')
		const last = url.split(/[/:\\]/).pop()
		if (last) return stripGitSuffix(last)
	} catch {
		// No origin: fall through to the folder name.
	}
	try {
		const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir']).trim()
		const name = path.basename(common) === '.git' ? path.basename(path.dirname(common)) : stripGitSuffix(path.basename(common))
		if (name) return name
	} catch {
		// Fall through.
	}
	return path.basename(repoRoot)
}

const MAX_SUMMARY = 600
const SKIPPED_LINE = /^(?:#|<|!\[|\[!\[|@|\||\[[^\]]+\]:\s)/
const THEMATIC_BREAK = /^(?:-{3,}|\*{3,}|_{3,})$/
const SETEXT_UNDERLINE = /^(?:=+|-+)$/

// The first prose paragraph of a Markdown file: frontmatter, headings, HTML,
// badges, images, imports (`@file`), tables and code blocks are skipped.
export function firstParagraph(markdown: string): string | null {
	const text = markdown.replace(/^﻿/, '').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
	let paragraph: string[] = []
	let fenced = false
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim()
		if (/^(?:```|~~~)/.test(line)) {
			fenced = !fenced
			if (paragraph.length > 0) break
			continue
		}
		if (fenced) continue
		// A setext underline turns the lines above it into a heading.
		if (paragraph.length > 0 && SETEXT_UNDERLINE.test(line)) {
			paragraph = []
			continue
		}
		if (line === '' || SKIPPED_LINE.test(line) || THEMATIC_BREAK.test(line)) {
			if (paragraph.length > 0) break
			continue
		}
		paragraph.push(line.replace(/^>\s?/, ''))
	}
	const joined = paragraph.join(' ').replace(/\s+/g, ' ').trim()
	if (joined === '') return null
	return joined.length > MAX_SUMMARY ? `${joined.slice(0, MAX_SUMMARY - 1).trimEnd()}…` : joined
}

export interface Project {
	name: string
	// The first paragraph of the first describing file that has one, and that file.
	summary: string | null
	source: string | null
}

const DESCRIBING_FILES = ['AGENTS.md', 'CLAUDE.md', 'README.md']

async function readIfPresent(file: string): Promise<string | null> {
	try {
		return await readFile(file, 'utf8')
	} catch (err) {
		if (err instanceof Error && 'code' in err && (err.code === 'ENOENT' || err.code === 'EISDIR')) return null
		throw err
	}
}

export async function describeProject(repoRoot: string, name: string): Promise<Project> {
	for (const file of DESCRIBING_FILES) {
		const text = await readIfPresent(path.join(repoRoot, file))
		const summary = text === null ? null : firstParagraph(text)
		if (summary !== null) return {name, summary, source: file}
	}
	return {name, summary: null, source: null}
}

export const LEARNINGS_FILE = '.agents/memory/review-learnings.md'
export const LEARNINGS_ENV = 'DUAL_REVIEW_LEARNINGS'

export interface Learnings {
	text: string
	// The files that were read, in order.
	sources: string[]
}

const stripFrontmatter = (text: string): string => text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')

// The repository's own learnings file, then the one named by DUAL_REVIEW_LEARNINGS
// (relative to the current directory). A missing file is skipped; any other read
// error must not silently drop rules every reviewer is meant to follow.
export async function readLearnings(repoRoot: string, extra: string | undefined): Promise<Learnings> {
	const candidates = [path.join(repoRoot, LEARNINGS_FILE), ...(extra ? [path.resolve(extra)] : [])]
	const seen = new Set<string>()
	const parts: string[] = []
	const sources: string[] = []
	for (const file of candidates) {
		const text = await readIfPresent(file)
		if (text === null) continue
		const real = await realpath(file)
		if (seen.has(real)) continue
		seen.add(real)
		const body = stripFrontmatter(text).trim()
		if (body === '') continue
		parts.push(body)
		sources.push(file)
	}
	return {text: parts.join('\n\n'), sources}
}
