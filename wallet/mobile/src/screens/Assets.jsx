import React, { useMemo, useState } from 'react';
import { SectionList } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';
import { Filter, FormItem, ItemAsset, Screen, StyledText, TabNavigator, TitleBar } from '@/app/components';
import { $t } from '@/app/localization';
import { Router } from '@/app/Router';
import { colors } from '@/app/styles';
import { handleError } from '@/app/utils';
import { useDataManager, useInit, useLoading } from '@/app/hooks';
import WalletController from '@/app/lib/controller/MobileWalletController';
import { observer } from 'mobx-react-lite';

export const Assets = observer(function Assets() {
    const { isWalletReady, chainHeight, currentAccount, currentAccountInfo, networkProperties } = WalletController;
    const { mosaics, namespaces } = currentAccountInfo;
    const [filter, setFilter] = useState({});
    const [fetchData, isDataFetching] = useDataManager(WalletController.fetchAccountInfo, null, handleError);
    useInit(fetchData, isWalletReady, [currentAccount]);

    const sections = [];
    const filteredMosaics = useMemo(() => {
        let mosaicsFilteredByCreator = mosaics;

        if (filter.created) {
            mosaicsFilteredByCreator = mosaics.filter((mosaic) => mosaic.creator === currentAccount.address);
        }
        if (filter.expired) {
            return mosaicsFilteredByCreator;
        }

        return mosaicsFilteredByCreator.filter((mosaic) => mosaic.isUnlimitedDuration || mosaic.endHeight > chainHeight);
    }, [filter, mosaics]);

    sections.push({
        title: $t('s_assets_mosaics'),
        group: 'mosaic',
        data: filteredMosaics,
    });

    if (namespaces.length) {
        sections.push({
            title: $t('s_assets_namespaces'),
            group: 'namespace',
            data: namespaces,
        });
    }

    const filterConfig = [
        {
            name: 'expired',
            title: $t('s_assets_filter_expired'),
            type: 'boolean',
        },
        {
            name: 'created',
            title: $t('s_assets_filter_created'),
            type: 'boolean',
        },
    ];

    const [isLoading, isRefreshing] = useLoading(isDataFetching);

    return (
        <Screen titleBar={<TitleBar accountSelector settings isLoading={isLoading} currentAccount={currentAccount} />} navigator={<TabNavigator />}>
            <SectionList
                refreshControl={<RefreshControl tintColor={colors.primary} refreshing={isRefreshing} onRefresh={fetchData} />}
                ListHeaderComponent={<Filter data={filterConfig} value={filter} onChange={setFilter} />}
                stickySectionHeadersEnabled={false}
                sections={sections}
                keyExtractor={(item, section) => section.group + item.id}
                renderItem={({ item, section }) => (
                    <ItemAsset
                        asset={item}
                        chainHeight={chainHeight}
                        blockGenerationTargetTime={networkProperties.blockGenerationTargetTime}
                        nativeMosaicId={networkProperties.networkCurrency.mosaicId}
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
