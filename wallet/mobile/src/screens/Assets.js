import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';
import { Screen, TitleBar, TabNavigator, StyledText, ItemAsset } from 'src/components';
import { $t } from 'src/localization';
import store, { connect } from 'src/store';
import { colors, spacings } from 'src/styles';
import { handleError, useDataManager, useInit } from 'src/utils';

export const Assets = connect(state => ({
    isWalletReady: state.wallet.isReady,
    chainHeight: state.network.chainHeight,
    currentAccount: state.account.current,
    mosaics: state.account.mosaics,
    namespaces: state.account.namespaces,
}))(function Assets(props) {
    const { isWalletReady, chainHeight, currentAccount, mosaics, namespaces } = props;
    const [fetchData, isLoading] = useDataManager(async () => {
        await store.dispatchAction({type: 'account/fetchData'});
    }, null, handleError);
    useInit(fetchData, isWalletReady);

    const sections = [];

    sections.push({
        title: $t('s_assets_mosaics'),
        group: 'mosaic',
        data: mosaics
    });

    if (namespaces.length) {
        sections.push({
            title: $t('s_assets_namespaces'),
            group: 'namespace',
            data: namespaces
        });
    }

    return (
        <Screen 
            titleBar={<TitleBar accountSelector settings currentAccount={currentAccount} />}
            navigator={<TabNavigator />}
        >
            <SectionList
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchData} />}
                sections={sections}
                keyExtractor={(item, section) => section.group + item.id}
                renderItem={({item, section}) => <ItemAsset asset={item} chainHeight={chainHeight} group={section.group} />}
                renderSectionHeader={({ section: { title, style } }) => (
                    <View style={styles.sectionHeader}>
                        <StyledText type="label" style={style}>{title}</StyledText>
                    </View>
                )}
                renderSectionFooter={() => <View style={styles.sectionFooter} />}
            />
        </Screen>
    );
});

const styles = StyleSheet.create({
    loadingIndicator: {
        position: 'absolute',
        height: '100%',
        width: '100%'
    },
    sectionHeader: {
        marginTop: spacings.margin
    },
    sectionFooter: {
        position: 'relative',
        marginBottom: spacings.margin
    },
});
