import React, { useEffect, useState } from 'react';
import { hasUserSetPinCode, deleteUserPinCode } from '@haskkor/react-native-pincode';
import { Screen, FormItem, StyledText, Checkbox, MnemonicView } from 'src/components';
import {  handleError, useDataManager, usePasscode } from 'src/utils';
import { SecureStorage } from 'src/storage';
import { $t } from 'src/localization';
import { Router } from 'src/Router';

export function SettingsSecurity() {
    const [isPasscodeEnabled, setIsPasscodeEnabled] = useState(false);
    const [mnemonic, setMnemonic] = useState('');
    const [isMnemonicShown, setIsMnemonicShown] = useState(false);
    const [loadData, isDataLoading] = useDataManager(async () => {
        const isPasscodeEnabled = await hasUserSetPinCode();
        const mnemonic = await SecureStorage.getMnemonic()
        
        setIsPasscodeEnabled(isPasscodeEnabled);
        setMnemonic(mnemonic);
    }, null, handleError);
    const [togglePasscodeEnabled, isSetPasscodeLoading] = useDataManager(async () => {
        if (isPasscodeEnabled) {
            await deleteUserPinCode();
        }

        loadData();
        Router.goBack();
    }, null, handleError);
    

    const passcodeAction = isPasscodeEnabled ? 'enter' : 'choose';
    const confirmEnablePasscode = usePasscode(passcodeAction, togglePasscodeEnabled);

    const showMnemonic = () => {
        setIsMnemonicShown(true);
        Router.goBack();
    };
    const confirmShowMnemonic = usePasscode('enter', showMnemonic);

    useEffect(loadData, []);

    const isLoading = isDataLoading || isSetPasscodeLoading;

    return (
        <Screen isLoading={isLoading}>
            <FormItem>
                <StyledText type="title">
                    {$t('settings_security_pin_title')}
                </StyledText>
                <StyledText type="body">
                    {$t('settings_security_pin_body')}
                </StyledText>
            </FormItem>
            <FormItem>
                <Checkbox
                    title={$t('settings_security_pin_toggle')} 
                    value={isPasscodeEnabled} 
                    onChange={confirmEnablePasscode} 
                />
            </FormItem>
            <FormItem>
                <StyledText type="title">
                    {$t('settings_security_mnemonic_title')}
                </StyledText>
                <StyledText type="body">
                    {$t('settings_security_mnemonic_body')}
                </StyledText>
            </FormItem>
            <FormItem>
                <MnemonicView mnemonic={mnemonic} isShown={isMnemonicShown} onShowPress={confirmShowMnemonic} />
            </FormItem>
        </Screen>
    );
};
