import React from 'react';
import { Dimensions, Image, StyleSheet } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { FormItem, ItemBase, Screen, StyledText, TabNavigator, TitleBar } from 'src/components';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import { connect } from 'src/store';
import { fonts, spacings } from 'src/styles';

const SCREEN_WIDTH = Dimensions.get('screen').width;
const COLS = 3;

export const Actions = connect((state) => ({
    currentAccount: state.account.current,
    isWalletReady: state.wallet.isReady,
}))(function Actions(props) {
    const { currentAccount, isWalletReady } = props;

    const list = [
        {
            title: 'Address Book',
            icon: require('src/assets/images/icon-address-book.png'),
            handler: Router.goToAddressBookList,
        },
        {
            title: 'Harvesting',
            icon: require('src/assets/images/icon-harvesting.png'),
            handler: () => showMessage({ type: 'info', message: 'Not implemented yet' }),
        },
        {
            title: 'Send Transfer',
            icon: require('src/assets/images/icon-send.png'),
            handler: Router.goToSend,
        },
    ];

    return (
        <Screen
            titleBar={<TitleBar accountSelector settings currentAccount={currentAccount} />}
            navigator={<TabNavigator />}
            isLoading={!isWalletReady}
        >
            <FormItem type="group" clear="bottom">
                <StyledText type="title">{$t('s_actions_title')}</StyledText>
            </FormItem>
            <FormItem style={styles.container}>
                {list.map((item, index) => (
                    <ItemBase style={styles.item} contentContainerStyle={styles.itemContent} key={'act' + index} onPress={item.handler}>
                        <Image source={item.icon} style={styles.itemIcon} />
                        <StyledText style={styles.itemTitle}>{item.title}</StyledText>
                    </ItemBase>
                ))}
            </FormItem>
        </Screen>
    );
});

const styles = StyleSheet.create({
    container: {
        gap: spacings.margin,
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
    },
    item: {
        width: SCREEN_WIDTH / COLS - (spacings.margin / 2) * COLS,
        height: SCREEN_WIDTH / COLS - (spacings.margin / 2) * COLS,
        marginHorizontal: 0,
    },
    itemContent: {
        height: '100%',
        flexDirection: 'column',
        justifyContent: 'space-evenly',
        alignItems: 'center',
    },
    itemIcon: {
        width: 24,
        height: 24,
        marginBottom: spacings.paddingSm,
    },
    itemTitle: {
        ...fonts.label,
        fontSize: 14,
        textAlign: 'center',
    },
});
