import { AccountView, BooleanView, CopyButtonContainer, Field, MessageView, Stack, StyledText, TokenView } from '@/app/components';
import { $t } from '@/app/localization';
import { createTokenDisplayData, getAccountKnownInfo } from '@/app/utils';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * @typedef {import('@/app/types/Table').TableRow} TableRow
 */

/**
 * Resolves known info for account and token rows
 * @param {TableRow[]} data - Array of table rows
 * @param {object} options - Resolution options
 * @returns {Map<string, object>} Map of resolved info by value
 */
const useResolvedData = (data, options) => {
	const { addressBook, walletAccounts, chainName, networkIdentifier } = options;

	return useMemo(() => {
		const resolved = new Map();

		for (const row of data) {
			const values = Array.isArray(row.value) ? row.value : [row.value];

			for (const value of values) {
				if (resolved.has(value))
					continue;

				if (row.type === 'account' && value) {
					const info = getAccountKnownInfo(value, {
						walletAccounts: walletAccounts[networkIdentifier],
						addressBook,
						chainName,
						networkIdentifier
					});
					resolved.set(value, info);
				}

				if ((row.type === 'token' || row.type === 'fee') && value) {
					const tokenId = value.id ?? value.token?.id ?? value;
					const info = createTokenDisplayData(value, chainName, networkIdentifier);
					resolved.set(tokenId, info);
				}
			}
		}

		return resolved;
	}, [data, addressBook, walletAccounts, chainName, networkIdentifier]);
};

/**
 * Renders a single row based on its type
 * @param {TableRow} row - Row data
 * @param {Map<string, object>} resolvedData - Map of resolved known info
 * @param {function} translate - Translation function
 * @param {string|number} [key] - Optional key for list rendering
 * @returns {React.ReactNode} Row content
 */
const renderRowValue = (row, resolvedData, translate, key) => {
	const isArrayValue = Array.isArray(row.value);

	if (isArrayValue && row.value.length > 0) {
		return row.value.map((value, index) => renderRowValue(
			{ ...row, value },
			resolvedData,
			translate,
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
				<AccountView
					address={row.value}
					name={resolvedData.get(row.value)?.name}
					imageId={resolvedData.get(row.value)?.imageId}
				/>
			</CopyButtonContainer>
		);
	case 'token':
		return (
			<TokenView
				key={key}
				name={resolvedData.get(row.value.id ?? row.value)?.name ?? row.value.name}
				amount={row.value.amount}
				ticker={resolvedData.get(row.value.id ?? row.value)?.ticker}
				imageId={resolvedData.get(row.value.id ?? row.value)?.imageId}
			/>
		);
	case 'fee':
		return (
			<TokenView
				key={key}
				name={resolvedData.get(row.value.token?.id ?? row.value.token)?.name ?? row.value.token.name}
				amount={row.value.token.amount}
				ticker={resolvedData.get(row.value.token?.id ?? row.value.token)?.ticker}
				imageId={resolvedData.get(row.value.token?.id ?? row.value.token)?.imageId}
			/>
		);
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
 *
 * @param {object} props - Component props
 * @param {object} [props.style] - Additional styles for the root container
 * @param {TableRow[]} props.data - Array of row objects to display
 * @param {object} [props.addressBook] - Address book instance for resolving account names
 * @param {Array} [props.walletAccounts] - List of wallet accounts for resolving account names
 * @param {string} [props.chainName] - Blockchain name (e.g., 'symbol')
 * @param {string} [props.networkIdentifier] - Network identifier (e.g., 'mainnet')
 * @param {boolean} [props.isTitleTranslatable=false] - Whether row titles should be translated
 * @param {boolean} [props.showEmptyArrays=false] - Whether to show rows with empty array values
 *
 * @returns {React.ReactNode} TableView component
 */
export const TableView = ({
	style,
	data,
	addressBook,
	walletAccounts,
	chainName,
	networkIdentifier,
	isTitleTranslatable = false,
	showEmptyArrays = false
}) => {
	if (!data || !Array.isArray(data))
		throw new Error(`TableView: "data" prop must be a valid array of rows. Received: ${typeof data}`);

	const translate = $t;
	const resolvedData = useResolvedData(data, {
		addressBook,
		walletAccounts,
		chainName,
		networkIdentifier
	});

	const shouldRenderRow = row => {
		const isArrayValue = Array.isArray(row.value);

		if (isArrayValue && row.value.length === 0 && !showEmptyArrays)
			return true;

		return true;
	};
	const getTitleText = title => {
		if (isTitleTranslatable && translate)
			return translate(`fieldTitle_${title}`);

		return title;
	};

	return (
		<View style={[styles.root, style]}>
			<Stack>
				{data.map((row, index) => (
					shouldRenderRow(row) && (
						<Field title={getTitleText(row.title)} key={`${row.title}-${index}`}>
							{renderRowValue(row, resolvedData, translate)}
						</Field>
					)
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
