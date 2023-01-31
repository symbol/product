import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { FormItem, ItemBase } from 'src/components';
import { $t } from 'src/localization';
import { connect } from 'src/store';
import { colors, fonts, spacings } from 'src/styles';
import { formatDate, getAddressName, isAggregateTransaction, isIncomingTransaction, isOutgoingTransaction, trunc } from 'src/utils';
import { TransactionType } from 'symbol-sdk';

export const ItemTransaction = connect(state => ({
    currentAccount: state.account.current,
    walletAccounts: state.wallet.accounts,
    networkIdentifier: state.network.networkIdentifier,
    addressBook: state.addressBook.addressBook,
    ticker: state.network.ticker,
}))(function ItemTransaction(props) {
    const { currentAccount, walletAccounts, networkIdentifier, addressBook, group, transaction, ticker, onPress } = props;
    const accounts = walletAccounts[networkIdentifier];
    const { type, deadline, amount, signerAddress, recipientAddress } = transaction;
    const dateText = formatDate(deadline, $t);
    let iconSrc;
    let action = $t(`transactionDescriptor_${type}`);
    let description = '';
    let amountText = '';
    const styleAmount = [styles.textAmount];
    const styleRoot = [styles.root];

    if (amount < 0) {
        amountText = `${amount} ${ticker}`;
        styleAmount.push(styles.outgoing);
    }
    else if (amount > 0) {
        amountText = `${amount} ${ticker}`;
        styleAmount.push(styles.incoming);
    }

    if (type === TransactionType.TRANSFER && isOutgoingTransaction(transaction, currentAccount)) {
        const address = getAddressName(recipientAddress, currentAccount, accounts, addressBook);
        const isAddressName = address !== recipientAddress;
        const addressText = isAddressName ? address : trunc(address, 'address');
        action = $t(`transactionDescriptor_${type}_outgoing`);
        description = `To ${addressText}`;
        iconSrc = require('src/assets/images/icon-tx-transfer.png');
    }
    else if (type === TransactionType.TRANSFER && isIncomingTransaction(transaction, currentAccount)) {
        const address = getAddressName(signerAddress, currentAccount, accounts, addressBook);
        const isAddressName = address !== signerAddress;
        const addressText = isAddressName ? address : trunc(address, 'address');
        action = $t(`transactionDescriptor_${type}_incoming`);
        description = `From ${addressText}`;
        iconSrc = require('src/assets/images/icon-tx-transfer.png');
    }
    else if (type === TransactionType.TRANSFER) {
        iconSrc = require('src/assets/images/icon-tx-transfer.png');
    }
    else if (isAggregateTransaction(transaction)) {
        const firstTransactionType = transaction.innerTransactions[0]?.type;
        const type = firstTransactionType ? $t(`transactionDescriptor_${firstTransactionType}`) : '';
        const count = transaction.innerTransactions.length - 1;
        description = count 
            ? $t('transactionDescriptionShort_aggregateMultiple', {type, count})
            : type;
        iconSrc = require('src/assets/images/icon-tx-aggregate.png');
    }
    else if (type === TransactionType.NAMESPACE_REGISTRATION) {
        const name = transaction.namespaceName;
        description = $t('transactionDescriptionShort_namespaceRegistration', {name});
        iconSrc = require('src/assets/images/icon-tx-namespace.png');
    }
    else if (type === TransactionType.ADDRESS_ALIAS) {
        const address = getAddressName(transaction.address, currentAccount, accounts, addressBook);
        const isAddressName = address !== transaction.address;
        const addressText = isAddressName ? address : trunc(address, 'address');
        const target = addressText;
        const name = transaction.namespaceName;
        description = $t('transactionDescriptionShort_alias', {target, name});
        iconSrc = require('src/assets/images/icon-tx-namespace.png');
    }
    else if (type === TransactionType.MOSAIC_ALIAS) {
        const target = trunc(transaction.mosaicId, 'address');
        const name = transaction.namespaceName;
        description = $t('transactionDescriptionShort_alias', {target, name});
        iconSrc = require('src/assets/images/icon-tx-namespace.png');
    }
    else if (
        type === TransactionType.MOSAIC_DEFINITION 
        || type === TransactionType.MOSAIC_SUPPLY_CHANGE
        || type === TransactionType.MOSAIC_SUPPLY_REVOCATION
    ) {
        const id = transaction.mosaicId;
        description = $t('transactionDescriptionShort_mosaic', {id});
        iconSrc = require('src/assets/images/icon-tx-mosaic.png');
    }
    else if (
        type === TransactionType.ACCOUNT_MOSAIC_RESTRICTION
        || type === TransactionType.ACCOUNT_ADDRESS_RESTRICTION
        || type === TransactionType.ACCOUNT_OPERATION_RESTRICTION
    ) {
        const restrictionType = transaction.restrictionType;
        description = $t(`data_${restrictionType}`);
        iconSrc = require('src/assets/images/icon-tx-restriction.png');
    }
    else if (
        type === TransactionType.MOSAIC_GLOBAL_RESTRICTION 
        || type === TransactionType.MOSAIC_ADDRESS_RESTRICTION
    ) {
        const id = transaction.mosaicId || transaction.referenceMosaicId;
        description = $t('transactionDescriptionShort_mosaicRestriction', {id});
        iconSrc = require('src/assets/images/icon-tx-restriction.png');
    }
    else if (
        type === TransactionType.VRF_KEY_LINK 
        || type === TransactionType.NODE_KEY_LINK
        || type === TransactionType.VOTING_KEY_LINK
        || type === TransactionType.ACCOUNT_KEY_LINK
    ) {
        const linkAction = transaction.linkAction;
        description = $t(`data_${linkAction}`);
        iconSrc = require('src/assets/images/icon-tx-key.png');
    }
    else if (
        type === TransactionType.HASH_LOCK 
    ) {
        const duration = transaction.duration;
        description = $t('transactionDescriptionShort_hashLock', {duration});
        iconSrc = require('src/assets/images/icon-tx-lock.png');
    }
    else if (
        type === TransactionType.SECRET_LOCK
        || type === TransactionType.SECRET_PROOF
    ) {
        description = trunc(transaction.secret, 'hash');
        iconSrc = require('src/assets/images/icon-tx-lock.png');
    }

    if (group === 'unconfirmed') {
        iconSrc = require('src/assets/images/icon-tx-unconfirmed.png');
        styleRoot.push(styles.rootUnconfirmed)
    }
    else if (group === 'partial') {
        styleRoot.push(styles.rootPartial)
    }

    return (
        <ItemBase contentContainerStyle={styleRoot} isLayoutAnimationEnabled onPress={onPress}>
            <View style={styles.sectionIcon}>
                <Image source={iconSrc} style={styles.icon} />
            </View>
            <View style={styles.sectionMiddle}>
                <Text style={styles.textAction}>{action}</Text>
                <Text style={styles.textDescription}>{description}</Text>
                <View style={styles.rowAmount}>
                    <Text style={styles.textDate}>{dateText}</Text>
                    <Text style={styleAmount}>{amountText}</Text>
                </View>
            </View>
        </ItemBase>
    );
});

