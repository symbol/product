const Validation = require('../../utils/Validation');
const TestUtils = require('../TestUtils');
const { expect } = require('chai');
const { validationResult } = require('express-validator');

const mockExpressValidatorMiddleware = async (req, res, middlewares) => {
	await Promise.all(middlewares.map(async middleware => {
		await middleware(req, res, () => undefined);
	}));
};

const runValidAsserts = async ({ validator, validParams, queryField }) => {
	/* eslint-disable no-await-in-loop */
	for (let i = 0; i <= validParams.length - 1; ++i) {
		// Arrange:
		const req = TestUtils.mockRequest({
			pageSize: 10,
			pageNumber: 1,
			[queryField]: validParams[i]
		});
		const res = TestUtils.mockResponse();

		// Act:
		await mockExpressValidatorMiddleware(req, res, validator);
		const { errors } = validationResult(req);

		// Assert:
		expect(errors.length).to.equal(0);
	}
};

const runInvalidAsserts = async ({
	validator, invalidParams, queryField, errorMessage
}) => {
	/* eslint-disable no-await-in-loop */
	for (let i = 0; i <= invalidParams.length - 1; ++i) {
		// Arrange:
		const req = TestUtils.mockRequest({
			pageSize: 10,
			pageNumber: 1,
			[queryField]: invalidParams[i]
		});

		const res = TestUtils.mockResponse();

		// Act:
		await mockExpressValidatorMiddleware(req, res, validator);
		const { errors } = validationResult(req);

		// Assert:
		expect(errors[0].msg).to.equal(errorMessage);
	}
};

