import _ from 'lodash';
import React from 'react';
import { Linking } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { ButtonPlain, FormItem, Screen, StyledText, TableView, Widget } from '@/app/components';
import { config } from '@/app/config';
import { $t } from '@/app/localization';
import { Router } from '@/app/Router';
import { isMosaicRevokable } from '@/app/utils';
import WalletController from '@/app/lib/controller/MobileWalletController';
import { observer } from 'mobx-react-lite';

export const AssetDetails = observer(function AssetDetails(props) {
    const { route } = props;
    const { currentAccount, chainHeight, networkIdentifier } = WalletController;
    const { asset, group } = route.params;
    let title = '';
    let tableData = {};

    const remainedBlocks = asset.endHeight - chainHeight;
    const assetWithExpiration = { ...asset };
    const isExpired = remainedBlocks <= 0;

    if (!asset.isUnlimitedDuration && !isExpired) {
        assetWithExpiration.expireIn = $t('s_assetDetails_expireInBlocks', { blocks: remainedBlocks });
    } else if (!asset.isUnlimitedDuration) {
        assetWithExpiration.expireIn = $t('s_assetDetails_expired');
    }

    if (group === 'mosaic') {
        title = $t('s_assetDetails_mosaic');
        tableData = _.pick(assetWithExpiration, ['id', 'names', 'amount', 'supply', 'expireIn', 'creator']);
    } else if (group === 'namespace') {
        title = $t('s_assetDetails_namespace');
        tableData = _.pick(assetWithExpiration, ['id', 'name', 'expireIn', 'linkedMosaicId', 'linkedAddress', 'creator']);
    }

    const isSendButtonVisible = group === 'mosaic' && (!isExpired || asset.isUnlimitedDuration);
    const isRevokeButtonVisible = group === 'mosaic' && isMosaicRevokable(asset, chainHeight, currentAccount.address);

    const handleOpenBlockExplorer = () => Linking.openURL(`${config.explorerURL[networkIdentifier]}/${group}s/${asset.id}`);
    const handleSendPress = () => Router.goToSend({ mosaicId: asset.id });
    const handleRevokePress = () => Router.goToRevoke({ mosaics: [asset] });

    return (
        <Screen
            bottomComponent={
                <>
                    {isSendButtonVisible && (
                        <FormItem>
                            <ButtonPlain
                                icon={require('@/app/assets/images/icon-primary-send-2.png')}
                                title={$t('button_sendTransferTransaction')}
                                onPress={handleSendPress}
                            />
                        </FormItem>
                    )}
                    {isRevokeButtonVisible && (
                        <FormItem>
                            <ButtonPlain
                                icon={require('@/app/assets/images/icon-primary-revoke.png')}
                                title={$t('button_revoke')}
                                onPress={handleRevokePress}
                            />
                        </FormItem>
                    )}
                    <FormItem>
                        <ButtonPlain
                            icon={require('@/app/assets/images/icon-primary-explorer.png')}
                            title={$t('button_openTransactionInExplorer')}
                            onPress={handleOpenBlockExplorer}
                        />
                    </FormItem>
                </>
            }
        >
            <ScrollView>
                <FormItem type="group">
                    <StyledText type="title">{title}</StyledText>
                    <Widget>
                        <FormItem>
                            <TableView data={tableData} currentAccount={currentAccount} />
                        </FormItem>
                    </Widget>
                </FormItem>
            </ScrollView>
        </Screen>
    );
});
