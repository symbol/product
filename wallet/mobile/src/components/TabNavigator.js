import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { TouchableHighlight, TouchableNativeFeedback } from 'react-native-gesture-handler';
import { useRoute } from '@react-navigation/native';
import { StyledText } from 'src/components';
import { Router } from 'src/Router';
import { borders, colors } from 'src/styles';

export const TabNavigator = props => {
    const routeName = useRoute().name;
    const Touchable = Platform.OS === 'android'
        ? TouchableNativeFeedback
        : TouchableHighlight;
    const touchableBackground = Platform.OS === 'android'
        ? TouchableNativeFeedback.Ripple(colors.bgTabsNavigatorActive)
        : colors.bgTabsNavigatorActive;

    // notranslate
    const tabs = [{
        title: 'Home',
        name: 'Home',
        icon: require('src/assets/images/icon-tabs-home.png'),
        iconActive: require('src/assets/images/icon-tabs-home-active.png'),
        handler: () => routeName !== 'Home' && Router.goToHome()
    }, {
        title: 'History',
        name: 'History',
        icon: require('src/assets/images/icon-tabs-history.png'),
        iconActive: require('src/assets/images/icon-tabs-history-active.png'),
        handler: () => routeName !== 'History' && Router.goToHistory()
    }, {
        title: 'Scan',
        name: 'Scan',
        icon: require('src/assets/images/icon-tabs-scan.png'),
        iconActive: require('src/assets/images/icon-tabs-scan-active.png'),
        handler: () => routeName !== 'Scan' && Router.goToScan()
    }, {
        title: 'Assets',
        name: 'Assets',
        icon: require('src/assets/images/icon-tabs-assets.png'),
        iconActive: require('src/assets/images/icon-tabs-assets-active.png'),
        handler: () => routeName !== 'Assets' && Router.goToAssets()
    }, {
        title: 'Actions',
        name: 'Actions',
        icon: require('src/assets/images/icon-tabs-actions.png'),
        iconActive: require('src/assets/images/icon-tabs-actions-active.png'),
        handler: () => routeName !== 'Actions' && Router.goToActions()
    }];

    const getItemStyle = tab => tab.name === routeName ? [styles.item, styles.itemActive] : [styles.item];
    const getTitleStyle = tab => tab.name === routeName ? [styles.title, styles.titleActive] : [styles.title];
    const getIconSrc = tab => tab.name === routeName ? tab.iconActive : tab.icon;

    return (
        <View style={styles.root}>
            {tabs.map((tab, index) => (
                <View style={getItemStyle(tab)} key={'tab' + index}>
                    <Touchable background={touchableBackground} style={styles.touchable} onPress={tab.handler}>
                        <Image source={getIconSrc(tab)} style={styles.icon} />
                        <StyledText type="tab" style={getTitleStyle(tab)}>{tab.title}</StyledText>
                    </Touchable>
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        width: '100%',
        backgroundColor: colors.bgTabsNavigator,
        flexDirection: 'row',

    },
    item: {
        flex: 1,
        height: 60,
        borderRadius: borders.borderRadius,
    },
    itemActive: {
        backgroundColor: colors.bgTabsNavigatorActive
    },
    touchable: {
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
    },
    title: {
        color: colors.controlBaseTextAlt
    },
    titleActive: {
        color: colors.primary
    },
    icon: {
        width: 24,
        height: 24,
    }
});
