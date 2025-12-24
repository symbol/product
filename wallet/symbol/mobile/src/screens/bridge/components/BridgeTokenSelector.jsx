import { FormItem, StyledText } from '@/app/components';
import { $t } from '@/app/localization';
import { TokenItem } from '@/app/screens/bridge/components/TokenItem';
import { spacings } from '@/app/styles';
import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, FadeOutDown, FadeOutUp } from 'react-native-reanimated';

/**
 * @typedef {object} BridgeTokenItem
 * @property {string} type - 'native' or 'wrapped'
 * @property {import('wallet-common-core/src/lib/controller/WalletController').WalletController} controller - Wallet controller that owns the token
 * @property {import('wallet-common-core/src/types/Token').Token} token - Token object
 * @property {import('wallet-common-core/src/lib/bridge/BridgeManager').BridgeManager} bridge - Bridge manager instance the token belongs to
 */

/**
 * Token selector component for bridge swap screen
 * @param {object} props
 * @param {BridgeTokenItem} props.sourceTokenItem - Source token item
 * @param {BridgeTokenItem} props.targetTokenItem - Target token item
 * @param {() => void} props.onReversePress - Callback when reverse button is pressed
 */
export const BridgeTokenSelector = ({ sourceTokenItem, targetTokenItem, onReversePress }) => {
    return (
        <View style={styles.tokensSelector}>
            <FormItem clear="vertical">
                <StyledText type="label">{$t('transaction_from')}</StyledText>
            </FormItem>
            <Animated.View entering={FadeInDown} exiting={FadeOutDown} key={`source-${sourceTokenItem.token.id}`}>
                <TokenItem
                    title={`${sourceTokenItem.controller.chainName} - ${sourceTokenItem.controller.currentAccount?.name}`}
                    token={sourceTokenItem.token}
                    chainName={sourceTokenItem.controller.chainName ?? ''}
                />
            </Animated.View>
            <TouchableOpacity style={styles.reverseButton} onPress={onReversePress}>
                <Image source={require('@/app/assets/images/icon-reverse.png')} style={styles.reverseButtonImage} />
            </TouchableOpacity>

            <FormItem clear="vertical">
                <StyledText type="label">{$t('transaction_to')}</StyledText>
            </FormItem>
            <Animated.View entering={FadeInUp} exiting={FadeOutUp} key={`target-${targetTokenItem.token.id}`}>
                <TokenItem
                    title={`${targetTokenItem.controller.chainName} - ${targetTokenItem.controller.currentAccount?.name}`}
                    token={targetTokenItem.token}
                    chainName={targetTokenItem.controller.chainName ?? ''}
                />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    tokensSelector: {
        position: 'relative',
        marginTop: spacings.margin * 2,
    },
    reverseButton: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -20 }, { translateY: -18 }],
        zIndex: 1,
        width: 40,
        height: 40,
    },
    reverseButtonImage: {
        width: '100%',
        height: '100%',
    }
});
