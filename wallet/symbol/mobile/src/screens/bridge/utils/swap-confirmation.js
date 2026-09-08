import { $t } from '@/app/localization';
import { createTokenDisplayData } from '@/app/utils';

/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapSide} SwapSide */

/**
 * Creates the swap confirmation dialog localized text string.
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
		sourceToken: createTokenDisplayData(source.token, source.chainName, source.networkIdentifier).tickerText,
		sourceChain: source.chainName,
		targetToken: createTokenDisplayData(target.token, target.chainName, target.networkIdentifier).tickerText,
		targetChain: target.chainName
	});
};
