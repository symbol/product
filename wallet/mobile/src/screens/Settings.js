import React from 'react';
import { BackHandler, Image, StyleSheet, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { DialogBox, DropdownModal, FormItem, Screen, StyledText, TouchableNative } from 'src/components';
import { $t, getLanguages, setCurrentLanguage } from 'src/localization';
import { Router } from 'src/Router';
import { borders, colors, fonts, layout, spacings } from 'src/styles';
import { clearCache, usePasscode, useToggle } from 'src/utils';

export const Settings = () => {
    const [isLogoutConfirmVisible, toggleLogoutConfirm] = useToggle(false);
    const [isLanguageSelectorVisible, toggleLanguageSelector] = useToggle(false);
    const languageList = Object.entries(getLanguages()).map(([value, label]) => ({ value, label }));
    const settingsList = [
        {
            title: $t('s_settings_item_network_title'),
            description: $t('s_settings_item_network_description'),
            icon: require('src/assets/images/icon-settings-network.png'),
            handler: Router.goToSettingsNetwork,
        },
        {
            title: $t('s_settings_item_language_title'),
            description: $t('s_settings_item_language_description'),
            icon: require('src/assets/images/icon-settings-language.png'),
            handler: toggleLanguageSelector,
        },
        {
            title: $t('s_settings_item_security_title'),
            description: $t('s_settings_item_security_description'),
            icon: require('src/assets/images/icon-settings-security.png'),
            handler: Router.goToSettingsSecurity,
        },
        {
            title: $t('s_settings_item_about_title'),
            description: $t('s_settings_item_about_description'),
            icon: require('src/assets/images/icon-settings-about.png'),
            handler: Router.goToSettingsAbout,
        },
        {
            title: $t('s_settings_item_logout_title'),
            description: $t('s_settings_item_logout_description'),
            icon: require('src/assets/images/icon-settings-logout.png'),
            handler: toggleLogoutConfirm,
        },
    ];

    const changeLanguage = (language) => {
        setCurrentLanguage(language);
        Router.goToHome();
    };
    const logoutConfirm = () => {
        clearCache();
        BackHandler.exitApp();
    };
    const showLogoutPasscode = usePasscode('enter', logoutConfirm, Router.goBack);

    return (
        <Screen>
            <FormItem clear="vertical">
                <FlatList
                    contentContainerStyle={layout.listContainer}
                    data={settingsList}
                    keyExtractor={(_, index) => 'settings' + index}
                    renderItem={({ item }) => (
                        <FormItem type="list">
                            <TouchableNative style={styles.item} onPress={item.handler}>
                                <Image source={item.icon} style={styles.itemIcon} />
                                <View style={styles.itemContent}>
                                    <StyledText type="subtitle">{item.title}</StyledText>
                                    <StyledText type="body">{item.description}</StyledText>
                                </View>
                            </TouchableNative>
                        </FormItem>
                    )}
                />
            </FormItem>
            <DropdownModal
                title={$t('s_settings_item_language_title')}
                list={languageList}
                isOpen={isLanguageSelectorVisible}
                onChange={changeLanguage}
                onClose={toggleLanguageSelector}
            />
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
};

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
        paddingLeft: spacings.padding,
    },
    itemIcon: {
        width: 32,
        height: 32,
    },
});
