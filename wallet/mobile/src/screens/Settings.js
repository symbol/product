import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { BackHandler, Image, StyleSheet, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { FlatList, TouchableOpacity } from 'react-native-gesture-handler';
import { AccountCard, Button, Screen, TitleBar, FormItem, StyledText } from 'src/components';
import { Router } from 'src/Router';
import store, { connect } from 'src/store';
import { borders, colors, fonts, spacings } from 'src/styles';
import { clearCache, usePasscode } from 'src/utils';

export const Settings = connect(state => ({
    currentAccount: state.account.current,
}))(function Settings(props) {
    const { } = props;
    const navigation = useNavigation();

    const logout = () => {
        showPasscode();
    }
    const logoutConfirm = () => {
        clearCache();
        BackHandler.exitApp();
    }
    
    const showPasscode = usePasscode('enter', logoutConfirm, navigation.goBack);

    // notranslate
    const settingsList = [{
        title: 'Network',
        description: 'Select network type and node you would like to connect to.',
        icon: require('src/assets/images/icon-settings-network.png'),
        handler: Router.goToSettingsNetwork
    },
    {
        title: 'Security',
        description: 'Backup your passphrase and manage PIN code',
        icon: require('src/assets/images/icon-settings-security.png'),
    },
    {
        title: 'About',
        description: 'Learn morn about Symbol. Application version information.',
        icon: require('src/assets/images/icon-settings-about.png'),
    },
    {
        title: 'Logout',
        description: 'Remove all accounts from device storage. You can restore your account later by entering mnemonic backup passphrase.',
        icon: require('src/assets/images/icon-settings-logout.png'),
        handler: logout
    }];

    return (
        <Screen>
            <FlatList data={settingsList} keyExtractor={(item, index) => 'settings' + index} renderItem={({item, index}) => (
                <FormItem type="list">
                    <TouchableOpacity style={styles.item} onPress={item.handler}>
                        <Image source={item.icon} style={styles.itemIcon} />
                        <View style={styles.itemContent}>
                            <StyledText type="subtitle">
                                {item.title}
                            </StyledText>
                            <StyledText type="body">
                                {item.description}
                            </StyledText> 
                        </View>
                    </TouchableOpacity>
                </FormItem>
            )} />
        </Screen>
    );
});

const styles = StyleSheet.create({
    item: {
        flexDirection: 'row',
        minHeight: fonts.body.fontSize * 4 + spacings.padding * 2,
        borderRadius: borders.borderRadius,
        backgroundColor: colors.bgCard,
        padding: spacings.padding,
    },
    itemContent: {
        flex: 1,
        paddingLeft: spacings.padding
    },
    itemIcon: {
        width: 32,
        height: 32,
    }
});
