import {
	ActionType,
	ParameterType,
	ParseError,
	RequestSendTransactionUri,
	ShareAccountAddressUri,
	ShareTransferTransactionUri,
	TransportUri,
	UnsupportedActionError,
	ValidationError
} from '../src/index';

// Constants

const URI_SCHEME = 'web+symbol';
const PROTOCOL_VERSION = 'v1';

// Test Data

const testData = {
	chainName: 'symbol',
	chainId: 'ABC123DEF456',
	networkIdentifier: 'mainnet',
	address: 'TADDRESSXXXXXXXXXXXXXXXXXXXXXXXXX',
	name: 'My Account',
	recipientAddress: 'TRECIPIENTXXXXXXXXXXXXXXXXXXXXXXX',
	tokenId: 'ABCDEF1234567890',
	amount: '1000000',
	message: 'Hello World',
	isMessageEncrypted: false,
	payload: 'DEADBEEF1234567890',
	callbackUrl: 'https://example.com/callback'
};

// Action Configurations

const actionConfigs = [
	{
		actionClass: ShareAccountAddressUri,
		actionType: ActionType.SHARE,
		method: 'accountAddress',
		version: PROTOCOL_VERSION,
		requiredParams: [
			{ name: 'chainName', type: ParameterType.STRING },
			{ name: 'networkIdentifier', type: ParameterType.STRING },
			{ name: 'address', type: ParameterType.STRING }
		],
		optionalParams: [
			{ name: 'name', type: ParameterType.STRING }
		],
		testParameters: {
			required: {
				chainName: testData.chainName,
				networkIdentifier: testData.networkIdentifier,
				address: testData.address
			},
			optional: {
				name: testData.name
			}
		}
	},
	{
		actionClass: ShareTransferTransactionUri,
		actionType: ActionType.SHARE,
		method: 'transferTransaction',
		version: PROTOCOL_VERSION,
		requiredParams: [
			{ name: 'chainName', type: ParameterType.STRING },
			{ name: 'networkIdentifier', type: ParameterType.STRING },
			{ name: 'recipientAddress', type: ParameterType.STRING },
			{ name: 'tokenId', type: ParameterType.STRING }
		],
		optionalParams: [
			{ name: 'amount', type: ParameterType.UINT64_STRING },
			{ name: 'message', type: ParameterType.STRING },
			{ name: 'isMessageEncrypted', type: ParameterType.BOOLEAN }
		],
		testParameters: {
			required: {
				chainName: testData.chainName,
				networkIdentifier: testData.networkIdentifier,
				recipientAddress: testData.recipientAddress,
				tokenId: testData.tokenId
			},
			optional: {
				amount: testData.amount,
				message: testData.message,
				isMessageEncrypted: testData.isMessageEncrypted
			}
		}
	},
	{
		actionClass: RequestSendTransactionUri,
		actionType: ActionType.REQUEST,
		method: 'sendTransaction',
		version: PROTOCOL_VERSION,
		requiredParams: [
			{ name: 'chainId', type: ParameterType.STRING },
			{ name: 'networkIdentifier', type: ParameterType.STRING },
			{ name: 'payload', type: ParameterType.STRING }
		],
		optionalParams: [
			{ name: 'callbackUrl', type: ParameterType.URL }
		],
		testParameters: {
			required: {
				chainId: testData.chainId,
				networkIdentifier: testData.networkIdentifier,
				payload: testData.payload
			},
			optional: {
				callbackUrl: testData.callbackUrl
			}
		}
	}
];

// Helper Functions

const createUriString = (actionType, method, params) => {
	const queryString = Object.entries(params)
		.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
		.join('&');
	return `${URI_SCHEME}://${PROTOCOL_VERSION}/${actionType}/${method}?${queryString}`;
};

const getAllParameters = config => ({
	...config.testParameters.required,
	...config.testParameters.optional
});

// Tests

