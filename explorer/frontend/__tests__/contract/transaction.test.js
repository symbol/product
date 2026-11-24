import { describeEachVariant, getVariantPublicPath, loadVariantModule } from './contract-test-helpers';
import enLocale from '../../public/locales/en/common.json';
import { TRANSACTION_KIND } from '@/app/constants';
import { UNKNOWN_TRANSACTION_TYPE_INFO } from '@/app/lib/transaction/common-transaction-types';
import { requiredTransactionModules } from '@/contract/transaction';
import fs from 'fs';

const TRANSACTION_TYPES_PATH = 'transaction/transaction-types';
const TRANSACTION_ICONS_FOLDER = 'images/transaction';
const ICON_FILE_EXTENSION = '.svg';

const loadTransactionTypeInfos = variant => {
	const { TRANSACTION_TYPE, getTransactionTypeInfo } = loadVariantModule(variant, TRANSACTION_TYPES_PATH);

	return Object.values(TRANSACTION_TYPE).map(type => ({
		type,
		info: getTransactionTypeInfo(type)
	}));
};

describe('contract/transaction', () => {
	describeEachVariant(variant => {
		requiredTransactionModules.forEach(requiredTransactionModule => {
			it(`${requiredTransactionModule.path} exports all required names`, () => {
				// Arrange:
				const variantModule = loadVariantModule(variant, requiredTransactionModule.path);

				// Act:
				const missingNames = requiredTransactionModule.exportNames.filter(name => variantModule[name] === undefined);

				// Assert:
				expect(missingNames).toEqual([]);
			});
		});

		describe('transaction types', () => {
			it('every transaction type has its own type info', () => {
				// Arrange:
				const typeInfos = loadTransactionTypeInfos(variant);

				// Act:
				const typesWithoutInfo = typeInfos
					.filter(({ info }) => info === UNKNOWN_TRANSACTION_TYPE_INFO)
					.map(({ type }) => type);

				// Assert:
				expect(typesWithoutInfo).toEqual([]);
			});

			it('every transaction type has a valid kind', () => {
				// Arrange:
				const typeInfos = loadTransactionTypeInfos(variant);
				const validKinds = Object.values(TRANSACTION_KIND);

				// Act:
				const typesWithInvalidKind = typeInfos
					.filter(({ info }) => !validKinds.includes(info.kind))
					.map(({ type }) => type);

				// Assert:
				expect(typesWithInvalidKind).toEqual([]);
			});

			it('every transaction type has an existing locale key', () => {
				// Arrange:
				const typeInfos = loadTransactionTypeInfos(variant);

				// Act:
				const typesWithMissingLocaleKey = typeInfos
					.filter(({ info }) => !(info.localeKey in enLocale))
					.map(({ type }) => type);

				// Assert:
				expect(typesWithMissingLocaleKey).toEqual([]);
			});

			it('every transaction type has an existing icon file', () => {
				// Arrange:
				const typeInfos = loadTransactionTypeInfos(variant);
				const iconFileNames = fs.readdirSync(getVariantPublicPath(variant, TRANSACTION_ICONS_FOLDER));

				// Act:
				const typesWithMissingIcon = typeInfos
					.filter(({ info }) => !iconFileNames.includes(info.icon + ICON_FILE_EXTENSION))
					.map(({ type }) => type);

				// Assert:
				expect(typesWithMissingIcon).toEqual([]);
			});
		});
	});
});
