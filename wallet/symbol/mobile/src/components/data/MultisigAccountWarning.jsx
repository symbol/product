import { Alert, Stack, TableView } from '@/app/components';
import { $t } from '@/app/localization';
import React from 'react';

/**
 * MultisigAccountWarning component to display a warning about multisig accounts
 * along with a table of cosignatories.
 *
 * @param {object} props - Component props
 * @param {string[]} props.cosignatories - Array of cosignatory account addresses
 * @param {object} props.addressBook - Address book for resolving account info
 * @param {object} props.accounts - Wallet accounts for resolving account info
 * @param {string} props.chainName - Chain name for token/account resolution
 * @param {import('@/app/types/Network').NetworkIdentifier} props.networkIdentifier - Network identifier for token/account resolution
 *
 * @returns {React.ReactNode} Rendered MultisigAccountWarning component
 */
export const MultisigAccountWarning = ({ cosignatories, addressBook, accounts, chainName, networkIdentifier }) => {
	const tableData = [
		{
			title: 'cosignatories',
			type: 'account',
			value: cosignatories
		}
	];

	return (
		<Stack>
			<Alert
				type="warning"
				title={$t('warning_multisig_title')}
				body={$t('warning_multisig_body')}
			/>
			<TableView
				isTitleTranslatable
				data={tableData}
				addressBook={addressBook}
				walletAccounts={accounts}
				chainName={chainName}
				networkIdentifier={networkIdentifier}
			/>
		</Stack>
	);
};
