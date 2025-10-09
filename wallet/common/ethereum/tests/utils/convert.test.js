import { base32ToHex, hexToBase32 } from '../../src/utils/convert';

const symbolAddresses = [
	{ 
		hex: '982C69A051A72BFBE31AEDA7250AC6C747B7570B3E9C00B6', 
		base32: 'TAWGTICRU4V7XYY25WTSKCWGY5D3OVYLH2OABNQ' 
	},
	{ 
		hex: '9819899AA7DD095CC6121FB8B3498F5366A6024E40DB88B9', 
		base32: 'TAMYTGVH3UEVZRQSD64LGSMPKNTKMASOIDNYROI' 
	},
	{ 
		hex: '98223AF34A98119217DC2427C6DE7F577A33D8242A2F54C3', 
		base32: 'TARDV42KTAIZEF64EQT4NXT7K55DHWBEFIXVJQY' 
	},
	{ 
		hex: '98ECBE6DD80E4F7582E66286ACEBCAAE19A179B2FC0DA076', 
		base32: 'TDWL43OYBZHXLAXGMKDKZ26KVYM2C6NS7QG2A5Q' 
	},
	{ 
		hex: '98AE96BE46A8A9B4D12C14F9A5039EA398C93CE02A0763F8', 
		base32: 'TCXJNPSGVCU3JUJMCT42KA46UOMMSPHAFIDWH6A' 
	}
];

describe('utils/convert', () => {
	describe('hexToBase32', () => {
		it('converts empty string to empty string', () => {
			// Arrange:
			const input = '';
			const expected = '';

			// Act & Assert:
			expect(hexToBase32(input)).toBe(expected);
		});

		it('converts known hex values to Base32', () => {
			// Arrange:
			const vectors = [
				...symbolAddresses,
				{ hex: '00', base32: 'AA' },
				{ hex: 'ff', base32: '74' },
				{ hex: '0F', base32: 'B4' },
				{ hex: 'f', base32: '6' },
				{ hex: 'DEAD', base32: '32WQ' },
				{ hex: 'BEEF', base32: 'X3XQ' }
			];

			// Act & Assert:
			vectors.forEach(({ hex, base32 }) => {
				expect(hexToBase32(hex)).toBe(base32);
			});
		});

		it('round-trips hex -> base32 -> hex', () => {
			// Arrange:
			const samples = [
				'',
				'00',
				'FF',
				'0F',
				'f',
				'deadbeef',
				'0123456789abcdef',
				'ABCDEF012345'
			];

			// Act & Assert:
			samples.forEach(hex => {
				const b32 = hexToBase32(hex);
				const back = base32ToHex(b32);
				expect(back).toBe(hex.toUpperCase());
			});
		});
	});

	describe('base32ToHex', () => {
		it('converts empty string to empty string', () => {
			// Arrange:
			const input = '';
			const expected = '';

			// Act & Assert:
			expect(base32ToHex(input)).toBe(expected);
		});

		it('converts known Base32 values to hex', () => {
			// Arrange:
			const vectors = [
				...symbolAddresses,
				{ base32: '', hex: '' },
				{ base32: 'AA', hex: '00' },
				{ base32: 'aa', hex: '00' },
				{ base32: '74', hex: 'FF' },
				{ base32: 'B4', hex: '0F' },
				{ base32: '6', hex: 'F' },
				{ base32: '32WQ', hex: 'DEAD' },
				{ base32: 'X3XQ', hex: 'BEEF' }
			];

			// Act & Assert:
			vectors.forEach(({ base32, hex }) => {
				expect(base32ToHex(base32)).toBe(hex);
			});
		});

		it('round-trips base32 -> hex -> base32', () => {
			// Arrange:
			const samples = [
				'A',
				'AA',
				'B4',
				'74',
				'32WQ',
				'X3XP',
				'CIZFPGQ'
			];

			// Act & Assert:
			samples.forEach(b32 => {
				const hex = base32ToHex(b32);
				const back = hexToBase32(hex);
				expect(back).toBe(b32.toUpperCase());
			});
		});
	});
});
