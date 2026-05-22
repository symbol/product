import '@testing-library/jest-dom';
import IconTransactionType, { getTransactionIconSrc } from '@/components/IconTransactionType';
import symbolTransactionsPageConfig from '@/variants/symbol/config/pages/transactions.json';
import { render, screen } from '@testing-library/react';

const symbolIconPathMap = {
	ACCOUNT_KEY_LINK: '/images/transaction/account-link.svg',
	NODE_KEY_LINK: '/images/transaction/account-link.svg',
	AGGREGATE_COMPLETE: '/images/transaction/aggregate-complete.svg',
	AGGREGATE_BONDED: '/images/transaction/aggregate.svg',
	VOTING_KEY_LINK: '/images/transaction/account-link.svg',
	VRF_KEY_LINK: '/images/transaction/account-link.svg',
	HASH_LOCK: '/images/transaction/lock.svg',
	SECRET_LOCK: '/images/transaction/lock.svg',
	SECRET_PROOF: '/images/transaction/lock.svg',
	ACCOUNT_METADATA: '/images/transaction/metadata.svg',
	MOSAIC_METADATA: '/images/transaction/metadata.svg',
	NAMESPACE_METADATA: '/images/transaction/metadata.svg',
	MOSAIC_DEFINITION: '/images/transaction/mosaic.svg',
	MOSAIC_SUPPLY_CHANGE: '/images/transaction/mosaic.svg',
	MOSAIC_SUPPLY_REVOCATION: '/images/transaction/revoke.svg',
	MULTISIG_ACCOUNT_MODIFICATION: '/images/transaction/account-multisig.svg',
	ADDRESS_ALIAS: '/images/transaction/namespace.svg',
	MOSAIC_ALIAS: '/images/transaction/namespace.svg',
	NAMESPACE_REGISTRATION: '/images/transaction/namespace.svg',
	ACCOUNT_ADDRESS_RESTRICTION: '/images/transaction/restriction.svg',
	ACCOUNT_MOSAIC_RESTRICTION: '/images/transaction/restriction.svg',
	ACCOUNT_OPERATION_RESTRICTION: '/images/transaction/restriction.svg',
	MOSAIC_ADDRESS_RESTRICTION: '/images/transaction/restriction.svg',
	MOSAIC_GLOBAL_RESTRICTION: '/images/transaction/restriction.svg',
	TRANSFER: '/images/transaction/transfer.svg'
};

describe('IconTransactionType', () => {
	it('keeps the NEM mosaic creation icon as the default shared mapping', () => {
		// Act:
		render(<IconTransactionType value="MOSAIC_DEFINITION" />);

		// Assert:
		expect(screen.getByAltText('MOSAIC_DEFINITION')).toHaveAttribute('src', '/images/transaction/mosaic-creation.svg');
	});

	it.each(Object.entries(symbolIconPathMap))('resolves Symbol %s to %s', (type, iconPath) => {
		// Act:
		const result = getTransactionIconSrc(type, symbolTransactionsPageConfig);

		// Assert:
		expect(result).toBe(iconPath);
	});
});
