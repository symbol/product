import React from 'react';
import { Linking } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { TableView, Screen, FormItem, AccountAvatar, ButtonPlain } from 'src/components';
import { config } from 'src/config';
import { $t } from 'src/localization';
import { connect } from 'src/store';
import { layout } from 'src/styles';

export const AccountDetails = connect(state => ({
    currentAccount: state.account.current,
    networkIdentifier: state.network.networkIdentifier
}))(function AccountDetails(props) {
    const { currentAccount, networkIdentifier } = props;
    const tableData = {};
    
    delete Object.assign(tableData, currentAccount, {['seedIndex']: currentAccount['index'] })['index'];

    const openBlockExplorer = () => Linking.openURL(config.explorerURL[networkIdentifier] + '/accounts/' + currentAccount.address)

    return (
        <Screen>
            <ScrollView>
                <FormItem style={layout.alignCenter}>
                    <AccountAvatar address={currentAccount.address} size="lg" />
                </FormItem>
                <FormItem>
                    <TableView data={tableData} />
                </FormItem>
                <FormItem>
                    <ButtonPlain title={$t('button_openTransactionInExplorer')} onPress={openBlockExplorer} />
                </FormItem>
            </ScrollView>
        </Screen>
    );
});
