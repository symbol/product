import _ from 'lodash';
import React, { useState } from 'react';
import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AccountAvatar, TableView, TouchableNative } from 'src/components';
import { $t } from 'src/localization';
import { connect } from 'src/store';
import { borders, colors, fonts, spacings } from 'src/styles';
import { filterCustomMosaics, getAddressName, getColorFromHash, getNativeMosaicAmount, trunc, useToggle } from 'src/utils';
import { TransactionType } from 'symbol-sdk';

export const TransactionGraphic = connect(state => ({
    addressBook: state.addressBook.addressBook,
    walletAccounts: state.wallet.accounts,
    currentAccount: state.account.current,
    networkIdentifier: state.network.networkIdentifier,
    networkProperties: state.network.networkProperties,
    ticker: state.network.ticker,
}))(function TransactionGraphic(props) {
    const { transaction, ticker, addressBook, currentAccount, networkIdentifier, networkProperties, walletAccounts } = props;
    const [isExpanded, toggle] = useToggle(false);
    const [hasBeenExpanded, setHasBeenExpanded] = useState(false);
    const accounts = walletAccounts[networkIdentifier];
    const signerName = getAddressName(transaction.signerAddress, currentAccount, accounts, addressBook);
    const signerNameColorStyle = {
        color: getColorFromHash(transaction.signerAddress)
    }
    const signerNameStyle = [styles.signerName, signerNameColorStyle];
    const targetNameStyle = [styles.targetName];

    const truncText = (str) => trunc(str, '', 24);
    const actionTypeText = truncText($t(`transactionDescriptor_${transaction.type}`));
    let Target = () => <View />;
    let targetName = '';
    let ActionBody = () => null

    const TargetMosaic = () => (
        <View style={styles.targetIconWrapper}>
            <Image source={require('src/assets/images/icon-tx-mosaic.png')} style={styles.targetIcon} />
        </View>
    );
    const TargetNamespace = () => (
        <View style={styles.targetIconWrapper}>
            <Image source={require('src/assets/images/icon-tx-namespace.png')} style={styles.targetIcon} />
        </View>
    );
    const TargetLock = () => (
        <View style={styles.targetIconWrapper}>
            <Image source={require('src/assets/images/icon-tx-lock.png')} style={styles.targetIcon} />
        </View>
    );

    switch(transaction.type) {
        case TransactionType.TRANSFER:
            Target = () => <AccountAvatar address={transaction.recipientAddress} size="md" />
            targetName = getAddressName(transaction.recipientAddress, currentAccount, accounts, addressBook);
            targetNameStyle.push({
                color: getColorFromHash(transaction.recipientAddress)
            });
            const transferredAmount = getNativeMosaicAmount(transaction.mosaics, networkProperties.networkCurrency.mosaicId);
            const hasMessage = !!transaction.message;
            const hasCustomMosaic = !!filterCustomMosaics(transaction.mosaics, networkProperties.networkCurrency.mosaicId).length;

            ActionBody = () => <>
                {hasMessage && <Image style={styles.actionIcon} source={require('src/assets/images/icon-tx-message.png')} />}
                {hasCustomMosaic && <Image style={styles.actionIcon} source={require('src/assets/images/icon-select-mosaic-custom.png')} />}
                {!!transferredAmount && <Text style={styles.actionText}>{Math.abs(transferredAmount)} {ticker}</Text>}
            </>
            break;
        case TransactionType.NAMESPACE_REGISTRATION:
            Target = TargetNamespace;
            targetName = transaction.namespaceName
            break;
        case TransactionType.MOSAIC_ALIAS:
            Target = TargetMosaic;
            targetName = transaction.mosaicId
            ActionBody = () => <Text style={styles.actionText}>{truncText(transaction.namespaceName)}</Text>
            break;
        case TransactionType.ADDRESS_ALIAS:
            Target = () => <AccountAvatar address={transaction.address} size="md" />
            targetName = getAddressName(transaction.address, currentAccount, accounts, addressBook);
            targetNameStyle.push({
                color: getColorFromHash(transaction.address)
            });
            ActionBody = () => <Text style={styles.actionText}>{truncText(transaction.namespaceName)}</Text>
            break;
        case TransactionType.MOSAIC_DEFINITION:
            Target = TargetMosaic;
            targetName = transaction.mosaicId
            break;
        case TransactionType.MOSAIC_SUPPLY_CHANGE:
            Target = TargetMosaic;
            targetName = transaction.mosaicId
            ActionBody = () => <Text style={styles.actionText}>{transaction.delta}</Text>
            break;
        case TransactionType.MOSAIC_SUPPLY_REVOCATION:
            Target = () => <AccountAvatar address={transaction.sourceAddress} size="md" />
            targetName = getAddressName(transaction.sourceAddress, currentAccount, accounts, addressBook);
            targetNameStyle.push({
                color: getColorFromHash(transaction.sourceAddress)
            });
            ActionBody = () => <>
                <Image style={styles.actionIcon} source={require('src/assets/images/icon-select-mosaic-custom.png')} />
                <Text style={styles.actionText}>{transaction.mosaicId}</Text>
            </>
            break;
        case TransactionType.ACCOUNT_MOSAIC_RESTRICTION:
        case TransactionType.ACCOUNT_ADDRESS_RESTRICTION:
        case TransactionType.ACCOUNT_OPERATION_RESTRICTION:
            Target = () => <AccountAvatar address={transaction.signerAddress} size="md" />
            targetName = getAddressName(transaction.signerAddress, currentAccount, accounts, addressBook);
            targetNameStyle.push({
                color: getColorFromHash(transaction.signerAddress)
            });
            ActionBody = () => <Text style={styles.actionText}>{truncText($t(`data_${transaction.restrictionType}`))}</Text>;
            break;
        case TransactionType.MOSAIC_GLOBAL_RESTRICTION: {
            Target = () => <TargetMosaic />
            targetName = transaction.referenceMosaicId;
            const actionText = truncText(`${transaction.restrictionKey} ${$t(`data_${transaction.newRestrictionType}`)} ${transaction.newRestrictionValue}`)
            ActionBody = () => <Text style={styles.actionText}>{actionText}</Text>;
            break;
        }
        case TransactionType.MOSAIC_ADDRESS_RESTRICTION: {
            Target = () => <AccountAvatar address={transaction.targetAddress} size="md" />
            targetName = getAddressName(transaction.targetAddress, currentAccount, accounts, addressBook);
            targetNameStyle.push({
                color: getColorFromHash(transaction.targetAddress)
            });
            const actionText = truncText(`${transaction.restrictionKey} = ${transaction.newRestrictionValue}`)
            ActionBody = () => <Text style={styles.actionText}>{actionText}</Text>;
            break;
        }
        case TransactionType.MULTISIG_ACCOUNT_MODIFICATION:
            Target = () => <AccountAvatar address={transaction.signerAddress} size="md" />
            targetName = getAddressName(transaction.signerAddress, currentAccount, accounts, addressBook);
            targetNameStyle.push({
                color: getColorFromHash(transaction.signerAddress)
            });
            break;
        case TransactionType.VRF_KEY_LINK:
        case TransactionType.NODE_KEY_LINK:
        case TransactionType.VOTING_KEY_LINK:
        case TransactionType.ACCOUNT_KEY_LINK: {
            Target = () => <AccountAvatar address={transaction.linkedAccountAddress} size="md" />
            targetName = getAddressName(transaction.linkedAccountAddress, currentAccount, accounts, addressBook);
            targetNameStyle.push({
                color: getColorFromHash(transaction.linkedAccountAddress)
            });
            const actionText = truncText(`${$t(`data_${transaction.linkAction}`)}`)
            ActionBody = () => <Text style={styles.actionText}>{actionText}</Text>;
            break;
        }
        case TransactionType.HASH_LOCK: {
            Target = () => <TargetLock />
            targetName = $t('transactionDescriptionShort_hashLock', {duration: transaction.duration});
            const transferredAmount = getNativeMosaicAmount(transaction.mosaics, networkProperties.networkCurrency.mosaicId);
            ActionBody = () => <Text style={styles.actionText}>{Math.abs(transferredAmount)} {ticker}</Text>;
            break;
        }
        case TransactionType.SECRET_LOCK:
        case TransactionType.SECRET_PROOF: {
            Target = () => <TargetLock />
            targetName = '';
            ActionBody = () => <Text style={styles.actionText}>{truncText(transaction.secret)}</Text>;
            break;
        }
        case TransactionType.ACCOUNT_METADATA: {
            Target = () => <AccountAvatar address={transaction.targetAddress} size="md" />
            targetName = getAddressName(transaction.targetAddress, currentAccount, accounts, addressBook);
            targetNameStyle.push({
                color: getColorFromHash(transaction.targetAddress)
            });
            ActionBody = () => <Text style={styles.actionText}>{truncText(transaction.scopedMetadataKey)}</Text>;
            break;
        }
        case TransactionType.NAMESPACE_METADATA: {
            Target = () => <TargetNamespace />
            targetName = transaction.targetNamespaceId;
            ActionBody = () => <Text style={styles.actionText}>{truncText(transaction.scopedMetadataKey)}</Text>;
            break;
        }
        case TransactionType.MOSAIC_METADATA: {
            Target = () => <TargetMosaic />
            targetName = transaction.targetMosaicId;
            ActionBody = () => <Text style={styles.actionText}>{truncText(transaction.scopedMetadataKey)}</Text>;
            break;
        }
    }

    const tableMaxHeight = useSharedValue(0);
    const animatedTable = useAnimatedStyle(() => ({
        maxHeight: tableMaxHeight.value,
    }));
    const animatedIconExpand = useAnimatedStyle(() => ({
        opacity: interpolate(tableMaxHeight.value, [0, 100], [0.2, 0])
    }));

    const iconExpandStyle = [styles.iconExpand, animatedIconExpand]


    const getTableData = () => _.omit(transaction, 'amount', 'id', 'innerTransactions', 'cosignaturePublicKeys', 'deadline', 'type', 'fee', 'status', 'height', 'hash', 'signerPublicKey', 'signerAddress', 'recipientAddress', 'sourceAddress');
    const handlePress = () => {
        if (!hasBeenExpanded) {
            setHasBeenExpanded(true);
        }
        toggle();
        tableMaxHeight.value = withTiming(isExpanded ? 0 : 500);
    }

    useEffect(() => {
        if (props.isExpanded) {
            handlePress();
        }
    }, [props.isExpanded]);

    return (
        <TouchableNative style={styles.root} onPress={handlePress}>
                <Text style={signerNameStyle}>{signerName}</Text>
                <View style={styles.middleSection}>
                    <AccountAvatar size="md" address={transaction.signerAddress} />
                    <View style={styles.arrowSection}>
                        <Text style={styles.actionTypeText}>{actionTypeText}</Text>
                        <Image source={require('src/assets/images/graphic/arrow.png')} style={styles.arrow} />
                        <View style={styles.actionBody}>
                            <ActionBody />
                        </View>
                    </View>
                    <View style={styles.target}>
                        <Target />
                    </View>
                </View>
                <Text style={targetNameStyle}>{targetName}</Text>
                <Animated.View style={animatedTable}>
                    {hasBeenExpanded && <TableView data={getTableData()} />}
                </Animated.View>
                <Animated.Image source={require('src/assets/images/icon-down.png')} style={iconExpandStyle} />
        </TouchableNative>
    );
});

