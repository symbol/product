import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LoadingIndicator } from 'src/components';
import { borders, colors } from 'src/styles';
import { handleError, useDataManager } from 'src/utils';
import { convertQRToBase64, createSymbolQR, SymbolQRCodeType } from 'src/utils/qr';

export const QRCode = (props) => {
    const { type, data, networkProperties } = props;
    const [prevData, setPrevData] = useState(false);

    const [generateImage, isImageLoading, image] = useDataManager(
        (data) => {
            const qrData = createSymbolQR(type, data, networkProperties);

            return convertQRToBase64(qrData);
        },
        null,
        handleError
    );

    useEffect(() => {
        if (!isImageLoading && data !== prevData) {
            generateImage(data);
            setPrevData(data);
        }
    }, [data, isImageLoading, prevData, networkProperties.generationHash]);

    return (
        <View style={styles.root}>
            {!isImageLoading && <Image source={{ uri: image }} style={styles.image} />}
            {isImageLoading && <LoadingIndicator />}
        </View>
    );
};

QRCode.QRTypes = SymbolQRCodeType;

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
