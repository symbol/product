import {
	cloneDeep,
	equalDeep,
	omit,
	validateFacade,
	validateFields,
	validateNamespacedFacade
} from '../../src/utils/helper';

describe('utils/helper', () => {
	describe('omit', () => {
		it('omits specified keys from a flat object', () => {
			// Arrange:
			const obj = { a: 1, b: 2, c: 3 };
			const keysToOmit = ['b'];
			const expected = { a: 1, c: 3 };

			// Act:
			const result = omit(obj, keysToOmit);

			// Assert:
			expect(result).toStrictEqual(expected);
		});

		it('returns a new object and does not mutate original', () => {
			// Arrange:
			const obj = { a: 1, b: 2 };
			const keysToOmit = ['a'];

			// Act:
			const result = omit(obj, keysToOmit);

			// Assert:
			expect(result).toStrictEqual({ b: 2 });
			expect(obj).toStrictEqual({ a: 1, b: 2 });
			expect(result).not.toBe(obj);
		});

		it('ignores non-existent keys and returns original shape', () => {
			// Arrange:
			const obj = { a: 1, b: 2 };
			const keysToOmit = ['c'];
			const expected = { a: 1, b: 2 };

			// Act:
			const result = omit(obj, keysToOmit);

			// Assert:
			expect(result).toStrictEqual(expected);
		});

		it('returns empty object when omitting all keys', () => {
			// Arrange:
			const obj = { a: 1, b: 2 };
			const keysToOmit = ['a', 'b'];
			const expected = {};

			// Act:
			const result = omit(obj, keysToOmit);

			// Assert:
			expect(result).toStrictEqual(expected);
		});
	});

	describe('cloneDeep', () => {
		it('returns primitives as-is', () => {
			// Arrange:
			const values = [null, undefined, 1, 'test', true];

			// Act & Assert:
			values.forEach(value => {
				const cloned = cloneDeep(value);
				expect(cloned).toBe(value);
			});
		});

		it('deep clones arrays recursively', () => {
			// Arrange:
			const original = [1, [2, 3], { a: 4 }];
			const expected = [1, [2, 3], { a: 4 }];

			// Act:
			const cloned = cloneDeep(original);

			// Assert:
			expect(cloned).toStrictEqual(expected);
			expect(cloned).not.toBe(original);
			expect(cloned[1]).not.toBe(original[1]);
			expect(cloned[2]).not.toBe(original[2]);
		});

		it('deep clones plain objects recursively', () => {
			// Arrange:
			const original = {
				a: 1,
				b: {
					c: 2,
					d: [3, 4]
				}
			};
			const expected = {
				a: 1,
				b: {
					c: 2,
					d: [3, 4]
				}
			};

			// Act:
			const cloned = cloneDeep(original);

			// Assert:
			expect(cloned).toStrictEqual(expected);
			expect(cloned).not.toBe(original);
			expect(cloned.b).not.toBe(original.b);
			expect(cloned.b.d).not.toBe(original.b.d);
		});

		it('does not copy inherited properties', () => {
			// Arrange:
			const proto = { inherited: 'x' };
			const obj = Object.create(proto);
			obj.own = 1;

			// Act:
			const cloned = cloneDeep(obj);

			// Assert:
			expect(cloned).toStrictEqual({ own: 1 });
			expect('inherited' in cloned).toBe(false);
		});
	});

	describe('equalDeep', () => {
		it('returns true for strictly equal primitives', () => {
			// Arrange:
			const values = [null, undefined, 0, 'a', true];

			// Act & Assert:
			values.forEach(value => {
				expect(equalDeep(value, value)).toBe(true);
			});
		});

		it('returns false for different primitives', () => {
			// Act & Assert:
			expect(equalDeep(1, 2)).toBe(false);
			expect(equalDeep('a', 'b')).toBe(false);
			expect(equalDeep(true, false)).toBe(false);
		});

		it('compares arrays deeply and respects order', () => {
			// Arrange:
			const a = [1, 2, [3, 4]];
			const b = [1, 2, [3, 4]];
			const c = [1, 2, [4, 3]];

			// Act & Assert:
			expect(equalDeep(a, b)).toBe(true);
			expect(equalDeep(a, c)).toBe(false);
		});

		it('returns false for array vs non-array objects', () => {
			// Arrange:
			const a = [1, 2];
			const b = { 0: 1, 1: 2, length: 2 };

			// Act & Assert:
			expect(equalDeep(a, b)).toBe(false);
		});

		it('compares objects deeply and ignores key order', () => {
			// Arrange:
			const a = { a: 1, b: { c: 2 } };
			const b = { b: { c: 2 }, a: 1 };
			const c = { a: 1, b: { c: 3 } };

			// Act & Assert:
			expect(equalDeep(a, b)).toBe(true);
			expect(equalDeep(a, c)).toBe(false);
		});

		it('returns false when keys differ', () => {
			// Arrange:
			const a = { a: 1, b: 2 };
			const b = { a: 1 };

			// Act & Assert:
			expect(equalDeep(a, b)).toBe(false);
			expect(equalDeep(b, a)).toBe(false);
		});

		it('treats null and objects as not equal', () => {
			// Act & Assert:
			expect(equalDeep(null, {})).toBe(false);
			expect(equalDeep({}, null)).toBe(false);
		});
	});

	describe('validateFields', () => {
		it('does not throw when all required fields with correct types are present', () => {
			// Arrange:
			const obj = { name: 'Alice', age: 30, active: true };
			const fields = [
				{ key: 'name', type: 'string' },
				{ key: 'age', type: 'number' },
				{ key: 'active', type: 'boolean' }
			];

			// Act & Assert:
			expect(() => validateFields(obj, fields)).not.toThrow();
		});

		it('throws when a required field is missing', () => {
			// Arrange:
			const obj = { name: 'Alice' };
			const fields = [
				{ key: 'name', type: 'string' },
				{ key: 'age', type: 'number' }
			];

			// Act & Assert:
			expect(() => validateFields(obj, fields)).toThrow('Missing required field: "age"');
		});

		it('throws when a field has invalid type', () => {
			// Arrange:
			const obj = { name: 'Alice', age: '30' };
			const fields = [
				{ key: 'name', type: 'string' },
				{ key: 'age', type: 'number' }
			];

			// Act & Assert:
			expect(() => validateFields(obj, fields))
				.toThrow('Invalid type for field "age": expected number, got "string"');
		});
	});

	describe('validateFacade', () => {
		it('does not throw when all required methods exist', () => {
			// Arrange:
			const facade = {
				connect: () => {},
				disconnect: () => {}
			};
			const methods = ['connect', 'disconnect'];

			// Act & Assert:
			expect(() => validateFacade(facade, methods)).not.toThrow();
		});

		it('throws when a method is missing', () => {
			// Arrange:
			const facade = {
				connect: () => {}
			};
			const methods = ['connect', 'disconnect'];

			// Act & Assert:
			expect(() => validateFacade(facade, methods)).toThrow('Missing required method: "disconnect"');
		});

		it('throws when a property is not a function', () => {
			// Arrange:
			const facade = {
				connect: () => {},
				disconnect: 'not-a-function'
			};
			const methods = ['connect', 'disconnect'];

			// Act & Assert:
			expect(() => validateFacade(facade, methods)).toThrow('Missing required method: "disconnect"');
		});
	});

	describe('validateNamespacedFacade', () => {
		it('does not throw when all namespaced methods exist', () => {
			// Arrange:
			const facade = {
				account: {
					get: () => {},
					create: () => {}
				},
				transaction: {
					send: () => {}
				}
			};
			const methodPaths = ['account.get', 'account.create', 'transaction.send'];

			// Act & Assert:
			expect(() => validateNamespacedFacade(facade, methodPaths)).not.toThrow();
		});

		it('throws when namespace is missing', () => {
			// Arrange:
			const facade = {
				account: {
					get: () => {}
				}
			};
			const methodPaths = ['transaction.send'];

			// Act & Assert:
			expect(() => validateNamespacedFacade(facade, methodPaths))
				.toThrow('Missing namespace: "transaction"');
		});

		it('throws when namespaced method is missing', () => {
			// Arrange:
			const facade = {
				account: {
					get: () => {}
				}
			};
			const methodPaths = ['account.get', 'account.create'];

			// Act & Assert:
			expect(() => validateNamespacedFacade(facade, methodPaths))
				.toThrow('Missing required method: "account.create" in namespace "account"');
		});

		it('throws when namespaced value is not a function', () => {
			// Arrange:
			const facade = {
				account: {
					get: () => {},
					create: 'not-a-function'
				}
			};
			const methodPaths = ['account.create'];

			// Act & Assert:
			expect(() => validateNamespacedFacade(facade, methodPaths))
				.toThrow('Missing required method: "account.create" in namespace "account"');
		});
	});
});
