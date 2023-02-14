import React from 'react';
import { SectionList } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';
import { FormItem, ItemAsset, Screen, StyledText, TabNavigator, TitleBar } from 'src/components';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import store, { connect } from 'src/store';
import { handleError, useDataManager, useInit } from 'src/utils';

export const Assets = connect((state) => ({
    isWalletReady: state.wallet.isReady,
    chainHeight: state.network.chainHeight,
    currentAccount: state.account.current,
    mosaics: state.account.mosaics,
    namespaces: state.account.namespaces,
    networkProperties: state.network.networkProperties,
}))(function Assets(props) {
    const { isWalletReady, chainHeight, currentAccount, mosaics, namespaces, networkProperties } = props;
    const [fetchData, isLoading] = useDataManager(
        async () => {
            await store.dispatchAction({ type: 'account/fetchData' });
        },
        null,
        handleError
    );
    useInit(fetchData, isWalletReady, [currentAccount]);

    const sections = [];

    sections.push({
        title: $t('s_assets_mosaics'),
        group: 'mosaic',
        data: mosaics,
    });

    if (namespaces.length) {
        sections.push({
            title: $t('s_assets_namespaces'),
            group: 'namespace',
            data: namespaces,
        });
    }

    return (
        <Screen titleBar={<TitleBar accountSelector settings currentAccount={currentAccount} />} navigator={<TabNavigator />}>
            <SectionList
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchData} />}
                sections={sections}
                keyExtractor={(item, section) => section.group + item.id}
                renderItem={({ item, section }) => (
                    <ItemAsset
                        asset={item}
                        chainHeight={chainHeight}
                        blockGenerationTargetTime={networkProperties.blockGenerationTargetTime}
                        group={section.group}
                        onPress={() =>
                            Router.goToAssetDetails({
                                asset: item,
                                group: section.group,
                            })
                        }
                    />
                )}
                renderSectionHeader={({ section: { title, style } }) => (
                    <FormItem>
                        <StyledText type="label" style={style}>
                            {title}
                        </StyledText>
                    </FormItem>
                )}
            />
        </Screen>
    );
});
