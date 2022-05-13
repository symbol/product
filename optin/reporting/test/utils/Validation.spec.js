const Validation = require('../../utils/Validation');
const TestUtils = require('../TestUtils');
const { expect } = require('chai');
const { validationResult } = require('express-validator');

const mockExpressValidatorMiddleware = async (req, res, middlewares) => {
	await Promise.all(middlewares.map(async middleware => {
		await middleware(req, res, () => undefined);
	}));
};

const runAsserts = async ({
	validator, values, queryField, errorMessage
}) => {
	/* eslint-disable no-await-in-loop */
	for (let i = 0; i <= values.length - 1; ++i) {
		// Arrange:
		const req = TestUtils.mockRequest({
			pageSize: 10,
			pageNumber: 1,
			[queryField]: values[i]
		});

		const res = TestUtils.mockResponse();

		// Act:
		await mockExpressValidatorMiddleware(req, res, validator);
		const { errors } = validationResult(req);

		if (errorMessage) {
			// Assert:
			expect(errors[0].msg).to.equal(errorMessage);
		} else {
			// Assert:
			expect(errors.length).to.equal(0);
		}
	}
};

const runBasicPaginationValidationTests = validator => {
	it('fails when any parameter is omitted', async () => {
		// Arrange:
		const req = TestUtils.mockRequest({});
		const res = TestUtils.mockResponse();

		// Act:
		await mockExpressValidatorMiddleware(req, res, validator);
		const { errors } = validationResult(req);

		const paramPageSize = errors.filter(err => 'pageSize' === err.param)[0];
		const paramPageNumber = errors.filter(err => 'pageNumber' === err.param)[0];

		// Assert:
		expect(paramPageSize.msg).to.equal('pageSize required');
		expect(paramPageNumber.msg).to.equal('pageNumber required');
	});

	it('succeeds when pageSize and pageNumber parameters are provided', async () => {
		// Arrange:
		const req = TestUtils.mockRequest({
			pageSize: 10,
			pageNumber: 1
		});
		const res = TestUtils.mockResponse();

		// Act:
		await mockExpressValidatorMiddleware(req, res, validator);
		const { errors } = validationResult(req);

		// Assert:
		expect(errors.length).to.equal(0);
	});
};

const runBasicSortDirectionValidationTests = (invalidParams, validParams, validator) => {
	// Arrange:
	const queryField = 'sortDirection';

	it('fails when sortDirection parameter is invalid', async () => {
		await runAsserts({
			validator,
			values: invalidParams,
			queryField,
			errorMessage: 'sort direction is not supported'
		});
	});

	it('succeeds when sortDirection parameters are present and valid', async () => {
		await runAsserts({
			validator,
			values: validParams,
			queryField
		});
	});
};

const runBasicNemAddressValidationTests = (invalidParams, validParams, validator) => {
	// Arrange:
	const queryField = 'nemAddress';

	it('fails when nemAddress parameter is invalid', async () => {
		await runAsserts({
			validator,
			values: invalidParams,
			queryField,
			errorMessage: 'nem address must be 40 character long'
		});
	});

	it('succeeds when nemAddress parameters are present and valid', async () => {
		await runAsserts({
			validator,
			values: validParams,
			queryField
		});
	});
};

const runBasicTransactionHashValidationTests = (invalidParams, validParams, validator) => {
	// Arrange:
	const queryField = 'transactionHash';

	it('fails when transactionHash parameter is invalid', async () => {
		await runAsserts({
			validator,
			values: invalidParams,
			queryField,
			errorMessage: 'transaction hash must be 64 character long'
		});
	});

	it('succeeds when transactionHash parameters are present and valid', async () => {
		await runAsserts({
			validator,
			values: validParams,
			queryField
		});
	});
};

const runBasicSortByValidationTests = (invalidParams, validParams, validator) => {
	// Arrange:
	const queryField = 'sortBy';

	it('fails when sortBy parameter is invalid', async () => {
		await runAsserts({
			validator,
			values: invalidParams,
			queryField,
			errorMessage: 'field name is not valid'
		});
	});

	it('succeeds when sortBy parameters are present and valid', async () => {
		await runAsserts({
			validator,
			values: validParams,
			queryField
		});
	});
};

