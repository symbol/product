import { FeeSelector, Stack, TextBox } from '@/app/components';
import { $t } from '@/app/localization';
import React from 'react';

/** @typedef {import('@/app/types/Transaction').TransactionFeeTierLevel} TransactionFeeTierLevel */
/** @typedef {import('@/app/types/Transaction').TransactionFeeTiers} TransactionFeeTiers */

/**
 * HarvestingForm component. Provides controls for selecting a node and transaction fee
 * when starting or managing harvesting.
 * @param {object} props - Component props.
 * @param {string} props.nodeUrl - Currently entered/selected node URL.
 * @param {(value: string) => void} props.onNodeUrlChange - Callback when node URL changes.
 * @param {TransactionFeeTiers} [props.feeTiers] - Transaction fee tiers.
 * @param {TransactionFeeTierLevel} props.feeLevel - Selected fee tier level.
 * @param {(level: TransactionFeeTierLevel) => void} props.onFeeLevelChange - Callback when fee level changes.
 * @param {string} props.ticker - Currency ticker symbol.
 * @param {boolean} [props.isNodeSelectorVisible] - Whether to show node selector.
 * @param {boolean} [props.isFeeSelectorVisible] - Whether to show fee selector.
 * @returns {React.ReactNode} HarvestingForm component.
 */
export const HarvestingForm = ({
	nodeUrl,
	onNodeUrlChange,
	feeTiers,
	feeLevel,
	onFeeLevelChange,
	ticker,
	isNodeSelectorVisible,
	isFeeSelectorVisible
}) => {
	return (
		<Stack>
			{isNodeSelectorVisible && (
				<TextBox
					label={$t('fieldTitle_nodeUrl')}
					value={nodeUrl}
					onChange={onNodeUrlChange}
				/>
			)}
			{isFeeSelectorVisible && (
				<FeeSelector
					title={$t('fieldTitle_transactionFee')}
					feeTiers={feeTiers}
					value={feeLevel}
					ticker={ticker}
					onChange={onFeeLevelChange}
				/>
			)}
		</Stack>
	);
};
