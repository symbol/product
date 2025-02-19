import React, { useEffect } from 'react';
import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { AccountAvatar, DropdownModal, TextBox } from '@/app/components';
import { $t } from '@/app/localization';
import { colors, fonts, spacings } from '@/app/styles';
import { trunc, validateRequired, validateUnresolvedAddress } from '@/app/utils';
import { useToggle, useValidation } from '@/app/hooks';
import WalletController from '@/app/lib/controller/MobileWalletController';
import { observer } from 'mobx-react-lite';

export const InputAddressDropdown = observer(function InputAddressDropdown(props) {
    const { title, value, onChange, isOpen, onClose } = props;
    const { accounts, networkIdentifier } = WalletController;
    const { addressBook } = WalletController.modules;
    const networkAccounts = accounts[networkIdentifier];
    const contacts = [...networkAccounts, ...addressBook.whiteList];
    const contactList = useMemo(
        () =>
            contacts?.map((contact) => ({
                ...contact,
                value: contact.address,
            })),
        [contacts]
    );

    return (
        <DropdownModal
            title={title}
            value={value}
            list={contactList}
            isOpen={isOpen}
            onChange={onChange}
            onClose={onClose}
            renderItem={({ item }) => (
                <View style={styles.item}>
                    <View style={styles.label}>
                        <AccountAvatar style={styles.avatar} address={item.address} size="sm" />
                        <Text style={styles.name}>{item.name}</Text>
                    </View>
                    <Text style={styles.address}>{trunc(item.address, 'address')}</Text>
                </View>
            )}
        />
    );
});

export const InputAddress = (props) => {
    const { title, value, onChange, onValidityChange } = props;
    const [isDropdownOpen, toggleDropdown] = useToggle(false);
    const errorMessage = useValidation(value, [validateRequired(), validateUnresolvedAddress()], $t);

    useEffect(() => {
        onValidityChange(!errorMessage);
    }, [value, errorMessage]);

    return (
        <>
            <TextBox
                title={title}
                errorMessage={errorMessage}
                value={value}
                onChange={onChange}
                contentRight={
                    <TouchableOpacity onPress={toggleDropdown}>
                        <Image style={styles.icon} source={require('@/app/assets/images/icon-address-book.png')} />
                    </TouchableOpacity>
                }
            />
            <InputAddressDropdown title={title} value={value} isOpen={isDropdownOpen} onChange={onChange} onClose={toggleDropdown} />
        </>
    );
};

const styles = StyleSheet.create({
    icon: {
        width: 24,
        height: 24,
    },
    item: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    label: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        marginRight: spacings.paddingSm,
    },
    name: {
        ...fonts.body,
        color: colors.textBody,
    },
    address: {
        ...fonts.label,
        fontSize: 12,
        color: colors.textBody,
        opacity: 0.7,
    },
});
