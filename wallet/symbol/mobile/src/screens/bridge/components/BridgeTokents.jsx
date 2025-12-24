import { FormItem, Widget } from '@/app/components';
import { $t } from '@/app/localization';
import { Router } from '@/app/Router';
import { TokenItem } from '@/app/screens/bridge/components/TokenItem';
import { spacings } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

export const BridgeTokenList = ({ bridgeAccounts }) => {
    const openAccount = (item) => {
        Router.goToBridgeAccountDetails({
            chainName: item.chainName,
        });
    };
    const filteredAccounts = bridgeAccounts.filter(item => item.sourceToken);

    return filteredAccounts.map(item => (
        <TokenItem
            title={item.chainName}
            chainName={item.chainName}
            token={item.sourceToken}
            onPress={() => openAccount(item)}
        />
    ));
};

export const BridgeWidget = ({ bridgeTokens }) => {
    const openAccount = (item) => {
        Router.goToBridgeAccountDetails({
            chainName: item.chainName,
        });
    };

    return (
        <FormItem>
            <Widget title={$t('s_bridge_widget_name')} onHeaderPress={() => Router.goToBridgeAccountList()}>
                <View style={styles.widgetList}>
                    {bridgeTokens.map(item => (
                        <TokenItem
                            title={item.chainName}
                            chainName={item.chainName}
                            token={item.token}
                            onPress={() => openAccount(item)}
                        />
                    ))}
                </View>
            </Widget>
        </FormItem>
    );
};

const styles = StyleSheet.create({
    widgetList: {
        //paddingTop: spacings.margin
    }
});