const styles = StyleSheet.create({
    root: {
        position: 'relative',
        width: '100%',
        backgroundColor: colors.bgCard,
        borderRadius: borders.borderRadius,
        padding: spacings.padding
    },
    signerName: {
        ...fonts.transactionSignerName,
        color: colors.primary,
        width: '50%',
        marginBottom: spacings.margin / 2
    },
    middleSection: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacings.margin / 2
    },
    arrowSection: {
        position: 'relative',
        marginHorizontal: spacings.margin,
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
    },
    actionTypeText: {
        ...fonts.transactionSignerName,
        lineHeight: 20,
        color: colors.textBody,
        textAlign: 'center'
    },
    actionBody: {
        minHeight: 20,
        minWidth: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionIcon: {
        width: 18,
        height: 18,
        marginRight: spacings.margin / 4
    },
    actionText: {
        ...fonts.transactionSignerName,
        lineHeight: 20,
        color: colors.textBody,
        textAlign: 'center'
    },
    arrow: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        resizeMode: 'contain',       
    },
    target: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    targetIconWrapper: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bgForm
    },
    targetIcon: {
        height: 24,
        width: 24
    },
    targetName: {
        ...fonts.transactionSignerName,
        color: colors.primary,
        width: '50%',
        textAlign: 'right',
        alignSelf: 'flex-end'
    },
    table: {
        height: '100%'
    },
    iconExpand: {
        position: 'absolute',
        left: spacings.padding,
        bottom: 0,
        width: '100%',
        height: 24,
        resizeMode: 'contain',
        opacity: 0.2,
    }
});
