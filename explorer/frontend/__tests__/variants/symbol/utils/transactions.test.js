import { symbolTransactionTypes } from '../../../test-utils/transaction-types';
import { SYMBOL_TRANSACTION_GROUP, SYMBOL_TRANSACTION_TYPE } from '@/app/variants/symbol/constants';
import { getTransactionTypeIcon, getTransactionTypeLabel, isTransactionAwaitingSignatures } from '@/app/variants/symbol/utils/transactions';
import fs from 'node:fs';
import path from 'node:path';

const sharedTransactionTypes = [
	'ACCOUNT_KEY_LINK',
	'MOSAIC_DEFINITION',
	'MOSAIC_SUPPLY_CHANGE',
	'MULTISIG_ACCOUNT_MODIFICATION',
	'NAMESPACE_REGISTRATION',
	'TRANSFER'
];

const symbolSpecificTransactionTypes = symbolTransactionTypes.filter(type => !sharedTransactionTypes.includes(type));

describe('variants/symbol/utils/transactions', () => {
	it('lists the Symbol transaction names returned by the REST implementation', () => {
		expect(Object.values(SYMBOL_TRANSACTION_TYPE).sort()).toEqual([...symbolTransactionTypes].sort());
	});

	it.each(symbolSpecificTransactionTypes)('provides localized labels for %s in every configured language', type => {
		for (const language of ['en', 'ja', 'isv']) {
			const label = getTransactionTypeLabel(type, language);

			expect(label).toBeTruthy();
			expect(label).not.toBe(type);
			expect(label).not.toMatch(/^transactionType_/);
		}
	});

	it.each(sharedTransactionTypes)('delegates the existing common label for %s', type => {
		expect(getTransactionTypeLabel(type, 'ja')).toBeUndefined();
	});

	it('uses the active language and normalizes a locale region', () => {
		expect(getTransactionTypeLabel(SYMBOL_TRANSACTION_TYPE.AGGREGATE_COMPLETE, 'en')).toBe('Aggregate Complete');
		expect(getTransactionTypeLabel(SYMBOL_TRANSACTION_TYPE.AGGREGATE_COMPLETE, 'ja-JP')).toBe('アグリゲートコンプリート');
		expect(getTransactionTypeLabel(SYMBOL_TRANSACTION_TYPE.AGGREGATE_COMPLETE, 'isv')).toBe('Dokončena Aggregacija');
	});

	it('falls back to the English label for an unsupported language', () => {
		expect(getTransactionTypeLabel(SYMBOL_TRANSACTION_TYPE.AGGREGATE_COMPLETE, 'de')).toBe('Aggregate Complete');
	});

	it('returns the original type string for an unknown Symbol transaction', () => {
		expect(getTransactionTypeLabel('FUTURE_SYMBOL_TRANSACTION', 'ja')).toBe('FUTURE_SYMBOL_TRANSACTION');
	});

	it.each(symbolTransactionTypes)('maps %s to an existing Symbol icon', type => {
		const iconURL = getTransactionTypeIcon(type);
		const iconFile = path.resolve('public', iconURL.slice(1));

		expect(iconURL.startsWith('/symbol/')).toBe(true);
		expect(fs.existsSync(iconFile)).toBe(true);
	});

	it('uses the existing Symbol transaction icon for an unknown type', () => {
		const iconURL = getTransactionTypeIcon('FUTURE_SYMBOL_TRANSACTION');
		const iconFile = path.resolve('public', iconURL.slice(1));

		expect(iconURL).toBe('/symbol/images/icon-transaction.svg');
		expect(fs.existsSync(iconFile)).toBe(true);
	});

	it('keeps the partial group as the awaiting-cosignatures condition', () => {
		expect(isTransactionAwaitingSignatures({ group: SYMBOL_TRANSACTION_GROUP.PARTIAL })).toBe(true);
		expect(isTransactionAwaitingSignatures({ group: SYMBOL_TRANSACTION_GROUP.CONFIRMED })).toBe(false);
	});
});
