import { Card, Spacer, Stack, TableView } from '@/app/components';

export const RequestDetails = ({ requestDetailsViewModel, chainName, networkIdentifier, walletAccounts, addressBook }) => {

	return (
		<Card>
			<Spacer>
				<Stack>
					<TableView
						data={requestDetailsViewModel.tableData}
						addressBook={addressBook}
						walletAccounts={walletAccounts}
						chainName={chainName}
						networkIdentifier={networkIdentifier}
					/>
				</Stack>
			</Spacer>
		</Card>
	);
};
