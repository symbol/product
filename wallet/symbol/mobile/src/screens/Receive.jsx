import { FormItem, InputAmount, QRCode, Screen, TableView, TextBox, Widget } from '@/app/components';
import { TransactionType } from '@/app/constants';
import { useWalletController } from '@/app/hooks';
import { SymbolQR } from '@/app/lib/features/SymbolQR';
import { $t } from '@/app/localization';
import { layout } from '@/app/styles';
import _ from 'lodash';
import React, { useState } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import { createTransactionFee, transactionToPayload } from 'wallet-common-symbol';

export const Receive = () => {
	const WalletController = useWalletController();
	const { currentAccount, isWalletReady, networkProperties, networkIdentifier } = WalletController;
	const [amount, setAmount] = useState('0');
	const [message, setMessage] = useState('');

	const mosaic = {
		id: networkProperties.networkCurrency.mosaicId,
		name: networkProperties.networkCurrency.name,
		divisibility: networkProperties.networkCurrency.divisibility,
		amount: parseFloat(amount || 0)
	};
	const transaction = {
		type: TransactionType.TRANSFER,
		recipientAddress: currentAccount.address,
		mosaics: [mosaic],
		message: message
			? {
				text: message,
				isEncrypted: false
			}
			: null,
		fee: createTransactionFee(networkProperties, 0)
	};
	console.log('transaction', transaction);
	const tableData = _.pick(transaction, 'recipientAddress');
	const qrData = {
		payload: transactionToPayload(transaction, networkIdentifier)
	};

	return (
		<Screen isLoading={!isWalletReady}>
			<ScrollView>
				<FormItem>
					<Widget>
						<FormItem style={layout.alignCenter}>
							<QRCode data={qrData} type={SymbolQR.TYPE.Transaction} networkProperties={networkProperties} />
							<TableView data={tableData} rawAddresses />
						</FormItem>
					</Widget>
				</FormItem>
				<FormItem>
					<InputAmount title={$t('form_transfer_input_amount')} value={amount} onChange={setAmount} />
				</FormItem>
				<FormItem>
					<TextBox title={$t('form_transfer_input_message')} value={message} onChange={setMessage} />
				</FormItem>
			</ScrollView>
		</Screen>
	);
};
