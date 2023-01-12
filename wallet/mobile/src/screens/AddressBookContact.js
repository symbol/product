import React from 'react';
import { Linking } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { TableView, Screen, FormItem, AccountAvatar, ButtonPlain } from 'src/components';
import { config } from 'src/config';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import store, { connect } from 'src/store';
import { layout } from 'src/styles';
import { handleError, useDataManager } from 'src/utils';

export const AddressBookContact = connect(state => ({
    networkIdentifier: state.network.networkIdentifier
}))(function AddressBookContact(props) {
    const { route, networkIdentifier } = props;
    const { name, address, isBlackListed, notes, id } = route.params;
    const [removeContact] = useDataManager(async () => {
        await store.dispatchAction({type: 'addressBook/removeContact', payload: { 
            id
        }});
        Router.goBack();
    }, null, handleError);

    const tableData = {
        name, 
        address,
        transactionsAllowed: isBlackListed
            ? $t('addressBook.transactionsBlocked')
            : $t('addressBook.transactionsAllowed'),
        notes,
    };

    const openBlockExplorer = () => Linking.openURL(config.explorerURL[networkIdentifier] + '/accounts/' + address);

    return (
        <Screen bottomComponent={<>
            <FormItem>
                <ButtonPlain title={$t('button_openAccountInExplorer')} onPress={openBlockExplorer} />
            </FormItem>
            <FormItem>
                <ButtonPlain title={$t('button_edit')} onPress={openBlockExplorer} />
            </FormItem>
            <FormItem>
                <ButtonPlain title={$t('button_remove')} onPress={removeContact} />
            </FormItem>
        </>}>
            <ScrollView>
                <FormItem style={layout.alignCenter}>
                    <AccountAvatar address={address} size="lg" />
                </FormItem>
                <FormItem>
                    <TableView data={tableData} />
                </FormItem>
            </ScrollView>
        </Screen>
    );
});
