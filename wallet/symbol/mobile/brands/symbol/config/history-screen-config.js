import { SymbolTransactionType } from '@/app/constants';
import { getTransactionTypeInfo } from '@/app/lib/transaction';
import { FilterType } from '@/app/types/Filter';

/** @typedef {import('@/app/screens/history/types/History').HistoryScreenConfig} HistoryScreenConfig */

const SYMBOL_CHAIN_NAME = 'symbol';

/** @type {HistoryScreenConfig} */
export const historyScreenConfig = {
	filters: [
		{
			name: 'type',
			titleKey: 'screen_history_chip_type',
			type: FilterType.SELECT,
			options: [
				{
					labelKey: getTransactionTypeInfo(SymbolTransactionType.TRANSFER, SYMBOL_CHAIN_NAME).localeKey,
					value: [SymbolTransactionType.TRANSFER]
				},
				{
					labelKey: getTransactionTypeInfo(SymbolTransactionType.AGGREGATE_BONDED, SYMBOL_CHAIN_NAME).localeKey,
					value: [SymbolTransactionType.AGGREGATE_BONDED]
				},
				{
					labelKey: getTransactionTypeInfo(SymbolTransactionType.AGGREGATE_COMPLETE, SYMBOL_CHAIN_NAME).localeKey,
					value: [SymbolTransactionType.AGGREGATE_COMPLETE]
				}
			]
		},
		{
			name: 'from',
			titleKey: 'screen_history_chip_from',
			type: FilterType.ADDRESS
		},
		{
			name: 'to',
			titleKey: 'screen_history_chip_to',
			type: FilterType.ADDRESS
		},
		{
			name: 'harvested',
			titleKey: 'screen_history_chip_harvested',
			type: FilterType.BOOLEAN
		},
		{
			name: 'blocked',
			titleKey: 'screen_history_chip_blocked',
			type: FilterType.BOOLEAN
		}
	]
};
