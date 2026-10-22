// A small runtime validator for the shapes the review CLIs return, so the skill
// needs no dependencies. Each schema parses `unknown` into a typed value and
// emits the JSON Schema handed to the CLIs for structured output.
//
// Behaviour: `object` rejects keys it does not declare, `looseObject` accepts
// and drops them; every declared key is required; numbers must be finite. The
// JSON Schema carries no `$schema` key (the Claude CLI rejects one) and no
// bounds keywords (Codex's strict structured output rejects some of them).

export type JsonSchema = {[key: string]: unknown}

export class ValidationError extends Error {
	constructor(
		readonly path: string,
		readonly problem: string
	) {
		super(`${path === '' ? 'value' : path}: ${problem}`)
		this.name = 'ValidationError'
	}
}

export type SafeParse<T> = {success: true; data: T} | {success: false; error: ValidationError}

export interface Schema<T> {
	parse(value: unknown): T
	safeParse(value: unknown): SafeParse<T>
	jsonSchema(): JsonSchema
	// Validates `value` at `path`; throws ValidationError.
	check(value: unknown, path: string): T
}

export type Infer<S> = S extends Schema<infer T> ? T : never

function describe(value: unknown): string {
	if (value === null) return 'null'
	if (Array.isArray(value)) return 'array'
	if (typeof value === 'number' && !Number.isFinite(value)) return String(value)
	return typeof value
}

function schema<T>(check: (value: unknown, path: string) => T, jsonSchema: () => JsonSchema): Schema<T> {
	return {
		check,
		jsonSchema,
		parse: value => check(value, ''),
		safeParse(value) {
			try {
				return {success: true, data: check(value, '')}
			} catch (err) {
				if (err instanceof ValidationError) return {success: false, error: err}
				throw err
			}
		}
	}
}

const fail = (path: string, expected: string, value: unknown): never => {
	throw new ValidationError(path, `expected ${expected}, received ${describe(value)}`)
}

export const string = (): Schema<string> => schema(
	(value, path) => (typeof value === 'string' ? value : fail(path, 'string', value)),
	() => ({type: 'string'})
)

export const number = (): Schema<number> => schema(
	(value, path) => (typeof value === 'number' && Number.isFinite(value) ? value : fail(path, 'finite number', value)),
	() => ({type: 'number'})
)

export const boolean = (): Schema<boolean> => schema(
	(value, path) => (typeof value === 'boolean' ? value : fail(path, 'boolean', value)),
	() => ({type: 'boolean'})
)

export function enumOf<const V extends readonly [string, ...string[]]>(values: V): Schema<V[number]> {
	const allowed = new Set<string>(values)
	const isMember = (value: unknown): value is V[number] => typeof value === 'string' && allowed.has(value)
	return schema(
		(value, path) => (isMember(value) ? value : fail(path, `one of ${values.map(v => JSON.stringify(v)).join(', ')}`, value)),
		() => ({type: 'string', enum: [...values]})
	)
}

export function array<T>(items: Schema<T>): Schema<T[]> {
	return schema(
		(value, path) => (Array.isArray(value) ? value.map((item: unknown, i) => items.check(item, `${path}[${i}]`)) : fail(path, 'array', value)),
		() => ({type: 'array', items: items.jsonSchema()})
	)
}

type Shape = {[key: string]: Schema<unknown>}
export type ObjectOf<S extends Shape> = {[K in keyof S]: Infer<S[K]>}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

function objectSchema<S extends Shape>(shape: S, strict: boolean): Schema<ObjectOf<S>> {
	const keys = Object.keys(shape)
	const declared = new Set(keys)
	return schema(
		(value, path) => {
			if (!isRecord(value)) return fail(path, 'object', value)
			const at = (key: string): string => (path === '' ? key : `${path}.${key}`)
			if (strict) {
				const extra = Object.keys(value).find(key => !declared.has(key))
				if (extra !== undefined) throw new ValidationError(at(extra), 'unrecognized key')
			}
			const out: Record<string, unknown> = {}
			for (const key of keys) out[key] = shape[key].check(value[key], at(key))
			// Every key of S was checked and copied above.
			return out as ObjectOf<S>
		},
		() => ({type: 'object', properties: Object.fromEntries(keys.map(key => [key, shape[key].jsonSchema()])), required: keys, additionalProperties: false})
	)
}

// Rejects keys the shape does not declare.
export const object = <S extends Shape>(shape: S): Schema<ObjectOf<S>> => objectSchema(shape, true)

// Accepts keys the shape does not declare and drops them from the result.
export const looseObject = <S extends Shape>(shape: S): Schema<ObjectOf<S>> => objectSchema(shape, false)
