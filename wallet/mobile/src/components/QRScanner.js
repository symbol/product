import React from 'react';
import { Modal, SafeAreaView, StyleSheet, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import QRCodeScanner from 'react-native-qrcode-scanner';
import { ButtonClose, StyledText } from 'src/components';
import { colors, spacings } from 'src/styles';
import { $t } from 'src/localization';
import { parseSymbolQR, SymbolQRCodeType } from 'src/utils/qr';

export const QRScanner = (props) => {
    const { isVisible, type, onSuccess, onClose } = props;

    const handleParseError = (errorMessage) => {
        showMessage({ message: $t(errorMessage), type: 'danger' });
        onClose();
    };
    
    const handleScan = (response) => {
        // Parse the QR code string
        let data;
        try {
            data = JSON.parse(response.data);
        } catch {
            return handleParseError('error_qr_failed_parse');
        }

        // Parse the Symbol QR code data
        let parsedData;
        try {
            parsedData = parseSymbolQR(data);
        } catch (error) {
            return handleParseError(error.message);
        }

        // Check if the parsed data type matches the expected type (if set)
        if (type && parsedData.type !== type)
            return handleParseError('error_qr_expected_type');

        // Handle the parsed data. Deliver to the parent component 
        const handlers = {
            [SymbolQRCodeType.Contact]: data => onSuccess(data, 'contact'),
            [SymbolQRCodeType.Account]: data => onSuccess(data, 'account'),
            [SymbolQRCodeType.Transaction]: data => onSuccess(data, 'transaction'),
            [SymbolQRCodeType.Mnemonic]: (data) => onSuccess(data.mnemonicPlainText, 'mnemonic'),
            [SymbolQRCodeType.Address]: (data) => onSuccess(data, 'address'),
        }
        handlers[parsedData.type](parsedData);
        onClose();
    };

    return (
        <Modal animationType="fade" visible={isVisible} onRequestClose={onClose}>
            {isVisible && (
                <SafeAreaView style={styles.container}>
                    <View style={styles.container}>
                        <QRCodeScanner
                            checkAndroid6Permissions
                            showMarker
                            onRead={handleScan}
                            topContent={<StyledText type="title">{$t('c_scanner_title')}</StyledText>}
                        />
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
});
