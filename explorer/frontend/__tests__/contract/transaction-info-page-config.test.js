// In most of the cases we don't need tests for the individual page or component configs.
// But the transaction details page config is a bit more complex and has some rules that we want to enforce,
// so we have a contract test for it.
import { describeEachVariant, loadVariantModule } from './contract-test-helpers';
import enLocale from '../../public/locales/en/common.json';
import { TRANSACTION_KIND } from '@/app/constants';

const CONFIG_PATH = 'config/transaction-info-page-config';
const TRANSACTION_TYPES_PATH = 'transaction/transaction-types';
const FIELD_LOCALE_KEY_PREFIX = 'field_';

const loadTransactionBodyConfigs = variant => {
	const { transactionInfoPageConfig } = loadVariantModule(variant, CONFIG_PATH);

	return Object.entries(transactionInfoPageConfig.transactions).map(([type, bodyConfig]) => ({
		type,
		target: bodyConfig.graphic.target,
		bodyFields: bodyConfig.bodyFields
	}));
};

const loadNonAggregateTypes = variant => {
	const { TRANSACTION_TYPE, getTransactionTypeInfo } = loadVariantModule(variant, TRANSACTION_TYPES_PATH);

	return Object.values(TRANSACTION_TYPE)
		.filter(type => getTransactionTypeInfo(type).kind !== TRANSACTION_KIND.AGGREGATE);
};

const formatBodyField = (type, bodyField) => `${type}: ${bodyField.name}`;

describe('contract/transaction-info-page-config', () => {
	describeEachVariant(variant => {
		it('every non-aggregate transaction type has a body config', () => {
			// Arrange:
			const nonAggregateTypes = loadNonAggregateTypes(variant);
			const configuredTypes = loadTransactionBodyConfigs(variant).map(({ type }) => type);

			// Act:
			const typesWithoutConfig = nonAggregateTypes.filter(type => !configuredTypes.includes(type));

			// Assert:
			expect(typesWithoutConfig).toEqual([]);
		});

		it('every body field has an existing title locale key', () => {
			// Arrange:
			const bodyConfigs = loadTransactionBodyConfigs(variant);

			// Act:
			const bodyFieldsWithMissingLocaleKey = bodyConfigs.flatMap(({ type, bodyFields }) => bodyFields
				.filter(bodyField => !(FIELD_LOCALE_KEY_PREFIX + bodyField.name in enLocale))
				.map(bodyField => formatBodyField(type, bodyField)));

			// Assert:
			expect(bodyFieldsWithMissingLocaleKey).toEqual([]);
		});

		it('every graphic target has an existing title locale key', () => {
			// Arrange:
			const bodyConfigs = loadTransactionBodyConfigs(variant);

			// Act:
			const typesWithMissingLocaleKey = bodyConfigs
				.filter(({ target }) => target && !(target.localeKey in enLocale))
				.map(({ type }) => type);

			// Assert:
			expect(typesWithMissingLocaleKey).toEqual([]);
		});
	});
});
