import React from 'react';
import { Linking } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { ButtonPlain, DialogBox, FormItem, QRCode, Screen, TableView, Widget } from 'src/components';
import { config } from 'src/config';
import { $t } from 'src/localization';
import { connect } from 'src/store';
import { layout } from 'src/styles';
import { publicAccountFromPrivateKey, usePasscode, useToggle } from 'src/utils';

export const AccountDetails = connect((state) => ({
    currentAccount: state.account.current,
    multisigAddresses: state.account.multisigAddresses,
    networkProperties: state.network.networkProperties,
    networkIdentifier: state.network.networkIdentifier,
}))(function AccountDetails(props) {
    const { currentAccount, multisigAddresses, networkProperties, networkIdentifier } = props;
    const { privateKey, index, ...restAccountInfo } = currentAccount;
    const [isPrivateKeyDialogShown, togglePrivateKeyDialog] = useToggle(false);
    const QRData = {
        address: currentAccount.address,
        name: 'Account',
    };
    const tableData = {
        ...restAccountInfo,
        publicKey: publicAccountFromPrivateKey(privateKey, networkIdentifier).publicKey,
        seedIndex: index,
    };
    if (multisigAddresses.length) {
        tableData.multisigAddresses = multisigAddresses;
    }
    const isTestnet = networkIdentifier === 'testnet';

    const openBlockExplorer = () => Linking.openURL(config.explorerURL[networkIdentifier] + '/accounts/' + currentAccount.address);
    const openFaucet = () => Linking.openURL(config.faucetURL + '/?recipient=' + currentAccount.address);
    const revealPrivateKey = usePasscode('enter', togglePrivateKeyDialog);

    return (
        <Screen
            bottomComponent={
                <>
                    {isTestnet && (
                        <FormItem>
                            <ButtonPlain
                                icon={require('src/assets/images/icon-primary-faucet.png')}
                                title={$t('button_faucet')}
                                onPress={openFaucet}
                            />
                        </FormItem>
                    )}
                    <FormItem>
                        <ButtonPlain
                            icon={require('src/assets/images/icon-primary-explorer.png')}
                            title={$t('button_openTransactionInExplorer')}
                            onPress={openBlockExplorer}
                        />
                    </FormItem>
                    <FormItem>
                        <ButtonPlain
                            icon={require('src/assets/images/icon-primary-key.png')}
                            title={$t('button_revealPrivateKey')}
                            onPress={revealPrivateKey}
                        />
                    </FormItem>
                </>
            }
        >
            <ScrollView>
                <FormItem>
                    <Widget>
                        <FormItem style={layout.alignCenter}>
                            <QRCode data={QRData} type={QRCode.QRTypes.address} networkProperties={networkProperties} />
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
