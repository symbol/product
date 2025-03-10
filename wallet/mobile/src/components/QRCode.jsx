import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LoadingIndicator } from '@/app/components';
import { borders, colors } from '@/app/styles';
import { handleError } from '@/app/utils';
import { useDataManager } from '@/app/hooks';
import { SymbolQR } from '@/app/lib/features/SymbolQR';

export const QRCode = (props) => {
    const { type, data, networkProperties } = props;
    const [prevData, setPrevData] = useState(false);

    const [generateImage, isImageLoading, image] = useDataManager(
        (data) => new SymbolQR(type, data, networkProperties).toBase64(),
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
