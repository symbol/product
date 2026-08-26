import { Alert, Stack, TableView } from '@/app/components';
import { $t } from '@/app/localization';
import React from 'react';

/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * MultisigAccountWarning component. A component displaying a warning message about multisig accounts
 * alongside a table listing the cosignatory accounts.
 * @param {object} props - Component props.
 * @param {string[]} props.cosignatories - Array of cosignatory account addresses.
 * @param {ChainName} [props.chainName] - The chain the accounts belong to. Defaults to the main chain.
 * @returns {React.ReactNode} MultisigAccountWarning component.
 */
export const MultisigAccountWarning = ({ cosignatories, chainName }) => {
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
				chainName={chainName}
			/>
		</Stack>
	);
};
