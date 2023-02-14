import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import QRCodeScanner from 'react-native-qrcode-scanner';
import { AccountQR, AddressQR, ContactQR, MnemonicQR } from 'symbol-qr-library';
import { QRCode, StyledText } from 'src/components';
import { colors } from 'src/styles';
import { getUnresolvedIdsFromTransactionDTOs, transferTransactionFromDTO, transferTransactionFromPayload } from 'src/utils';
import { MosaicService } from 'src/services';
import { $t } from 'src/localization';

export const QRScanner = (props) => {
    const { isVisible, type, networkProperties, onSuccess, onClose } = props;
    const { QRTypes } = QRCode;

    const handleScan = async (response) => {
        let parsedType;
        let data;

        try {
            parsedType = JSON.parse(response.data).type;
            data = response.data;
        } catch {
            showMessage({ message: $t('error_qr_failed_parse'), type: 'danger' });
            onClose();
            return;
        }

        if (type && parsedType !== type) {
            showMessage({ message: $t('error_qr_expected_type'), type: 'danger' });
            onClose();
            return;
        }

        try {
            switch (parsedType) {
                case QRTypes.mnemonic:
                    onSuccess(MnemonicQR.fromJSON(data).mnemonicPlainText, 'mnemonic');
                    onClose();
                    return;
                case QRTypes.address:
                    onSuccess(AddressQR.fromJSON(data), 'address');
                    onClose();
                    return;
                case QRTypes.account:
                    onSuccess(AccountQR.fromJSON(data), 'account');
                    onClose();
                    return;
                case QRTypes.contact:
                    onSuccess(ContactQR.fromJSON(data), 'contact');
                    onClose();
                    return;
                case QRTypes.transaction:
                    const parsedData = JSON.parse(data);
                    const networkType = parsedData.network_id;
                    const transactionDTO = transferTransactionFromPayload(parsedData.data.payload);
                    const { mosaicIds } = getUnresolvedIdsFromTransactionDTOs([transactionDTO]);
                    const mosaicInfos = await MosaicService.fetchMosaicInfos(networkProperties, mosaicIds);
                    const transaction = transferTransactionFromDTO(transactionDTO, {
                        networkProperties,
                        mosaicInfos,
                        currentAccount: {},
                    });
                    onSuccess({ transaction, networkType }, 'transaction');
                    onClose();
                    return;

                default:
                    showMessage({ message: $t('error_qr_unsupported'), type: 'danger' });
            }
        } catch (e) {
            showMessage({ message: $t('error_qr_failed_parse'), type: 'danger' });
        }
        onClose();
    };

    return (
        <Modal animationType="fade" visible={isVisible} onRequestClose={onClose}>
            {isVisible && (
                <View style={styles.root}>
                    <QRCodeScanner
                        checkAndroid6Permissions
                        showMarker
                        onRead={handleScan}
                        topContent={<StyledText type="title">{$t('c_scanner_title')}</StyledText>}
                    />
                </View>
            )}
        </Modal>
    );
};

const styles = StyleSheet.create({
    root: {
        backgroundColor: colors.bgForm,
        height: '100%',
    },
});
