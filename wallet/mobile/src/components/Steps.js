import React, { Fragment } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacings } from 'src/styles';

export const Steps = props => {
    const { stepsCount, currentStep } = props;
    const currentIndex = currentStep - 1;
    const lastIndex = stepsCount - 1;

    return (
        <View style={styles.root}>
            {[...Array(stepsCount)].map((e, i) => (
                <Fragment key={'steps-f' + i}>
                    {i !== 0 && i <= currentIndex && (
                        <View style={styles.lineActive} key={'steps-l' + i} />
                    )}
                    {i < currentIndex && (
                        <View style={styles.circlePrevious} key={'steps-p' + i} />
                    )}
                    {i === currentIndex && (
                        <View style={styles.circleCurrent} key={'steps-c' + i}>
                            <View style={styles.circleCurrentInner} />
                        </View>
                    )}
                    {i > currentIndex && (
                        <View style={styles.circleNext} key={'steps-n' + i} />
                    )}
                    {i !== lastIndex && i >= currentIndex && (
                        <View style={styles.lineInactive} key={'steps-r' + i} />
                    )}
                </Fragment>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        position: 'relative',
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacings.padding2
    },
    lineActive: {
        flex: 1,
        height: 2,
        backgroundColor: colors.primary
    },
    lineInactive: {
        flex: 1,
        height: 4,
        backgroundColor: colors.secondary
    },
    circlePrevious: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: colors.primary
    },
    circleCurrent: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 2
    },
    circleCurrentInner: {
        width: 14,
        height: 14,
        borderRadius: 8,
        backgroundColor: colors.textBody,
    },
    circleNext: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: colors.secondary
    },
});
