import React from 'react';
import { Linking } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { AccountAvatar, ButtonPlain, DialogBox, FormItem, Screen, TableView, Widget } from 'src/components';
import { config } from 'src/config';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import { layout } from 'src/styles';
import { useDataManager, useToggle } from 'src/utils';
import WalletController from 'src/lib/controller/MobileWalletController';
import { observer } from 'mobx-react-lite';

export const AddressBookContact = observer(function AddressBookContact(props) {
    const { route } = props;
    const { networkIdentifier } = WalletController;
    const { addressBook } = WalletController.modules;
    const contact = addressBook.getContactById(route.params.id);
    const { name, address, isBlackListed, notes } = contact;
    const [isRemoveConfirmVisible, toggleRemoveConfirm] = useToggle(false);
    const [removeContact] = useDataManager(() => {
        Router.goBack();
        addressBook.removeContact(address);
    });

    const tableData = {
        name,
        address,
        notes,
        list: isBlackListed ? $t('s_addressBook_contact_blacklist_explain') : $t('s_addressBook_contact_whitelist_explain'),
    };

    const handleSendPress = () => Router.goToSend({ recipientAddress: address });
    const handleEditPress = () => Router.goToAddressBookEdit({ ...contact, type: 'edit' });
    const handleOpenBlockExplorer = () => Linking.openURL(config.explorerURL[networkIdentifier] + '/accounts/' + address);

    return (
        <Screen
            bottomComponent={
                <>
                    <FormItem>
                        <ButtonPlain
                            icon={require('src/assets/images/icon-primary-send-2.png')}
                            title={$t('button_sendTransferTransaction')}
                            onPress={handleSendPress}
                        />
                    </FormItem>
                    <FormItem>
                        <ButtonPlain
                            icon={require('src/assets/images/icon-primary-explorer.png')}
                            title={$t('button_openAccountInExplorer')}
                            onPress={handleOpenBlockExplorer}
                        />
                    </FormItem>
                    <FormItem>
                        <ButtonPlain
                            icon={require('src/assets/images/icon-primary-edit.png')}
                            title={$t('button_edit')}
                            onPress={handleEditPress}
                        />
                    </FormItem>
                    <FormItem>
                        <ButtonPlain
                            icon={require('src/assets/images/icon-primary-remove.png')}
                            title={$t('button_remove')}
                            onPress={toggleRemoveConfirm}
                        />
                    </FormItem>
                </>
            }
        >
            <ScrollView>
                <FormItem>
                    <Widget>
                        <FormItem style={layout.alignCenter}>
                            <AccountAvatar address={address} size="lg" />
                        </FormItem>
                        <FormItem>
                            <TableView data={tableData} rawAddresses />
                        </FormItem>
                    </Widget>
                </FormItem>
            </ScrollView>
            <DialogBox
                type="confirm"
                title={$t('s_addressBook_confirm_removeContact_title')}
                text={$t('s_addressBook_confirm_removeContact_body', { name })}
                isVisible={isRemoveConfirmVisible}
                onSuccess={removeContact}
                onCancel={toggleRemoveConfirm}
            />
        </Screen>
    );
});
