import * as entry from '../src/index';

describe('package entry (src/index.js)', () => {
	it('re-exports classes, errors, constants, schema, and registry functions', () => {
		// Assert: classes
		expect(typeof entry.TransportUri).toBe('function');
		expect(typeof entry.ShareAccountAddressUri).toBe('function');
		expect(typeof entry.ShareTransferTransactionUri).toBe('function');
		expect(typeof entry.RequestSendTransactionUri).toBe('function');

		// Assert: error classes
		expect(typeof entry.ValidationError).toBe('function');
		expect(typeof entry.ParseError).toBe('function');
		expect(typeof entry.UnsupportedActionError).toBe('function');

		// Assert: constants
		expect(typeof entry.URI_SCHEME).toBe('string');
		expect(typeof entry.PROTOCOL_VERSION).toBe('string');
		expect(typeof entry.ActionType).toBe('object');
		expect(typeof entry.ParameterType).toBe('object');

		// Assert: schema
		expect(typeof entry.ParameterConfig).toBe('object');
		expect(typeof entry.ParameterTypeHandlers).toBe('object');

		// Assert: registry functions
		expect(typeof entry.getActionClass).toBe('function');
		expect(typeof entry.isActionSupported).toBe('function');
		expect(typeof entry.getSupportedRequestMethods).toBe('function');
		expect(typeof entry.getSupportedShareMethods).toBe('function');
	});

	it('returns correct scheme and version', () => {
		// Assert:
		expect(entry.URI_SCHEME).toBe('web+symbol');
		expect(entry.PROTOCOL_VERSION).toBe('v1');
	});

	it('returns correct supported methods from registry functions', () => {
		// Assert:
		expect(entry.getSupportedRequestMethods()).toEqual(['sendTransaction']);
		expect(entry.getSupportedShareMethods()).toEqual(['accountAddress', 'transferTransaction']);
	});
});
