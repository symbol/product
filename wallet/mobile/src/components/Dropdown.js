import React, { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View, FlatList, TouchableOpacity } from 'react-native';
import {  } from 'react-native-gesture-handler';
import { FormItem, StyledText, ButtonClose } from 'src/components';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming, ZoomInUp } from 'react-native-reanimated';
import { borders, colors, fonts, spacings, timings } from 'src/styles';

export const Dropdown = props => {
    const { testID, title, value, list, onChange } = props;
    const [isOpen, setIsOpen] = useState(false);
    const isPressed = useSharedValue(false);
    const animatedContainer = useAnimatedStyle(() => ({
        borderColor: interpolateColor(
            isPressed.value,
            [0, 1],
            [colors.controlBaseStroke, colors.controlBaseFocussedStroke]
        ),
    }));

    const valueText = list.find(item => item.value === value)?.label || value;
    const getItemStyle = (itemValue) => itemValue == value ? [styles.item, styles.itemSelected] : styles.item

    const handlePressIn = () => {
        isPressed.value = withTiming(true, timings.press);
    };
    const handlePressOut = () => {
        isPressed.value = withTiming(false, timings.press);
    };
    const handlePress = () => {
        setIsOpen(true);
    };
    const handleClose = () => {
        setIsOpen(false);
    }
    const handleChange = (value) => {
        onChange(value);
        handleClose();
    }

    return (<View>
        <Pressable onPress={handlePress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
            <Animated.View style={[styles.root, animatedContainer]}>
                <View>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.value} testID={testID}>{valueText}</Text>
                </View>
                
                <Image source={require('src/assets/images/icon-down.png')} style={styles.icon} />
            </Animated.View>
        </Pressable>
        <Modal
            animationType="fade"
            transparent={true}
            visible={isOpen}
            onRequestClose={handleClose}
        >
            <View style={styles.modal}>
                <View style={styles.modalContainer}>
                    <StyledText type="title">{title}:</StyledText>
                    {isOpen && <FlatList
                        data={list} 
                        keyExtractor={(item, index) => 'dropdown' + index} 
                        renderItem={({item, index}) => (
                        <FormItem type="list">
                            {/* <Animated.View entering={ZoomInUp}> */}
                                <TouchableOpacity style={getItemStyle(item.value)} onPress={() => handleChange(item.value)}>
                                    <StyledText type="body">{item.label}</StyledText>
                                </TouchableOpacity>
                            {/* </Animated.View> */}
                        </FormItem>
                    )} />}
                </View>
                <ButtonClose type="cancel" style={styles.buttonClose} onPress={handleClose}/>
            </View>
        </Modal>
    </View>);
};

const styles = StyleSheet.create({
    root: {
        width: '100%',
        height: spacings.controlHeight,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRadius: borders.borderRadius,
        borderWidth: borders.borderWidth,
        borderStyle: 'solid',
        backgroundColor: colors.controlBaseBg,
        paddingHorizontal: spacings.margin,
    },
    title: {
        ...fonts.placeholder,
        color: colors.controlBasePlaceholder,
    },
    value: {
        ...fonts.textBox, 
        color: colors.controlBaseText,
    },
    modal: {
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: colors.bgForm,
        paddingHorizontal: spacings.padding,
    },
    modalContainer: {
        width: '100%',
        height: '70%',
    },
    item: {
        backgroundColor: colors.bgForm,
        padding: spacings.padding,
        borderRadius: borders.borderRadius,
        borderColor: colors.accentLightForm,
    },
    itemSelected: {
        backgroundColor: colors.accentLightForm,
        borderRadius: borders.borderRadius,
    },
    icon: {
        width: 24,
        height: 24,
    },
    buttonClose: {
        top: spacings.margin,
        right: spacings.margin
    }
});
