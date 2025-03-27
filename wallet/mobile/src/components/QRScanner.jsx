import React, { useEffect } from 'react';
import { Modal, SafeAreaView, StyleSheet, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { ButtonClose, StyledText } from '@/app/components';
import { colors, spacings } from '@/app/styles';
import { $t } from '@/app/localization';
import { SymbolQR } from '@/app/lib/features/SymbolQR';
import { extractAccountSymbolQR, extractAddressSymbolQR, extractContactSymbolQR, extractMnemonicSymbolQR } from '@/app/utils';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';

export const QRScanner = (props) => {
    const { isVisible, type, onSuccess, onClose } = props;

    const handleParseError = (errorMessage) => {
        showMessage({ message: $t(errorMessage), type: 'danger' });
        onClose();
    };

    const handleScan = (codes) => {
        const data = codes[0].value;
        
        // Parse the QR code string
        let symbolQR;
        try {
            symbolQR = SymbolQR.fromTransportString(data);
        } catch {
            return handleParseError('error_qr_failed_parse');
        }

        // Check if the parsed data type matches the expected type (if set)
        if (type && symbolQR.type !== type) return handleParseError('error_qr_expected_type');

        const parsedData = symbolQR.toJSON();

        // Handle the parsed data. Deliver to the parent component
        const handlers = {
            [SymbolQR.TYPE.Contact]: (data) => onSuccess(extractContactSymbolQR(data), 'contact'),
            [SymbolQR.TYPE.Account]: (data) => onSuccess(extractAccountSymbolQR(data), 'account'),
            [SymbolQR.TYPE.Transaction]: (data) => onSuccess(data, 'transaction'),
            [SymbolQR.TYPE.Mnemonic]: (data) => onSuccess(extractMnemonicSymbolQR(data), 'mnemonic'),
            [SymbolQR.TYPE.Address]: (data) => onSuccess(extractAddressSymbolQR(data), 'address'),
        };
        handlers[symbolQR.type](parsedData);
        onClose();
    };

    // Setups for the camera
    const { hasPermission, requestPermission } = useCameraPermission();
    const codeScanner = useCodeScanner({
        codeTypes: ['qr'],
        onCodeScanned: handleScan
    });
    const device = useCameraDevice('back');

    useEffect(() => {
        if (isVisible && !hasPermission) {
            requestPermission();
        }
    }, [isVisible, hasPermission]);

    return (
        <Modal animationType="fade" visible={isVisible} onRequestClose={onClose}>
            {isVisible && (
                <SafeAreaView style={styles.container}>
                    <View style={styles.container}>
                        {hasPermission && <Camera style={{flex: 1}} isActive device={device} codeScanner={codeScanner} />}
                        <StyledText style={styles.title} type="title">{$t('c_scanner_title')}</StyledText>
                        {!hasPermission && <StyledText style={styles.permission}>No Permission</StyledText>}
                        <ButtonClose type="cancel" style={styles.buttonCancel} onPress={onClose} />
                    </View>
                </SafeAreaView>
            )}
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        backgroundColor: colors.bgForm,
        height: '100%',
    },
    buttonCancel: {
        position: 'absolute',
        right: spacings.margin,
        top: spacings.margin,
    },
    title: {
        position: 'absolute',
        top: spacings.margin * 8,
        width: '100%',
        textAlign: 'center',
    },
    permission: {
        position: 'absolute',
        top: spacings.margin * 16,
        width: '100%',
        textAlign: 'center',
    },
});
