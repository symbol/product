import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { FlatList, TouchableWithoutFeedback } from 'react-native-gesture-handler';
import { AccountAvatar, ButtonCircle, FormItem, ItemContact, Screen, StyledText, TabView, Widget } from 'src/components';
import { Router } from 'src/Router';
import { colors, layout, spacings } from 'src/styles';
import { trunc } from 'src/utils';
import { $t } from 'src/localization';
import WalletController from 'src/lib/controller/MobileWalletController';
import { observer } from 'mobx-react-lite';

export const AddressBookList = observer(function AddressBookList() {
    const { addressBook } = WalletController.modules;
    const [list, setList] = useState('whitelist');
    const tabs = [
        {
            label: $t('s_addressBook_whitelist'),
            value: 'whitelist',
            content: (
                <FlatList
                    contentContainerStyle={layout.listContainer}
                    data={addressBook.whiteList}
                    keyExtractor={(item) => 'contact' + item.address}
                    renderItem={({ item }) => <ItemContact contact={item} onPress={() => Router.goToAddressBookContact(item)} />}
                />
            ),
        },
        {
            label: $t('s_addressBook_blacklist'),
            value: 'blacklist',
            content: (
                <FlatList
                    contentContainerStyle={layout.listContainer}
                    data={addressBook.blackList}
                    keyExtractor={(item) => 'contact' + item.address}
                    renderItem={({ item }) => <ItemContact contact={item} onPress={() => Router.goToAddressBookContact(item)} />}
                />
            ),
        },
    ];

    return (
        <Screen>
            <TabView tabs={tabs} onChange={setList} />
            <ButtonCircle
                source={require('src/assets/images/icon-dark-account-add.png')}
                onPress={() => Router.goToAddressBookEdit({ list })}
            />
        </Screen>
    );
});

export const AddressBookListWidget = observer(function AddressBookListWidget(props) {
    const { addressBook } = WalletController.modules;

    const getFormattedName = (contact) => trunc(contact.name, null, 12);
    const handleHeaderPress = () => {
        Router.goToAddressBookList();
    };
    const handleContactPress = (contact) => {
        Router.goToAddressBookContact(contact);
    };
    const handleAddPress = () => {
        Router.goToAddressBookEdit();
    };

    return (
        <FormItem>
            <Widget title={$t('s_addressBook_widget_name')} onHeaderPress={handleHeaderPress}>
                <FlatList
                    horizontal
                    contentContainerStyle={styles.addressBookList}
                    data={addressBook.whiteList}
                    keyExtractor={(_, index) => 'contact' + index}
                    renderItem={({ item }) => (
                        <TouchableWithoutFeedback style={styles.addressBookItem} onPress={() => handleContactPress(item)}>
                            <View style={styles.addressBookItem}>
                                <AccountAvatar size="md" address={item.address} />
                                <StyledText type="body">{getFormattedName(item)}</StyledText>
                            </View>
                        </TouchableWithoutFeedback>
                    )}
                    ListFooterComponent={
                        <TouchableWithoutFeedback style={styles.addressBookItem} onPress={handleAddPress}>
                            <View style={styles.addressBookCircle}>
                                <Image source={require('src/assets/images/icon-account-add.png')} style={styles.addressBookAddIcon} />
                            </View>
                            <StyledText type="body">{$t('button_addContact')}</StyledText>
                        </TouchableWithoutFeedback>
                    }
                />
            </Widget>
        </FormItem>
    );
});

const styles = StyleSheet.create({
    addressBookList: {
        padding: spacings.margin,
    },
    addressBookItem: {
        width: 100,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
    },
    addressBookCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bgForm,
    },
    addressBookAddIcon: {
        height: 24,
        width: 24,
    },
});