describe('TransportUri', () => {
	describe('createFromString - valid URIs', () => {
		const runParseStringTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const uriString = createUriString(config.actionType, config.method, config.params);

				// Act:
				const action = TransportUri.createFromString(uriString);

				// Assert:
				expect(action).toBeInstanceOf(config.actionClass);
				expect(action.toJSON()).toStrictEqual(expected.json);
				Object.entries(expected.gettersReturnValues).forEach(([key, value]) => {
					expect(action[key]).toBe(value);
				});
			});
		};

		describe('with optional parameters', () => {
			const tests = actionConfigs.map(config => ({
				description: `parses ${config.actionClass.name} with optional parameters`,
				config: {
					actionClass: config.actionClass,
					method: config.method,
					actionType: config.actionType,
					version: config.version,
					params: getAllParameters(config)
				},
				expected: {
					json: {
						actionType: config.actionType,
						method: config.method,
						version: config.version,
						parameters: getAllParameters(config)
					},
					gettersReturnValues: getAllParameters(config)
				}
			}));

			tests.forEach(test => {
				runParseStringTest(test.description, test.config, test.expected);
			});
		});

		describe('without optional parameters', () => {
			const tests = actionConfigs.map(config => ({
				description: `parses ${config.actionClass.name} without optional parameters`,
				config: {
					actionClass: config.actionClass,
					method: config.method,
					actionType: config.actionType,
					version: config.version,
					params: config.testParameters.required
				},
				expected: {
					json: {
						actionType: config.actionType,
						method: config.method,
						version: config.version,
						parameters: config.testParameters.required
					},
					gettersReturnValues: config.testParameters.required
				}
			}));

			tests.forEach(test => {
				runParseStringTest(test.description, test.config, test.expected);
			});
		});
	});

	describe('createFromString - parameter validation errors', () => {
		describe('unexpected parameter', () => {
			const runUnexpectedParamTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					const uriString = createUriString(config.actionType, config.method, config.params);

					// Act & Assert:
					expect(() => TransportUri.createFromString(uriString))
						.toThrow(expected.errorClass);
				});
			};

			const tests = actionConfigs.map(config => ({
				description: `throws ValidationError for ${config.actionClass.name} with unexpected parameter`,
				config: {
					actionType: config.actionType,
					method: config.method,
					params: {
						...config.testParameters.required,
						unexpectedParam: 'unexpected_value'
					}
				},
				expected: { errorClass: ValidationError }
			}));

			tests.forEach(test => {
				runUnexpectedParamTest(test.description, test.config, test.expected);
			});
		});

		describe('missing required parameter', () => {
			const runMissingRequiredTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					const uriString = createUriString(config.actionType, config.method, config.params);

					// Act & Assert:
					expect(() => TransportUri.createFromString(uriString))
						.toThrow(expected.errorClass);
				});
			};

			const tests = actionConfigs.map(config => {
				const incompleteParams = { ...config.testParameters.required };
				const firstRequiredParam = config.requiredParams[0].name;
				delete incompleteParams[firstRequiredParam];
				return {
					description: `throws ValidationError for ${config.actionClass.name} missing required parameter`,
					config: {
						actionType: config.actionType,
						method: config.method,
						params: incompleteParams
					},
					expected: { errorClass: ValidationError }
				};
			});

			tests.forEach(test => {
				runMissingRequiredTest(test.description, test.config, test.expected);
			});
		});
	});

	describe('constructor and toTransportString', () => {
		const runConstructorToStringTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const action = new config.ActionClass(config.params);
				const uriString = action.toTransportString();

				// Assert:
				expect(uriString).toBe(expected.uriString);
			});
		};

		const tests = actionConfigs.map(config => ({
			description: `${config.actionClass.name} constructor creates instance that serializes to valid URI`,
			config: {
				ActionClass: config.actionClass,
				params: getAllParameters(config)
			},
			expected: {
				uriString: createUriString(config.actionType, config.method, getAllParameters(config))
			}
		}));

		tests.forEach(test => {
			runConstructorToStringTest(test.description, test.config, test.expected);
		});
	});

	describe('fromJSON and toTransportString', () => {
		const runFromJsonToStringTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const action = config.ActionClass.fromJSON({ parameters: config.params });
				const uriString = action.toTransportString();

				// Assert:
				expect(uriString).toBe(expected.uriString);
			});
		};

		const tests = actionConfigs.map(config => ({
			description: `${config.actionClass.name}.fromJSON creates instance that serializes to valid URI`,
			config: {
				ActionClass: config.actionClass,
				params: getAllParameters(config)
			},
			expected: {
				uriString: createUriString(config.actionType, config.method, getAllParameters(config))
			}
		}));

		tests.forEach(test => {
			runFromJsonToStringTest(test.description, test.config, test.expected);
		});
	});

	describe('createFromString - invalid URI errors', () => {
		const runInvalidUriTest = (description, config, expected) => {
			it(description, () => {
				// Act & Assert:
				expect(() => TransportUri.createFromString(config.uri))
					.toThrow(expected.errorClass);
			});
		};

		const tests = [
			{
				description: 'throws ParseError for wrong scheme',
				config: {
					uri: `https://${PROTOCOL_VERSION}/share/accountAddress?chainId=abc&networkId=mainnet&address=xyz`
				},
				expected: { errorClass: ParseError }
			},
			{
				description: 'throws ParseError for wrong version',
				config: {
					uri: `${URI_SCHEME}://v999/share/accountAddress?chainId=abc&networkId=mainnet&address=xyz`
				},
				expected: { errorClass: ParseError }
			},
			{
				description: 'throws UnsupportedActionError for unsupported action type',
				config: {
					uri: `${URI_SCHEME}://${PROTOCOL_VERSION}/unknown/accountAddress?chainId=abc&networkId=mainnet&address=xyz`
				},
				expected: { errorClass: UnsupportedActionError }
			},
			{
				description: 'throws UnsupportedActionError for unsupported method',
				config: {
					uri: `${URI_SCHEME}://${PROTOCOL_VERSION}/share/unknownMethod?chainId=abc&networkId=mainnet&address=xyz`
				},
				expected: { errorClass: UnsupportedActionError }
			}
		];

		tests.forEach(test => {
			runInvalidUriTest(test.description, test.config, test.expected);
		});
	});
});
