import { SwapSideType } from '@/app/screens/bridge/types/Bridge';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
		if (type === SwapSideType.SOURCE)
			return pair.source.chainName === side.chainName && pair.source.token.id === side.token.id;

		if (type === SwapSideType.TARGET)
			return pair.target.chainName === side.chainName && pair.target.token.id === side.token.id;
	});

	return filteredPairs.map(pair => type === SwapSideType.SOURCE ? pair.target : pair.source);
};

/**
 * Gets updated swap side with fresh balance data.
 * @param {SwapPair[]} pairs - Available swap pairs.
 * @param {SwapSide} side - The swap side to update.
 * @param {SwapSideTypeValue} type - The side type.
 * @returns {SwapSide} Updated swap side.
 */
const getUpdatedSide = (pairs, side, type) => {
	const getSide = pair => type === SwapSideType.SOURCE ? pair.source : pair.target;

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
	const [source, setSource] = useState(null);
	const [target, setTarget] = useState(null);

	// Initialize source and target when pairs become available
	useEffect(() => {
		if (pairs.length === 0) {
			setSource(null);
			setTarget(null);
			return;
		}

		setSource(prevSource => {
			if (!prevSource) {
				const defaultPair = getDefaultPair(pairs, defaultSourceChainName);
				return defaultPair.source;
			}

			return getUpdatedSide(pairs, prevSource, SwapSideType.SOURCE);
		});

		setTarget(prevTarget => {
			if (!prevTarget) {
				const defaultPair = getDefaultPair(pairs, defaultSourceChainName);
				return defaultPair.target;
			}

			return getUpdatedSide(pairs, prevTarget, SwapSideType.TARGET);
		});
	}, [pairs, defaultSourceChainName]);

	// Calculated values based on current source and target
	
	const { bridge, mode } = useMemo(() => {
		if (source && target)
			return getCorrespondingBridge(pairs, source, target);

		return { bridge: null, mode: null };
	}, [pairs, source, target]);

	const sourceList = useMemo(() => {
		if (!target || pairs.length === 0) return [];
		return getOppositeSideList(pairs, target, SwapSideType.TARGET);
	}, [pairs, target]);

	const targetList = useMemo(() => {
		if (!source || pairs.length === 0) 
			return [];
		
		return getOppositeSideList(pairs, source, SwapSideType.SOURCE);
	}, [pairs, source]);

	// User interactions

	const changeSource = useCallback(newSource => {
		const isValid = pairs.some(pair =>
			pair.source.chainName === newSource.chainName &&
			pair.source.token.id === newSource.token.id
		);

		if (isValid) 
			setSource(newSource);
	}, [pairs]);

	const changeTarget = useCallback(newTarget => {
		const isValid = pairs.some(pair =>
			pair.target.chainName === newTarget.chainName &&
			pair.target.token.id === newTarget.token.id
		);

		if (isValid) 
			setTarget(newTarget);
	}, [pairs]);

	const reverse = useCallback(() => {
		setSource(target);
		setTarget(source);
	}, [source, target]);

	return {
		isReady: source !== null && target !== null && bridge !== null && mode !== null,
		bridge,
		mode,
		source,
		target,
		sourceList,
		targetList,
		changeSource,
		changeTarget,
		reverse
	};
};
