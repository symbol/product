import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { AddressQR, TransactionQR } from 'symbol-qr-library';
import { LoadingIndicator } from 'src/components';
import { borders, colors } from 'src/styles';
import { handleError, networkIdentifierToNetworkType, transferTransactionToDTO, useDataManager } from 'src/utils';

const QRCodeType = {
    contact: 1,
    account: 2,
    transaction: 3,
    mnemonic: 5,
    address: 7,
};

export const QRCode = (props) => {
    const { type, data, networkProperties } = props;
    const { generationHash } = networkProperties;
    const networkType = networkIdentifierToNetworkType(networkProperties.networkIdentifier);
    const [prevData, setPrevData] = useState(false);

    const [generateImage, isImageLoading, image] = useDataManager(
        (data) => {
            switch (type) {
                case QRCodeType.transaction:
                    const transaction = transferTransactionToDTO(data, networkProperties);
                    return new TransactionQR(transaction, networkType, generationHash).toBase64().toPromise();
                case QRCodeType.address:
                    return new AddressQR(data.name, data.address, networkType, generationHash).toBase64().toPromise();
            }
        },
        null,
        handleError
    );

    useEffect(() => {
        if (!isImageLoading && data !== prevData) {
            generateImage(data);
            setPrevData(data);
        }
    }, [data, isImageLoading, prevData]);

    return (
        <View style={styles.root}>
            {!isImageLoading && <Image source={{ uri: image }} style={styles.image} />}
            {isImageLoading && <LoadingIndicator />}
        </View>
    );
};

QRCode.QRTypes = QRCodeType;

const styles = StyleSheet.create({
    root: {
        width: 260,
        height: 260,
        backgroundColor: colors.accentLightForm,

        borderRadius: borders.borderRadius,
    },
    image: {
        width: '100%',
        height: '100%',
        borderRadius: borders.borderRadius,
    },
});
