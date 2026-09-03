import { $t } from '@/app/localization';
import { createTokenDisplayData } from '@/app/utils';

/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapSide} SwapSide */

/**
 * Resolves the units text of a side's token: its known ticker, or its name when unlisted.
 * @param {SwapSide} side - The swap side.
 * @returns {string} Ticker text.
 */
const getSideTickerText = side => createTokenDisplayData(side.token, side.chainName, side.networkIdentifier).tickerText;

/**
 * Builds the confirm-dialog sentence of a swap: the entered amount and both tokens by ticker. Empty
 * until both sides are selected.
 * @param {object} params - Builder parameters.
 * @param {SwapSide|null} params.source - Selected source side.
 * @param {SwapSide|null} params.target - Selected target side.
 * @param {string} params.amount - Entered amount in relative units.
 * @returns {string} Confirm-dialog text.
 */
export const createSwapConfirmationText = ({ source, target, amount }) => {
	if (!source || !target)
		return '';

	return $t('s_bridge_swap_dialog_confirm_text', {
		amount,
		sourceToken: getSideTickerText(source),
		sourceChain: source.chainName,
		targetToken: getSideTickerText(target),
		targetChain: target.chainName
	});
};
