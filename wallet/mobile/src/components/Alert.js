import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { borders, colors, spacings } from 'src/styles';
import { StyledText } from 'src/components';

export const Alert = (props) => {
    const { type, title, body } = props;

    const typeAlertMap = {
        warning: {
            icon: require('src/assets/images/icon-warning-alert.png'),
            titleStyle: styles.warningText,
            bodyStyle: styles.warningText,
        },
        danger: {
            icon: require('src/assets/images/icon-danger-alert.png'),
            titleStyle: styles.dangerText,
            bodyStyle: styles.dangerText,
        },
    };

    const alert = typeAlertMap[type];

    return (
        <View style={styles.widget}>
            <Image style={styles.icon} source={alert.icon} />
            <StyledText type="subtitle" style={alert.titleStyle}>
                {title}
            </StyledText>
            <StyledText type="body" style={alert.bodyStyle}>
                {body}
            </StyledText>
        </View>
    );
};

const styles = StyleSheet.create({
    icon: {
        width: 24,
        height: 24,
    },
    widget: {
        flexDirection: 'column',
        padding: spacings.margin,
        backgroundColor: colors.bgMain,
        borderRadius: borders.borderRadiusForm,
        minHeight: 100,
        alignItems: 'center',
    },
    warningText: {
        color: colors.warning,
        textAlign: 'center',
    },
    dangerText: {
        color: colors.danger,
        textAlign: 'center',
    },
});
