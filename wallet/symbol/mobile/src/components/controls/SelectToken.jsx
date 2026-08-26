import { Dropdown, TokenBalanceRow } from '@/app/components';
import { useTokenDisplayData } from '@/app/hooks';
import React from 'react';

/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/** @typedef {import('@/app/types/Token').Token} Token */

/**
 * SelectToken component. A dropdown selector for choosing tokens from a provided list,
 * displaying token names, tickers, and amounts with visual representations.
 * @param {object} props - Component props.
 * @param {string} props.label - Dropdown label.
 * @param {string} props.value - Currently selected token id.
 * @param {Token[]} props.tokens - List of available tokens.
 * @param {ChainName} [props.chainName] - The chain the tokens belong to. Defaults to the main chain.
 * @param {boolean} [props.isDisabled] - Whether the selector is disabled.
 * @param {function(object): void} props.onChange - Callback for when the selected token changes.
 * @returns {React.ReactNode} The SelectToken component.
 */
export const SelectToken = props => {
	const { label, value, tokens, chainName, isDisabled, onChange } = props;
	const tokensDisplayData = useTokenDisplayData(tokens, chainName);

	const list = tokensDisplayData.map(tokenDisplayData => ({
		value: tokenDisplayData.tokenId,
		label: tokenDisplayData.name,
		token: tokenDisplayData
	}));

	const renderItem = ({ item: { token } }) => (
		<TokenBalanceRow
			name={token.name}
			ticker={token.ticker}
			imageId={token.imageId}
			amount={token.amount}
		/>
	);

	return (
		<Dropdown
			label={label}
			value={value}
			list={list}
			isDisabled={isDisabled}
			onChange={onChange}
			renderItem={renderItem}
		/>
	);
};
