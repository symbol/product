import { AccountRow, BooleanView, CopyButtonContainer, Field, MessageView, Stack, StyledText, TokenBalanceRow } from '@/app/components';
import { useAccountDisplayData, useTokenDisplayData } from '@/app/hooks';
import { $t } from '@/app/localization';
import { getTransactionTypeTranslationKey } from '@/app/utils';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/** @typedef {import('@/app/types/Table').TableRow} TableRow */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/** @typedef {import('@/app/types/Account').AccountDisplayData} AccountDisplayData */
/** @typedef {import('@/app/types/Token').TokenDisplayData} TokenDisplayData */

/**
 * Resolves display data for the account rows, keyed by address.
 * @param {TableRow[]} data - Array of table rows.
 * @param {ChainName} [chainName] - Chain name. Defaults to the main chain.
 * @returns {Map<string, AccountDisplayData>} Account display data by address.
 */
const useAccountDisplayMap = (data, chainName) => {
	const addresses = data.flatMap(row => {
		if (row.type !== 'account')
			return [];

		const values = Array.isArray(row.value) ? row.value : [row.value];

		return values.filter(Boolean);
	});
	const accountsDisplayData = useAccountDisplayData(addresses, chainName);

	return new Map(accountsDisplayData.map(accountDisplayData => [accountDisplayData.address, accountDisplayData]));
};

/**
 * Resolves display data for the token and fee rows, keyed by token id. Only the identity fields
 * (name, ticker, image) are read from the map; amounts come from the row itself, since several
 * rows can share one token id, such as a transfer and its fee in the native currency.
 * @param {TableRow[]} data - Array of table rows.
 * @param {ChainName} [chainName] - Chain name. Defaults to the main chain.
 * @returns {Map<string, TokenDisplayData>} Token display data by token id.
 */
const useTokenDisplayMap = (data, chainName) => {
	const tokens = data.flatMap(row => {
		if (row.type !== 'token' && row.type !== 'fee')
			return [];

		const values = Array.isArray(row.value) ? row.value : [row.value];

		return values
			.map(value => (row.type === 'fee' ? value?.token : value))
			.filter(Boolean);
	});
	const tokensDisplayData = useTokenDisplayData(tokens, chainName);

	return new Map(tokensDisplayData.map(tokenDisplayData => [tokenDisplayData.tokenId, tokenDisplayData]));
};

/**
 * Renders a single row based on its type.
 * @param {TableRow} row - Row data.
 * @param {Map<string, AccountDisplayData>} accountsDisplayMap - Account display data by address.
 * @param {Map<string, TokenDisplayData>} tokensDisplayMap - Token display data by token id.
 * @param {function(string): string} translate - Translation function.
 * @param {ChainName} [chainName] - Chain name, used to resolve chain-specific row values.
 * @param {string|number} [key] - Optional key for list rendering.
 * @returns {React.ReactNode} Row content.
 */
const renderRowValue = (row, accountsDisplayMap, tokensDisplayMap, translate, chainName, key) => {
	const isArrayValue = Array.isArray(row.value);

	if (isArrayValue && row.value.length > 0) {
		return row.value.map((value, index) => renderRowValue(
			{ ...row, value },
			accountsDisplayMap,
			tokensDisplayMap,
			translate,
			chainName,
			`${row.title}-${index}`
		));
	}
	else if (isArrayValue) {
		return <StyledText key={key}>-</StyledText>;
	}

	switch (row.type) {
	case 'account':
		return (
			<CopyButtonContainer key={key} isStretched value={row.value}>
				<AccountRow
					address={row.value}
					name={accountsDisplayMap.get(row.value)?.name}
					imageId={accountsDisplayMap.get(row.value)?.imageId}
				/>
			</CopyButtonContainer>
		);
	case 'token': {
		const tokenDisplayData = tokensDisplayMap.get(row.value.id);

		return (
			<TokenBalanceRow
				key={key}
				name={tokenDisplayData?.name}
				ticker={tokenDisplayData?.ticker}
				amount={row.value.amount}
				imageId={tokenDisplayData?.imageId}
			/>
		);
	}
	case 'fee': {
		const tokenDisplayData = tokensDisplayMap.get(row.value.token?.id);

		return (
			<TokenBalanceRow
				key={key}
				name={tokenDisplayData?.name}
				ticker={tokenDisplayData?.ticker}
				amount={row.value.token.amount}
				imageId={tokenDisplayData?.imageId}
			/>
		);
	}
	case 'message':
		return <MessageView key={key} message={row.value} />;
	case 'boolean':
		return (
			<BooleanView
				key={key}
				value={row.value}
				text={translate(`data_${row.value}`)}
			/>
		);
	case 'encryption':
		return (
			<BooleanView
				key={key}
				value={row.value}
				text={translate(`data_${row.value ? 'encrypted' : 'unencrypted'}`)}
			/>
		);
	case 'delta':
		return (
			<StyledText key={key}>
				{translate(
					'data_delta_' + (row.value > 0 ? 'increase' : row.value < 0 ? 'decrease' : 'unchanged'), 
					{ delta: Math.abs(row.value) }
				)}
			</StyledText>
		);
	case 'copy':
		return (
			<CopyButtonContainer key={key} isStretched value={row.value}>
				<StyledText>{row.value}</StyledText>
			</CopyButtonContainer>
		);
	case 'transactionType':
		return <StyledText key={key}>{translate(getTransactionTypeTranslationKey(row.value, chainName))}</StyledText>;
	case 'translate':
		return <StyledText key={key}>{translate(`data_${row.value}`)}</StyledText>;
	case 'text':
	default:
		return <StyledText key={key}>{`${row.value}` ?? '-'}</StyledText>;
	}
};

/**
 * TableView component. A component for displaying structured data in a tabular format, supporting
 * various row types such as accounts, tokens, messages, and booleans with appropriate visual
 * representations.
 * @param {object} props - Component props.
 * @param {object} [props.style] - Additional styles for the root container.
 * @param {TableRow[]} props.data - Array of row objects to display.
 * @param {ChainName} [props.chainName] - The chain the rows belong to. Defaults to the main chain.
 * @param {boolean} [props.isTitleTranslatable=false] - Whether row titles should be translated.
 * @returns {React.ReactNode} TableView component.
 */
export const TableView = ({
	style,
	data,
	chainName,
	isTitleTranslatable = false
}) => {
	if (!data || !Array.isArray(data))
		throw new Error(`TableView: "data" prop must be a valid array of rows. Received: ${typeof data}`);

	const translate = $t;
	const accountsDisplayMap = useAccountDisplayMap(data, chainName);
	const tokensDisplayMap = useTokenDisplayMap(data, chainName);

	const getTitleText = title => {
		if (isTitleTranslatable && translate)
			return translate(`fieldTitle_${title}`);

		return title;
	};

	return (
		<View style={[styles.root, style]}>
			<Stack>
				{data.map((row, index) => (
					<Field title={getTitleText(row.title)} key={`${row.title}-${index}`}>
						{renderRowValue(row, accountsDisplayMap, tokensDisplayMap, translate, chainName)}
					</Field>
				))}
			</Stack>
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		width: '100%'
	}
});