const runBasicPaginationValidationTests = validator => {
	it('should return 0 error given required params', async () => {
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

	it('should return error missing required params', async () => {
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
};

const runBasicSortDirectionValidationTests = (invalidParams, validParams, validator) => {
	// Arrange:
	const queryField = 'sortDirection';

	it('should return error given incorrect sortDirection', async () => {
		await runInvalidAsserts({
			validator,
			invalidParams,
			queryField,
			errorMessage: 'sort direction is not supported'
		});
	});

	it('should return 0 error given correct sortDirection ', async () => {
		await runValidAsserts({
			validator,
			validParams,
			queryField
		});
	});
};

const runBasicNemAddressValidationTests = (invalidParams, validParams, validator) => {
	// Arrange:
	const queryField = 'nemAddress';

	it('should return error given incorrect nemAddress', async () => {
		await runInvalidAsserts({
			validator,
			invalidParams,
			queryField,
			errorMessage: 'nem address must be 40 character long'
		});
	});

	it('should return 0 error given correct nemAddress', async () => {
		await runValidAsserts({
			validator,
			validParams,
			queryField
		});
	});
};

const runBasicTransactionHashValidationTests = (invalidParams, validParams, validator) => {
	// Arrange:
	const queryField = 'transactionHash';

	it('should return error given incorrect transactionHash', async () => {
		await runInvalidAsserts({
			validator,
			invalidParams,
			queryField,
			errorMessage: 'transaction hash must be 64 character long'
		});
	});

	it('should return 0 error given correct transactionHash', async () => {
		await runValidAsserts({
			validator,
			validParams,
			queryField
		});
	});
};

const runBasicSortByValidationTests = (invalidParams, validParams, validator) => {
	// Arrange:
	const queryField = 'sortBy';

	it('should return error given incorrect sortBy', async () => {
		await runInvalidAsserts({
			validator,
			invalidParams,
			queryField,
			errorMessage: 'field name is not valid'
		});
	});

	it('should return 0 error given correct sortBy', async () => {
		await runValidAsserts({
			validator,
			validParams,
			queryField
		});
	});
};

describe('request validation', () => {
	describe('unsupported validator type', () => {
		it('should return error given validator type not supported', () => {
			// Arrange:
			const method = 'notSupported';

			// Act: + Assert:
			expect(() => Validation.validate(method)).to.throw(`${method} is not supported`);
		});
	});

	describe('getCompleted query', () => {
		// Arrange:
		const validator = Validation.validate('getCompleted');

		describe('paginationValidation', () => {
			runBasicPaginationValidationTests(validator);
		});

		describe('sortValidation', () => {
			// Arrange:
			const invalidParams = [123, 'invalid'];
			const validParams = ['asc', 'desc', 'none', ''];

			runBasicSortDirectionValidationTests(invalidParams, validParams, validator);
		});

		describe('addressTransactionHashValidation', () => {
			// Arrange:
			const invalidParams = [123, 'invalid'];
			const validNemAddress = ['NA5UJVHGHUXUFA2VFQOJAUEXZIHPU3FUK7GRDUBM', ''];
			const validTxHash = ['ba9232776840ffb6adbf116820f2341aed3ca26b316b118844ccb050fe73bac8', ''];

			runBasicNemAddressValidationTests(invalidParams, validNemAddress, validator);
			runBasicTransactionHashValidationTests(invalidParams, validTxHash, validator);
		});

		describe('sortBy', () => {
			// Arrange:
			const invalidParams = ['invalid', 123];
			const validSortBy = ['nemHashes', 'symbolHashes'];

			runBasicSortByValidationTests(invalidParams, validSortBy, validator);
		});

		describe('optinType', () => {
			// Arrange:
			const queryField = 'optinType';

			it('should return error given incorrect optinType', async () => {
				// Arrange:
				const invalidParams = ['invalid'];

				await runInvalidAsserts({
					validator,
					invalidParams,
					queryField,
					errorMessage: 'optin type must be pre or post'
				});
			});

			it('should return 0 error given correct sortBy', async () => {
				// Arrange:
				const validParams = ['pre', 'post'];

				await runValidAsserts({
					validator,
					validParams,
					queryField
				});
			});
		});

		describe('symbolAddress', () => {
			// Arrange:
			const queryField = 'symbolAddress';

			it('should return error given incorrect symbolAddress', async () => {
				// Arrange:
				const invalidParams = ['NDCWGCUSOWJBD3JKOQOIWACPWMCVA6LVAWYPC3PI'];

				await runInvalidAsserts({
					validator,
					invalidParams,
					queryField,
					errorMessage: 'symbol address must be 39 character long'
				});
			});

			it('should return 0 error given correct symbolAddress', async () => {
				// Arrange:
				const validParams = ['NAIVQSJ6IU2NCDWWZSUYKKXK7JTGROW6FDRQTJY', 'NC6PLXOJLS43WIH23CV7OZGXTWQI3QNXNLBA7MY'];

				await runValidAsserts({
					validator,
					validParams,
					queryField
				});
			});
		});
	});

	describe('getOptinRequests query', () => {
		const validator = Validation.validate('getOptinRequests');

		describe('paginationValidation', () => {
			runBasicPaginationValidationTests(validator);
		});

		describe('sortValidation', () => {
			// Arrange:
			const invalidParams = [123, 'invalid'];
			const validParams = ['asc', 'desc', 'none'];

			runBasicSortDirectionValidationTests(invalidParams, validParams, validator);
		});

		describe('addressTransactionHashValidation', () => {
			// Arrange:
			const invalidParams = [123, 'invalid'];
			const validNemAddress = ['NA5UJVHGHUXUFA2VFQOJAUEXZIHPU3FUK7GRDUBM'];
			const validTxHash = ['ba9232776840ffb6adbf116820f2341aed3ca26b316b118844ccb050fe73bac8'];

			runBasicNemAddressValidationTests(invalidParams, validNemAddress, validator);
			runBasicTransactionHashValidationTests(invalidParams, validTxHash, validator);
		});

		describe('sortBy', () => {
			// Arrange:
			const invalidParams = ['invalid'];
			const validSortBy = ['optinTransactionHash', 'payoutTransactionHash'];

			runBasicSortByValidationTests(invalidParams, validSortBy, validator);
		});

		describe('status', () => {
			// Arrange:
			const queryField = 'status';

			it('should return error given incorrect status', async () => {
				// Arrange:
				const invalidParams = ['invalid'];

				await runInvalidAsserts({
					validator,
					invalidParams,
					queryField,
					errorMessage: 'status is not supported'
				});
			});

			it('should return 0 error given correct status', async () => {
				// Arrange:
				const validParams = ['pending', 'sent', 'duplicate', 'error'];

				await runValidAsserts({
					validator,
					validParams,
					queryField
				});
			});
		});
	});

	describe('exportCsv query', () => {
		const validator = Validation.validate('exportCsv');

		describe('timezone', () => {
			// Arrange:
			const queryField = 'timezone';

			it('should return error given incorrect timezone', async () => {
				// Arrange:
				const invalidParams = ['invalid', 'America'];

				await runInvalidAsserts({
					validator,
					invalidParams,
					queryField,
					errorMessage: 'timezone must be string example America/Los_Angeles'
				});
			});

			it('should return 0 error given incorrect timezone', async () => {
				// Arrange:
				const validParams = ['America/Los_Angeles', 'America/New_York'];

				await runValidAsserts({
					validator,
					validParams,
					queryField
				});
			});
		});
	});
});
