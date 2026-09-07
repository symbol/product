import { SwapSideType } from '@/app/screens/bridge/types/Bridge';
import { createSwapSideKey } from '@/app/screens/bridge/utils';
import { useCallback, useEffect, useMemo, useState } from 'react';

/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapPair} SwapPair */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapSide} SwapSide */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapSideTypeValue} SwapSideTypeValue */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapStep} SwapStep */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapWorkflowManager} SwapWorkflowManager */

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
 * Whether two swap sides are the same token on the same chain.
 * @param {SwapSide} side - One side.
 * @param {SwapSide} otherSide - The other side.
 * @returns {boolean} True when the side keys match.
 */
const isSameSide = (side, otherSide) => createSwapSideKey(side) === createSwapSideKey(otherSide);

/**
 * Picks the source or target side of a pair.
 * @param {SwapPair} pair - The swap pair.
 * @param {SwapSideTypeValue} type - Which side to pick.
 * @returns {SwapSide} The picked side.
 */
const getPairSide = (pair, type) => type === SwapSideType.SOURCE ? pair.source : pair.target;

/**
 * Finds the pair that swaps the given source to the given target.
 * @param {SwapPair[]} pairs - Available swap pairs.
 * @param {SwapSide} source - Source side.
 * @param {SwapSide} target - Target side.
 * @returns {SwapPair|undefined} The pair, or undefined when the route does not exist.
 */
const findPair = (pairs, source, target) => pairs.find(pair => isSameSide(pair.source, source) && isSameSide(pair.target, target));

/**
 * Gets available opposite sides for a given swap side.
 * @param {SwapPair[]} pairs - Available swap pairs.
 * @param {SwapSide} side - The current swap side.
 * @param {SwapSideTypeValue} type - The side type.
 * @returns {SwapSide[]} Array of available opposite sides.
 */
const getOppositeSideList = (pairs, side, type) => pairs
	.filter(pair => isSameSide(getPairSide(pair, type), side))
	.map(pair => type === SwapSideType.SOURCE ? pair.target : pair.source);

/**
 * Gets updated swap side with fresh balance data.
 * @param {SwapPair[]} pairs - Available swap pairs.
 * @param {SwapSide} side - The swap side to update.
 * @param {SwapSideTypeValue} type - The side type.
 * @returns {SwapSide} Updated swap side.
 */
const getUpdatedSide = (pairs, side, type) => {
	const pair = pairs.find(pair => isSameSide(getPairSide(pair, type), side));

	return pair ? getPairSide(pair, type) : side;
};

/**
 * Finds the bridge for selected source and target.
 * @param {SwapPair[]} pairs - Available swap pairs.
 * @param {SwapSide} source - Selected source side.
 * @param {SwapSide} target - Selected target side.
 * @returns {SwapWorkflowManager|null} Matching bridge or null.
 */
const getCorrespondingBridge = (pairs, source, target) => findPair(pairs, source, target)?.bridge ?? null;

/**
 * Return type for useSwapSelector hook.
 * @typedef {object} UseSwapSelectorReturnType
 * @property {boolean} isReady - Whether selection is complete and ready for swap.
 * @property {SwapWorkflowManager|null} bridge - Selected bridge manager.
 * @property {SwapStep[]} steps - Steps of the selected route in execution order; empty while no route is selected.
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
 * @param {object} params - Hook parameters.
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

	const bridge = useMemo(() => {
		if (source && target)
			return getCorrespondingBridge(pairs, source, target);

		return null;
	}, [pairs, source, target]);

	const steps = useMemo(() => {
		if (!bridge)
			return [];

		return Array.from({ length: bridge.steps }, (_, stepIndex) => bridge.getPairForStep(stepIndex));
	}, [bridge]);

	const sourceList = useMemo(() => {
		if (pairs.length === 0)
			return [];

		const seen = new Set();
		return pairs
			.map(pair => pair.source)
			.filter(side => {
				const key = createSwapSideKey(side);
				if (seen.has(key))
					return false;
				seen.add(key);
				return true;
			});
	}, [pairs]);

	const targetList = useMemo(() => {
		if (!source || pairs.length === 0)
			return [];

		return getOppositeSideList(pairs, source, SwapSideType.SOURCE);
	}, [pairs, source]);

	// User interactions

	const changeSource = useCallback(newSource => {
		if (!pairs.some(pair => isSameSide(pair.source, newSource)))
			return;

		setSource(newSource);
		setTarget(prevTarget => prevTarget && findPair(pairs, newSource, prevTarget)
			? prevTarget
			: pairs.find(pair => isSameSide(pair.source, newSource))?.target ?? null);
	}, [pairs]);

	const changeTarget = useCallback(newTarget => {
		if (pairs.some(pair => isSameSide(pair.target, newTarget)))
			setTarget(newTarget);
	}, [pairs]);

	const reverse = useCallback(() => {
		const isTargetValidSource = target && pairs.some(pair => isSameSide(pair.source, target));
		const newSource = isTargetValidSource ? target : (pairs[0]?.source ?? null);

		if (!newSource)
			return;

		const newTarget = source && findPair(pairs, newSource, source)
			? source
			: pairs.find(pair => isSameSide(pair.source, newSource))?.target ?? null;

		setSource(newSource);
		setTarget(newTarget);
	}, [source, target, pairs]);

	return {
		isReady: source !== null && target !== null && bridge !== null,
		bridge,
		steps,
		source,
		target,
		sourceList,
		targetList,
		changeSource,
		changeTarget,
		reverse
	};
};