export const ItemTransactionPlaceholder = () => (
    <FormItem type="list">
        <View style={[styles.root, styles.rootLoadingPlaceholder]} />
    </FormItem>
);

const styles = StyleSheet.create({
    root: {
        flexDirection: 'row',
        width: '100%',
        minHeight: 75,
    },
    rootPartial: {
        borderColor: colors.neutral
    },
    rootUnconfirmed: {
        borderColor: colors.warning
    },
    rootLoadingPlaceholder: {
        opacity: 0.2
    },
    icon: {
        height: 24,
        width: 24
    },
    textAction: {
        ...fonts.subtitle,
        color: colors.textBody
    },
    textDescription: {
        ...fonts.body,
        color: colors.textBody
    },
    textDate: {
        ...fonts.body,
        color: colors.textBody,
        fontSize: 10,
        opacity: 0.7,
        textAlignVertical: 'center'
    },
    textAmount: {
        ...fonts.bodyBold,
        color: colors.textBody
    },
    outgoing: {
        color: colors.danger
    },
    incoming: {
        color: colors.success
    },
    sectionIcon: {
        flexDirection: 'column',
        justifyContent: 'center',
        paddingRight: spacings.padding
    },
    sectionMiddle: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'space-between'
    },
    rowAmount: {
        alignSelf: 'stretch',
        flexDirection: 'row',
        justifyContent: 'space-between'
    }
});
