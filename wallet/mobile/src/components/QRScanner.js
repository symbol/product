import React from 'react';
import { Modal, StyleSheet } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import QRCodeScanner from 'react-native-qrcode-scanner';
import { MnemonicQR, QRCodeType } from 'symbol-qr-library';
import { StyledText } from 'src/components';
import { colors } from 'src/styles';

export const QRScanner = props => {
    const { isVisible, type, title, onSuccess, onClose } = props;

    const handleScan = response => {
        let parsedType
        let data;

        try {
            parsedType = JSON.parse(response.data).type;
            data = response.data;
        }
        catch {
            showMessage({message: 'error_qr_failed_parse', type: 'danger'});
            onClose();
            return;
        }

        if (type && parsedType !== type) {
            // notranslate
            showMessage({message: 'error_qr_expected_type_' + type, type: 'danger'});
            onClose();
            return;
        }

        try {
            switch (parsedType) {
                case QRCodeType.ExportMnemonic:
                    onSuccess(MnemonicQR.fromJSON(data).mnemonicPlainText, 'mnemonic');
                    onClose();
                    return;

                default:
                    // notranslate
                showMessage({message: 'error_qr_unsupported', type: 'danger'});
            }
        }
        catch(e) {
            // notranslate
            showMessage({message: 'error_qr_failed_parse ' + e.message, type: 'danger'});
        }

        onClose();
    };

    return (
        <Modal animationType="fade" visible={isVisible} onRequestClose={onClose} style={styles.root}>
            {isVisible && <QRCodeScanner
                checkAndroid6Permissions
                showMarker
                onRead={handleScan}
                topContent={
                    <StyledText type="title">
                        {/* notranslate */}
                        Scan Symbol QR-code
                    </StyledText>
                }
                bottomContent={
                    <StyledText type="body">
                        {/* notranslate */}
                        {title}
                    </StyledText>
                }
            />}
        </Modal>
    );
};

const styles = StyleSheet.create({
    root: {
        backgroundColor: colors.bgForm
    },
});
