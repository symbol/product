import { Alert, Stack, TableView } from '@/app/components';
import { $t } from '@/app/localization';
import React from 'react';

/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * MultisigAccountWarning component. A component displaying a warning message about multisig accounts
 * alongside a table listing the cosignatory accounts.
 * @param {object} props - Component props.
 * @param {string[]} props.cosignatories - Array of cosignatory account addresses.
 * @param {object} props.addressBook - Address book for resolving account info.
 * @param {object} props.accounts - Wallet accounts for resolving account info.
 * @param {ChainName} props.chainName - Chain name for token/account resolution.
 * @param {import('@/app/types/Network').NetworkIdentifier} props.networkIdentifier - Network identifier for token/account resolution.
 * @returns {React.ReactNode} MultisigAccountWarning component.
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
				variant="warning"
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
