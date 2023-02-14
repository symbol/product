import React, { useEffect } from 'react';
import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { AccountAvatar, DropdownModal, TextBox } from 'src/components';
import { $t } from 'src/localization';
import { colors, fonts, spacings } from 'src/styles';
import { trunc, useToggle, useValidation, validateRequired, validateUnresolvedAddress } from 'src/utils';

export const InputAddress = (props) => {
    const { title, value, onChange, contacts, onValidityChange } = props;
    const [isDropdownOpen, toggleDropdown] = useToggle(false);
    const errorMessage = useValidation(value, [validateRequired(), validateUnresolvedAddress()], $t);
    const contactList = useMemo(
        () =>
            contacts?.map((contact) => ({
                ...contact,
                value: contact.address,
            })),
        [contacts]
    );

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
                    contacts && (
                        <TouchableOpacity onPress={toggleDropdown}>
                            <Image style={styles.icon} source={require('src/assets/images/icon-address-book.png')} />
                        </TouchableOpacity>
                    )
                }
            />
            <DropdownModal
                title={title}
                value={value}
                list={contactList}
                isOpen={isDropdownOpen}
                onChange={onChange}
                onClose={toggleDropdown}
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
