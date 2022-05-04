const { query, validationResult } = require('express-validator');
const timezone = require('moment-timezone');

const Validation = {
	validate: method => {
		const paginationValidation = [
			query('pageSize', 'pageSize required').exists().isInt(),
			query('pageNumber', 'pageNumber required').exists().isInt()
		];

		const sortValidation = [
			query('sortBy', 'field name must be string')
				.optional().isString(),
			query('sortDirection', 'sort direction is not supported')
				.optional({ checkFalsy: true }).isIn(['asc', 'desc'])
		];

		const addressTransactionHashValidation = [
			query('nemAddress', 'Nem address must be 40 character long')
				.optional({ checkFalsy: true }).isString().isLength({ max: 40, min: 40 }),
			query('transactionHash', 'Transaction hash must be 64 character long')
				.optional({ checkFalsy: true }).isString().isLength({ max: 64, min: 64 })
		];

		switch (method) {
		case 'getCompleted': {
			return [
				...paginationValidation,
				...sortValidation,
				...addressTransactionHashValidation,
				query('optinType', 'optin type must be pre or post')
					.optional({ checkFalsy: true }).isIn(['pre', 'post']),
				query('symbolAddress', 'Symbol address must be 39 character long')
					.optional({ checkFalsy: true }).isString().isLength({ max: 39, min: 39 })

			];
		}

		case 'exportCsv': {
			return [
				query('timezone', 'timezone must be string example America/Los_Angeles').exists().isIn(timezone.tz.names())
			];
		}

		case 'getOptinRequests': {
			return [
				...paginationValidation,
				...sortValidation,
				...addressTransactionHashValidation,
				query('status', 'status is not supported')
					.optional({ checkFalsy: true }).toLowerCase().isIn(['pending', 'sent', 'duplicate', 'error'])
			];
		}

		default:
			throw new Error(`${method} is not supported`);
		}
	},
	error: (req, res, next) => {
		const errors = validationResult(req);

		if (!errors.isEmpty()) {
			res.status(422).json({ errors: errors.array() });
			return;
		}

		next();
	}
};
module.exports = Validation;
