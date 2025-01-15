import { transactionFromDTO } from '@/utils/transaction-from-dto';
import { walletTransactions } from '__fixtures__/local/transactions';
import { networkProperties } from '__fixtures__/local/network';
import { currentAccount } from '__fixtures__/local/wallet';
import { mosaicInfos } from '__fixtures__/local/mosaic';
import { transactionPageResponse } from '__fixtures__/api/transaction-page-response';
import { namespaceNames } from '__fixtures__/local/namespace';

describe('utils/transaction-from-dto', () => {
    it('maps transactions from API response', () => {
        // Arrange:
        const transactionOptions = {
            networkProperties,
            currentAccount,
            mosaicInfos,
            namespaceNames,
            resolvedAddresses: {},
        };

        // Act:
        const result = transactionPageResponse.map(transactionDTO => transactionFromDTO(
            transactionDTO,
            transactionOptions,
        ));

        // Assert:
        result.map((transaction, index) => 
            expect(transaction)
            .toStrictEqual(walletTransactions[index])
        );
    })
})
