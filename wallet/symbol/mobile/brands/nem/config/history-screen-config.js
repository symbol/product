import { FilterType } from '@/app/types/Filter';

/** @typedef {import('@/app/screens/history/types/History').HistoryScreenConfig} HistoryScreenConfig */

/** @type {HistoryScreenConfig} */
export const historyScreenConfig = {
	filters: [
		{
			name: 'direction',
			titleKey: 'screen_history_chip_incoming',
			type: FilterType.CHOICE,
			value: 'incoming'
		},
		{
			name: 'direction',
			titleKey: 'screen_history_chip_outgoing',
			type: FilterType.CHOICE,
			value: 'outgoing'
		},
		{
			name: 'blocked',
			titleKey: 'screen_history_chip_blocked',
			type: FilterType.BOOLEAN
		}
	]
};
