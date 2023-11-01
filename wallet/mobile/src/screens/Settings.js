import React from 'react';
import { DeviceEventEmitter, Image, StyleSheet, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { DialogBox, DropdownModal, FormItem, Screen, StyledText, TouchableNative } from 'src/components';
import { Constants, config } from 'src/config';
import { $t, getLanguages, initLocalization, setCurrentLanguage } from 'src/localization';
import { Router } from 'src/Router';
import store, { connect } from 'src/store';
import { borders, colors, fonts, layout, spacings } from 'src/styles';
import { clearCache, usePasscode, useToggle } from 'src/utils';

export const Settings = connect((state) => ({
    userCurrency: state.market.userCurrency,
}))(function Settings(props) {
    const { userCurrency } = props;
    const [isLogoutConfirmVisible, toggleLogoutConfirm] = useToggle(false);
    const [isLanguageSelectorVisible, toggleLanguageSelector] = useToggle(false);
    const [isUserCurrencySelectorVisible, toggleUserCurrencySelector] = useToggle(false);
    const languageList = Object.entries(getLanguages()).map(([value, label]) => ({ value, label }));
    const currencyList = config.marketCurrencies.map((currency) => ({ value: currency, label: currency }));
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
            title: $t('s_settings_item_currency_title'),
            description: $t('s_settings_item_currency_description'),
            icon: require('src/assets/images/icon-settings-currency.png'),
            handler: toggleUserCurrencySelector,
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
    const changeUserCurrency = (userCurrency) => {
        store.dispatchAction({ type: 'market/changeUserCurrency', payload: userCurrency });
    };
    const logoutConfirm = async () => {
        clearCache();
        initLocalization();
        await store.dispatchAction({ type: 'wallet/loadAll' });
        store.dispatchAction({ type: 'network/connect' });
        DeviceEventEmitter.emit(Constants.Events.LOGOUT);
    };
    const showLogoutPasscode = usePasscode('enter', logoutConfirm);
    const handleLogoutPress = () => {
        toggleLogoutConfirm();
        showLogoutPasscode();
    };

    return (
        <Screen>
            <FormItem clear="vertical">
                <FlatList
                    contentContainerStyle={layout.listContainer}
                    data={settingsList}
                    keyExtractor={(_, index) => 'settings' + index}
                    renderItem={({ item, index }) => (
                        <Animated.View entering={FadeInRight.delay(index * 50)}>
                            <FormItem type="list">
                                <TouchableNative style={styles.item} onPress={item.handler}>
                                    <Image source={item.icon} style={styles.itemIcon} />
                                    <View style={styles.itemContent}>
                                        <StyledText type="subtitle">{item.title}</StyledText>
                                        <StyledText type="body">{item.description}</StyledText>
                                    </View>
                                </TouchableNative>
                            </FormItem>
                        </Animated.View>
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
            <DropdownModal
                title={$t('s_settings_item_currency_title')}
                list={currencyList}
                value={userCurrency}
                isOpen={isUserCurrencySelectorVisible}
                onChange={changeUserCurrency}
                onClose={toggleUserCurrencySelector}
            />
            <DialogBox
                type="confirm"
                title={$t('settings_logout_confirm_title')}
                text={$t('settings_logout_confirm_text')}
                isVisible={isLogoutConfirmVisible}
                onSuccess={handleLogoutPress}
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
        paddingLeft: spacings.padding,
    },
    itemIcon: {
        width: 32,
        height: 32,
    },
});
