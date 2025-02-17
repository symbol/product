import React, { useMemo, useState } from 'react';
import { Linking } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { ButtonPlain, DialogBox, FormItem, QRCode, Screen, TableView, Widget } from '@/app/components';
import { config } from '@/app/config';
import { $t } from '@/app/localization';
import { layout } from '@/app/styles';
import { usePasscode, useToggle } from '@/app/utils';
import WalletController from '@/app/lib/controller/MobileWalletController';
import { observer } from 'mobx-react-lite';

export const AccountDetails = observer(function AccountDetails() {
    const { currentAccount, accountInfo, networkProperties, networkIdentifier } = WalletController;
    const [privateKey, setPrivateKey] = useState('');
    const { index, ...restAccountInfo } = currentAccount;
    const [isPrivateKeyDialogShown, togglePrivateKeyDialog] = useToggle(false);
    const qrData = useMemo(
        () => ({
            address: currentAccount.address,
            name: 'Account',
        }),
        [currentAccount]
    );
    const tableData = {
        ...restAccountInfo,
        seedIndex: index,
    };
    if (accountInfo?.multisigAddresses.length) {
        tableData.multisigAddresses = accountInfo.multisigAddresses;
    }
    const isTestnet = networkIdentifier === 'testnet';

    const openBlockExplorer = () => Linking.openURL(config.explorerURL[networkIdentifier] + '/accounts/' + currentAccount.address);
    const openFaucet = () => Linking.openURL(config.faucetURL + '/?recipient=' + currentAccount.address);
    const revealPrivateKey = async () => {
        const privateKey = await WalletController.getCurrentAccountPrivateKey();
        setPrivateKey(privateKey);
        togglePrivateKeyDialog();
    };
    const confirmPrivateKeyReveal = usePasscode('enter', revealPrivateKey);

    return (
        <Screen
            bottomComponent={
                <>
                    {isTestnet && (
                        <FormItem>
                            <ButtonPlain
                                icon={require('@/app/assets/images/icon-primary-faucet.png')}
                                title={$t('button_faucet')}
                                onPress={openFaucet}
                            />
                        </FormItem>
                    )}
                    <FormItem>
                        <ButtonPlain
                            icon={require('@/app/assets/images/icon-primary-explorer.png')}
                            title={$t('button_openTransactionInExplorer')}
                            onPress={openBlockExplorer}
                        />
                    </FormItem>
                    <FormItem>
                        <ButtonPlain
                            icon={require('@/app/assets/images/icon-primary-key.png')}
                            title={$t('button_revealPrivateKey')}
                            onPress={confirmPrivateKeyReveal}
                        />
                    </FormItem>
                </>
            }
        >
            <ScrollView>
                <FormItem>
                    <Widget>
                        <FormItem style={layout.alignCenter}>
                            <QRCode data={qrData} type={QRCode.QRTypes.Address} networkProperties={networkProperties} />
                        </FormItem>
                        <FormItem>
                            <TableView data={tableData} rawAddresses />
                        </FormItem>
                    </Widget>
                </FormItem>
            </ScrollView>
            <DialogBox
                type="alert"
                title={$t('dialog_sensitive')}
                body={<TableView data={{ privateKey }} />}
                isVisible={isPrivateKeyDialogShown}
                onSuccess={togglePrivateKeyDialog}
            />
        </Screen>
    );
});
