import _ from 'lodash';
import React, { useState } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import { TableView, Screen, FormItem, TextBox,StyledText, InputAmount, Widget, QRCode } from 'src/components';
import { $t } from 'src/localization';
import { connect } from 'src/store';
import { layout } from 'src/styles';

export const Receive = connect(state => ({
    currentAccount: state.account.current,
    networkProperties: state.network.networkProperties,
    ticker: state.network.ticker,
}))(function Receive(props) {
    const { currentAccount, networkProperties } = props;
    const [amount, setAmount] = useState('0');
    const [message, setMessage] = useState('');
    
    const mosaic = {
        id: networkProperties.networkCurrency.mosaicId,
        name: networkProperties.networkCurrency.name,
        divisibility: networkProperties.networkCurrency.divisibility,
        amount: parseFloat(amount || 0)
    }
    const transaction = {
        recipientAddress: currentAccount.address,
        mosaics: [mosaic],
        messageText: message ? message : null,
        fee: 1
    };
    const tableData = _.pick(transaction, 'recipientAddress');

    return (
        <Screen>
            <ScrollView>
                <FormItem>
                    <Widget>
                        <FormItem style={layout.alignCenter}>
                            <QRCode 
                                data={transaction} 
                                type={QRCode.QRTypes.transaction}
                                networkProperties={networkProperties}
                            />
                            <TableView data={tableData} rawAddresses />
                        </FormItem>
                    </Widget>
                </FormItem>
                <FormItem>
                    <InputAmount 
                        title={$t('form_transfer_input_amount')} 
                        value={amount} 
                        onChange={setAmount}
                    />
                </FormItem>
                <FormItem>
                    <TextBox
                        title={$t('form_transfer_input_message')} 
                        value={message} 
                        onChange={setMessage} 
                    />
                </FormItem>
            </ScrollView>
        </Screen>
    );
});
