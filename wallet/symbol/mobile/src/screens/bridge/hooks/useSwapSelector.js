import { useCallback, useEffect, useState } from 'react';

/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapPair} SwapPair */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapSide} SwapSide */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapSideTypeValue} SwapSideTypeValue */
/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeManager} BridgeManager */
/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeModeType} BridgeModeType */

/**
 * Gets the default swap pair based on chain name preference.
 * @param {SwapPair[]} pairs - Available swap pairs.
 * @param {string} defaultSourceChainName - Preferred source chain name.
 * @returns {SwapPair} The default swap pair.
 */
const getDefaultPair = (pairs, defaultSourceChainName) => {
	return pairs.find(pair => pair.source.chainName === defaultSourceChainName) || pairs[0];
};

/**
 * Gets available opposite sides for a given swap side.
 * @param {SwapPair[]} pairs - Available swap pairs.
 * @param {SwapSide} side - The current swap side.
 * @param {SwapSideTypeValue} type - The side type.
 * @returns {SwapSide[]} Array of available opposite sides.
 */
const getOppositeSideList = (pairs, side, type) => {
	const filteredPairs = pairs.filter(pair => {
		if (type === 'source')
			return pair.source.chainName === side.chainName && pair.source.token.id === side.token.id;

		if (type === 'target')
			return pair.target.chainName === side.chainName && pair.target.token.id === side.token.id;
	});

	return filteredPairs.map(pair => type === 'source' ? pair.target : pair.source);
};

/**
 * Gets updated swap side with fresh balance data.
 * @param {SwapPair[]} pairs - Available swap pairs.
 * @param {SwapSide} side - The swap side to update.
 * @param {SwapSideTypeValue} type - The side type.
 * @returns {SwapSide} Updated swap side.
 */
const getUpdatedSide = (pairs, side, type) => {
	const getSide = pair => type === 'source' ? pair.source : pair.target;

	const pair = pairs.find(pair => 
		getSide(pair).chainName === side.chainName &&
		getSide(pair).token.id === side.token.id);

	if (!pair)
		return side;
	
	return getSide(pair);
};

/**
 * Finds the bridge and mode for selected source and target.
 * @param {SwapPair[]} pairs - Available swap pairs.
 * @param {SwapSide} source - Selected source side.
 * @param {SwapSide} target - Selected target side.
 * @returns {{bridge: BridgeManager|null, mode: BridgeModeType|null}} Bridge and mode.
 */
const getCorrespondingBridge = (pairs, source, target) => {
	const pair = pairs.find(pair => 
		pair.source.chainName === source.chainName &&
		pair.source.token.id === source.token.id &&
		pair.target.chainName === target.chainName &&
		pair.target.token.id === target.token.id);

	if (!pair)
		return { bridge: null, mode: null };
	
	return {
		bridge: pair.bridge,
		mode: pair.mode
	};
};

/**
 * Return type for useSwapSelector hook.
 * @typedef {Object} UseSwapSelectorReturnType
 * @property {boolean} isReady - Whether selection is complete and ready for swap.
 * @property {BridgeManager|null} bridge - Selected bridge manager.
 * @property {BridgeModeType|null} mode - Selected bridge mode.
 * @property {SwapSide|null} source - Selected source side.
 * @property {SwapSide|null} target - Selected target side.
 * @property {SwapSide[]} sourceList - Available source options.
 * @property {SwapSide[]} targetList - Available target options.
 * @property {(side: SwapSide) => void} changeSource - Updates source selection.
 * @property {(side: SwapSide) => void} changeTarget - Updates target selection.
 * @property {() => void} reverse - Swaps source and target selections.
 */

/**
 * React hook for managing swap source/target selection and determining the appropriate bridge.
 * Handles pair filtering, selection lists, and automatic bridge resolution.
 * @param {Object} params - Hook parameters.
 * @param {SwapPair[]} params.pairs - Available swap pairs.
 * @param {string} params.defaultSourceChainName - Default source chain name.
 * @returns {UseSwapSelectorReturnType}
 */
export const useSwapSelector = ({ pairs, defaultSourceChainName }) => {
	// Source and target state
	const [source, setSource] = useState(null);
	const [target, setTarget] = useState(null);
	const [sourceList, setSourceList] = useState([]);
	const [targetList, setTargetList] = useState([]);

	// Handle source and target values and list changes
	const reverse = useCallback(() => {
		setSource(target);
		setTarget(source);
	}, [source, target]);

	// Bridge and mode determination based on source and target selection
	const [bridge, setBridge] = useState(null);
	const [mode, setMode] = useState(null);

	// Main effect
	useEffect(() => {
		// Set default source and target on first load
		if (pairs.length && !source) {
			const defaultPair = getDefaultPair(pairs, defaultSourceChainName);
			setSource(defaultPair.source);
			setTarget(defaultPair.target);
		}

		// Refresh lists on source/target change
		else if (pairs.length && source && target) {
			setSource(getUpdatedSide(pairs, source, 'source'));
			setTarget(getUpdatedSide(pairs, target, 'target'));
			setSourceList(getOppositeSideList(pairs, target, 'target'));
			setTargetList(getOppositeSideList(pairs, source, 'source'));
		}
		else {
			setSource(null);
			setTarget(null);
			setSourceList([]);
			setTargetList([]);
		}

		// Determine bridge and mode based on source and target
		if (source && target) {
			const { bridge, mode } = getCorrespondingBridge(pairs, source, target);
			setBridge(bridge);
			setMode(mode);
		}

		// Reset bridge and mode if source or target is not selected
		else {
			setBridge(null);
			setMode(null);
		}
	}, [pairs, defaultSourceChainName, source, target]);
	
	return {
		isReady: source !== null && target !== null && bridge !== null && mode !== null,
		bridge,
		mode,
		source,
		target,
		sourceList,
		targetList,
		changeSource: setSource,
		changeTarget: setTarget,
		reverse
	};
};
