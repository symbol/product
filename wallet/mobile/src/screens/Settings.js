import React from 'react';
import { BackHandler, Image, StyleSheet, View } from 'react-native';
import { FlatList, TouchableOpacity } from 'react-native-gesture-handler';
import { Screen, FormItem, StyledText, DialogBox } from 'src/components';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import { connect } from 'src/store';
import { borders, colors, fonts, layout, spacings } from 'src/styles';
import { clearCache, usePasscode, useToggle } from 'src/utils';

export const Settings = connect(state => ({
    currentAccount: state.account.current,
}))(function Settings() {
    const [isLogoutConfirmVisible, toggleLogoutConfirm] = useToggle(false);

    const logoutConfirm = () => {
        clearCache();
        BackHandler.exitApp();
    }
    
    const showLogoutPasscode = usePasscode('enter', logoutConfirm, Router.goBack);

    // notranslate
    const settingsList = [{
        title: 'Network',
        description: 'Select network type and node you would like to connect to.',
        icon: require('src/assets/images/icon-settings-network.png'),
        handler: Router.goToSettingsNetwork
    },
    {
        title: 'Security',
        description: 'Backup your passphrase and manage PIN code.',
        icon: require('src/assets/images/icon-settings-security.png'),
        handler: Router.goToSettingsSecurity
    },
    {
        title: 'About',
        description: 'Learn morn about Symbol. Application version information.',
        icon: require('src/assets/images/icon-settings-about.png'),
        handler: Router.goToSettingsAbout
    },
    {
        title: 'Logout',
        description: 'Remove all accounts from device storage.',
        icon: require('src/assets/images/icon-settings-logout.png'),
        handler: toggleLogoutConfirm
    }];

    return (
        <Screen>
            <FormItem clear="vertical">
                <FlatList
                    contentContainerStyle={layout.listContainer}
                    data={settingsList} 
                    keyExtractor={(item, index) => 'settings' + index} 
                    renderItem={({item, index}) => (
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
            </FormItem>
            <DialogBox 
                type="confirm" 
                title={$t('settings_logout_confirm_title')}
                text={$t('settings_logout_confirm_text')}
                isVisible={isLogoutConfirmVisible} 
                onSuccess={showLogoutPasscode} 
                onCancel={toggleLogoutConfirm} 
            />
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