describe('validation', () => {
	describe('unsupported validator type', () => {
		it('return error given validator type not supported', () => {
			// Arrange:
			const method = 'notSupported';

			// Act: + Assert:
			expect(() => Validation.validate(method)).to.throw(`${method} is not supported`);
		});
	});

	describe('getCompleted', () => {
		// Arrange:
		const validator = Validation.validate('getCompleted');

		describe('pagination validator', () => {
			runBasicPaginationValidationTests(validator);
		});

		describe('sort direction validator', () => {
			// Arrange:
			const invalidParams = [123, 'invalid'];
			const validParams = ['asc', 'desc', 'none', ''];

			runBasicSortDirectionValidationTests(invalidParams, validParams, validator);
		});

		describe('address and transaction hash validator', () => {
			// Arrange:
			const invalidParams = [123, 'invalid'];
			const validNemAddress = ['NA5UJVHGHUXUFA2VFQOJAUEXZIHPU3FUK7GRDUBM', ''];
			const validTxHash = ['ba9232776840ffb6adbf116820f2341aed3ca26b316b118844ccb050fe73bac8', ''];

			runBasicNemAddressValidationTests(invalidParams, validNemAddress, validator);
			runBasicTransactionHashValidationTests(invalidParams, validTxHash, validator);
		});

		describe('sortBy validator', () => {
			// Arrange:
			const invalidParams = ['invalid', 123];
			const validSortBy = ['nemHashes', 'symbolHashes'];

			runBasicSortByValidationTests(invalidParams, validSortBy, validator);
		});

		describe('optinType validator', () => {
			// Arrange:
			const queryField = 'optinType';

			it('fails when optinType parameter is invalid', async () => {
				// Arrange:
				const invalidParams = ['invalid'];

				await runAsserts({
					validator,
					values: invalidParams,
					queryField,
					errorMessage: 'optin type must be pre or post'
				});
			});

			it('succeeds when optinType parameters are present and valid', async () => {
				// Arrange:
				const validParams = ['pre', 'post'];

				await runAsserts({
					validator,
					values: validParams,
					queryField
				});
			});
		});

		describe('symbol address validator', () => {
			// Arrange:
			const queryField = 'symbolAddress';

			it('fails when symbolAddress parameter is invalid', async () => {
				// Arrange:
				const invalidParams = ['NDCWGCUSOWJBD3JKOQOIWACPWMCVA6LVAWYPC3PI'];

				await runAsserts({
					validator,
					values: invalidParams,
					queryField,
					errorMessage: 'symbol address must be 39 character long'
				});
			});

			it('succeeds when symbolAddress parameters are present and valid', async () => {
				// Arrange:
				const validParams = ['NAIVQSJ6IU2NCDWWZSUYKKXK7JTGROW6FDRQTJY', 'NC6PLXOJLS43WIH23CV7OZGXTWQI3QNXNLBA7MY'];

				await runAsserts({
					validator,
					values: validParams,
					queryField
				});
			});
		});
	});

	describe('getOptinRequests', () => {
		const validator = Validation.validate('getOptinRequests');

		describe('pagination validator', () => {
			runBasicPaginationValidationTests(validator);
		});

		describe('sort direction validator', () => {
			// Arrange:
			const invalidParams = [123, 'invalid'];
			const validParams = ['asc', 'desc', 'none'];

			runBasicSortDirectionValidationTests(invalidParams, validParams, validator);
		});

		describe('address and transaction hash validator', () => {
			// Arrange:
			const invalidParams = [123, 'invalid'];
			const validNemAddress = ['NA5UJVHGHUXUFA2VFQOJAUEXZIHPU3FUK7GRDUBM'];
			const validTxHash = ['ba9232776840ffb6adbf116820f2341aed3ca26b316b118844ccb050fe73bac8'];

			runBasicNemAddressValidationTests(invalidParams, validNemAddress, validator);
			runBasicTransactionHashValidationTests(invalidParams, validTxHash, validator);
		});

		describe('sortBy validator', () => {
			// Arrange:
			const invalidParams = ['invalid'];
			const validSortBy = ['optinTransactionHash', 'payoutTransactionHash'];

			runBasicSortByValidationTests(invalidParams, validSortBy, validator);
		});

		describe('status validator', () => {
			// Arrange:
			const queryField = 'status';

			it('fails when status parameter is invalid', async () => {
				// Arrange:
				const invalidParams = ['invalid'];

				await runAsserts({
					validator,
					values: invalidParams,
					queryField,
					errorMessage: 'status is not supported'
				});
			});

			it('succeeds when status parameters are present and valid', async () => {
				// Arrange:
				const validParams = ['pending', 'sent', 'duplicate', 'error'];

				await runAsserts({
					validator,
					values: validParams,
					queryField
				});
			});
		});
	});

	describe('exportCsv', () => {
		const validator = Validation.validate('exportCsv');

		describe('timezone validator', () => {
			// Arrange:
			const queryField = 'timezone';

			it('fails when timezone parameter is invalid', async () => {
				// Arrange:
				const invalidParams = ['invalid', 'America'];

				await runAsserts({
					validator,
					values: invalidParams,
					queryField,
					errorMessage: 'timezone must be string example America/Los_Angeles'
				});
			});

			it('succeeds when timezone parameters are present and valid', async () => {
				// Arrange:
				const validParams = ['America/Los_Angeles', 'America/New_York'];

				await runAsserts({
					validator,
					values: validParams,
					queryField
				});
			});
		});
	});
});
