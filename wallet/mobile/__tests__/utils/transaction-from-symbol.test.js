import { symbolTransactionFromPayload } from '@/utils/transaction';
import { transactionFromSymbol } from '@/utils/transaction-from-symbol';
import { payloads } from '__fixtures__/local/payloads';
import { walletTransactions } from '__fixtures__/local/transactions';
import { networkProperties } from '__fixtures__/local/network';
import { currentAccount } from '__fixtures__/local/wallet';
import { mosaicInfos } from '__fixtures__/local/mosaic';
import { namespaceNames } from '__fixtures__/local/namespace';
import _ from 'lodash';

describe('utils/transaction-from-symbol', () => {
    it('maps transactions from payload', () => {
        // Arrange:
        const transactionOptions = {
            networkProperties,
            currentAccount,
            mosaicInfos,
            namespaceNames,
            resolvedAddresses: {},
            fillSignerPublickey: currentAccount.publicKey,
        };
        const expectedResults = walletTransactions.map(transaction => 
            _.omit(transaction, ['hash', 'height', 'timestamp'])
        );

        // Act:
        const symbolTransactions = payloads.map(item => symbolTransactionFromPayload(item.payload));;
        const result = symbolTransactions.map(symbolTransaction => transactionFromSymbol(
            symbolTransaction,
            transactionOptions,
            currentAccount.address
        ));

        // Assert:
        result.map((transaction, index) => 
            expect(transaction)
            .toStrictEqual(expectedResults[index])
        );
    })
})
