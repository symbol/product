import { Card, Spacer, Stack, TableView } from '@/app/components';

/** @typedef {import('react')} React */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * RequestDetails component. A card listing the parameters of a transport request as a table.
 * @param {object} props - Component props.
 * @param {object} props.requestDetailsViewModel - View model with the table rows to display.
 * @param {ChainName} [props.chainName] - The chain the request belongs to. Defaults to the main chain.
 * @returns {React.ReactNode} RequestDetails component.
 */
export const RequestDetails = ({ requestDetailsViewModel, chainName }) => {

	return (
		<Card>
			<Spacer>
				<Stack>
					<TableView
						data={requestDetailsViewModel.tableData}
						chainName={chainName}
					/>
				</Stack>
			</Spacer>
		</Card>
	);
};
