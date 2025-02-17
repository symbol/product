import _ from 'lodash';
import React, { useState } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import { FormItem, InputAmount, QRCode, Screen, TableView, TextBox, Widget } from 'src/components';
import { TransactionType } from 'src/constants';
import { $t } from 'src/localization';
import { layout } from 'src/styles';
import { transactionToPayload } from 'src/utils';
import WalletController from 'src/lib/controller/MobileWalletController';
import { observer } from 'mobx-react-lite';

export const Receive = observer(function Receive() {
    const { currentAccount, isWalletReady, networkProperties } = WalletController;
    const [amount, setAmount] = useState('0');
    const [message, setMessage] = useState('');

    const mosaic = {
        id: networkProperties.networkCurrency.mosaicId,
        name: networkProperties.networkCurrency.name,
        divisibility: networkProperties.networkCurrency.divisibility,
        amount: parseFloat(amount || 0),
    };
    const transaction = {
        type: TransactionType.TRANSFER,
        recipientAddress: currentAccount.address,
        mosaics: [mosaic],
        message: message
            ? {
                  text: message,
                  isEncrypted: false,
              }
            : null,
        fee: 1,
    };
    const tableData = _.pick(transaction, 'recipientAddress');
    const qrData = {
        transactionPayload: transactionToPayload(transaction, networkProperties),
    };

    return (
        <Screen isLoading={!isWalletReady}>
            <ScrollView>
                <FormItem>
                    <Widget>
                        <FormItem style={layout.alignCenter}>
                            <QRCode data={qrData} type={QRCode.QRTypes.Transaction} networkProperties={networkProperties} />
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
});
