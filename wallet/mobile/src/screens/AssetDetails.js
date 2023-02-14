import _ from 'lodash';
import React from 'react';
import { Linking } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { ButtonPlain, FormItem, Screen, StyledText, TableView, Widget } from 'src/components';
import { config } from 'src/config';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import { connect } from 'src/store';

export const AssetDetails = connect((state) => ({
    currentAccount: state.account.current,
    chainHeight: state.network.chainHeight,
    networkIdentifier: state.network.networkIdentifier,
}))(function AssetDetails(props) {
    const { route, currentAccount, chainHeight, networkIdentifier } = props;
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

    const handleOpenBlockExplorer = () => Linking.openURL(`${config.explorerURL[networkIdentifier]}/${group}s/${asset.id}`);
    const handleSendPress = () => Router.goToSend({ mosaicId: asset.id });

    return (
        <Screen
            bottomComponent={
                <>
                    {isSendButtonVisible && (
                        <FormItem>
                            <ButtonPlain
                                icon={require('src/assets/images/icon-primary-send-2.png')}
                                title={$t('button_sendTransferTransaction')}
                                onPress={handleSendPress}
                            />
                        </FormItem>
                    )}
                    <FormItem>
                        <ButtonPlain
                            icon={require('src/assets/images/icon-primary-explorer.png')}
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
