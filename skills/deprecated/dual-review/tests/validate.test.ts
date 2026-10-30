import {describe, expect, it} from 'bun:test'

import * as s from '../scripts/validate'

const item = s.object({name: s.string(), size: s.number(), done: s.boolean(), kind: s.enumOf(['a', 'b'])})
const list = s.object({items: s.array(item)})
const good = {name: 'x', size: 1.5, done: false, kind: 'a' as const}

describe('primitives', () => {
	it('accept their own type and reject every other', () => {
		expect(s.string().parse('')).toBe('')
		expect(s.number().parse(-0.25)).toBe(-0.25)
		expect(s.boolean().parse(true)).toBe(true)
		for (const bad of [1, null, undefined, {}, []]) expect(s.string().safeParse(bad).success).toBe(false)
		for (const bad of ['1', null, true, NaN, Infinity, -Infinity]) expect(s.number().safeParse(bad).success).toBe(false)
		for (const bad of [0, 'true', null]) expect(s.boolean().safeParse(bad).success).toBe(false)
	})

	it('enum accepts only its listed strings', () => {
		const kind = s.enumOf(['a', 'b'])
		expect(kind.parse('b')).toBe('b')
		expect(() => kind.parse('c')).toThrow('value: expected one of "a", "b", received string')
		expect(kind.safeParse(1).success).toBe(false)
	})

	it('array checks each item and names the failing index', () => {
		expect(s.array(s.number()).parse([1, 2])).toEqual([1, 2])
		expect(() => s.array(s.number()).parse([1, 'x'])).toThrow('[1]: expected finite number, received string')
		expect(() => s.array(s.number()).parse({0: 1})).toThrow('value: expected array, received object')
	})
})

describe('object', () => {
	it('parses a valid value into a fresh object with the declared keys', () => {
		expect(list.parse({items: [good]})).toEqual({items: [good]})
	})

	it('rejects unknown keys, at any depth', () => {
		expect(() => item.parse({...good, extra: 1})).toThrow('extra: unrecognized key')
		expect(() => list.parse({items: [{...good, extra: 1}]})).toThrow('items[0].extra: unrecognized key')
	})

	it('requires every declared key', () => {
		const {size: _size, ...missing} = good
		expect(() => item.parse(missing)).toThrow('size: expected finite number, received undefined')
	})

	it('rejects non-objects, including arrays and null', () => {
		for (const bad of [null, [], 'x', 1]) expect(item.safeParse(bad).success).toBe(false)
	})

	it('looseObject accepts unknown keys and drops them', () => {
		const loose = s.looseObject({a: s.string()})
		expect(loose.parse({a: 'x', b: 1})).toEqual({a: 'x'})
		expect(loose.safeParse({b: 1}).success).toBe(false)
	})

	it('safeParse returns the error instead of throwing', () => {
		const result = item.safeParse({...good, kind: 'z'})
		expect(result.success).toBe(false)
		if (!result.success) expect(result.error).toBeInstanceOf(s.ValidationError)
		expect(item.safeParse(good)).toEqual({success: true, data: good})
	})
})

describe('jsonSchema', () => {
	it('emits closed objects with every key required, and no $schema or bounds', () => {
		expect(list.jsonSchema()).toEqual({
			type: 'object',
			properties: {
				items: {
					type: 'array',
					items: {
						type: 'object',
						properties: {name: {type: 'string'}, size: {type: 'number'}, done: {type: 'boolean'}, kind: {type: 'string', enum: ['a', 'b']}},
						required: ['name', 'size', 'done', 'kind'],
						additionalProperties: false
					}
				}
			},
			required: ['items'],
			additionalProperties: false
		})
		expect(JSON.stringify(list.jsonSchema())).not.toMatch(/\$schema|minLength|maxLength|minimum|maximum|minItems/)
	})
})
