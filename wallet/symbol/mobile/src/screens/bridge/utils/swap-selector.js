import { createTokenDisplayData } from '@/app/utils';

/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapSide} SwapSide */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapSideOption} SwapSideOption */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapSelectorViewModel} SwapSelectorViewModel */

/**
 * Builds one selectable option from a swap side.
 * @param {SwapSide} side - The swap side.
 * @returns {SwapSideOption} The option.
 */
const createSideOption = side => {
	const { name, imageId } = createTokenDisplayData(side.token, side.chainName, side.networkIdentifier);

	return {
		key: `${side.chainName}|${side.token.id}`,
		label: name,
		imageId,
		chainName: side.chainName,
		amount: side.token.amount,
		side
	};
};

/**
 * Builds the swap selector view model: the selected sides and the selectable options with their
 * token label, avatar and balance resolved.
 * @param {object} params - Builder parameters.
 * @param {SwapSide|null} params.source - Selected source side.
 * @param {SwapSide|null} params.target - Selected target side.
 * @param {SwapSide[]} params.sourceList - Selectable source sides.
 * @param {SwapSide[]} params.targetList - Selectable target sides.
 * @returns {SwapSelectorViewModel} The selector view model.
 */
export const createSwapSelectorViewModel = ({ source, target, sourceList, targetList }) => ({
	source: source ? createSideOption(source) : null,
	target: target ? createSideOption(target) : null,
	sourceOptions: sourceList.map(createSideOption),
	targetOptions: targetList.map(createSideOption)
});
