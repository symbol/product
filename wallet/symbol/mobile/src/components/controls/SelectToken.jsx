import { Dropdown, TokenView } from '@/app/components';
import { getTokenKnownInfo } from '@/app/utils';
import React from 'react';

/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * SelectToken component. A dropdown selector for choosing tokens from a provided list,
 * displaying token names, tickers, and amounts with visual representations.
 * @param {object} props - Component props.
 * @param {string} props.label - Dropdown label.
 * @param {string} props.value - Currently selected token id.
 * @param {import('wallet-common-core/src/types/Token').Token[]} props.tokens - List of available tokens.
 * @param {ChainName} props.chainName - Current chain name.
 * @param {NetworkIdentifier} props.networkIdentifier - Current network identifier.
 * @param {function(object): void} props.onChange - Callback for when the selected token changes.
 * @returns {React.ReactNode} The InputAddress component.
 */
export const SelectToken = props => {
	const { label, value, tokens, chainName, networkIdentifier, onChange } = props;

	const list = tokens.map(token => {
		const resolvedInfo = getTokenKnownInfo(chainName, networkIdentifier, token.id);
		const tokenName = resolvedInfo.name ?? token.name;

		return {
			value: token.id,
			label: tokenName,
			token: {
				name: tokenName,
				ticker: resolvedInfo.ticker,
				imageId: resolvedInfo.imageId,
				amount: token.amount
			}
		};
	});

	const renderItem = ({ item: { token } }) => (
		<TokenView
			name={token.name}
			ticker={token.ticker}
			imageId={token.imageId}
			amount={token.amount}
			isCopyButtonVisible={false}
		/>
	);

	return (
		<Dropdown
			label={label}
			value={value}
			list={list}
			onChange={onChange}
			renderItem={renderItem}
		/>
	);
};
