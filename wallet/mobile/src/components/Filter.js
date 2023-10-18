import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { $t } from 'src/localization';
import { borders, colors, fonts, layout, spacings } from 'src/styles';
import { DropdownModal } from './Dropdown';
import { InputAddressDropdown } from './InputAddress';
import { StyledText } from './StyledText';
import { TouchableNative } from './TouchableNative';

export const Filter = (props) => {
    const { data, value, isDisabled, onChange } = props;
    const [expandedFilter, setExpandedFilter] = useState({});

    const isFilerActive = (name) => !!value[name];
    const isFilterAvailable = (name) => (Object.keys(value).length === 0 || value.hasOwnProperty(name)) && !isDisabled;
    const getButtonStyle = (name) => [
        styles.button,
        isFilerActive(name) ? styles.buttonActive : null,
        !isFilterAvailable(name) ? styles.buttonDisabled : null,
    ];
    const getTextStyle = (name) => [styles.text, isFilerActive(name) ? styles.textActive : null];
    const clear = () => onChange({});
    const handleFilterPress = (filter) => {
        if (!isFilterAvailable(filter.name)) {
            return;
        }

        if (filter.type === 'boolean') {
            changeFilterValue(filter, !value[filter.name]);
        } else {
            setExpandedFilter(filter);
        }
    };
    const changeFilterValue = (filter, filterValue) => {
        const currentFilterValues = { ...value };

        if (filterValue) {
            currentFilterValues[filter.name] = filterValue;
        } else {
            delete currentFilterValues[filter.name];
        }

        onChange(currentFilterValues);
    };

    return (
        <View>
            <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.root}
                contentContainerStyle={styles.list}
                data={data}
                keyExtractor={(_, index) => 'filter' + index}
                renderItem={({ item }) => (
                    <View style={getButtonStyle(item.name)}>
                        <TouchableNative
                            containerStyle={styles.buttonInner}
                            color={colors.bgCard}
                            disabled={isDisabled}
                            onPress={() => handleFilterPress(item, true)}
                        >
                            <StyledText type="label" style={getTextStyle(item.name)}>
                                {item.title}
                            </StyledText>
                        </TouchableNative>
                    </View>
                )}
                ListHeaderComponent={
                    <View style={styles.button}>
                        <TouchableNative containerStyle={styles.buttonInner} color={colors.bgCard} disabled={isDisabled} onPress={clear}>
                            <View style={[layout.row, layout.alignCenter]}>
                                <Image source={require('src/assets/images/icon-chip-clear.png')} style={styles.icon} />
                                <StyledText type="label" style={styles.text}>
                                    {$t('button_clear')}
                                </StyledText>
                            </View>
                        </TouchableNative>
                    </View>
                }
            />
            {expandedFilter?.type === 'select' && (
                <DropdownModal
                    isOpen
                    title={expandedFilter.title}
                    list={expandedFilter.options}
                    value={value[expandedFilter.name]}
                    onChange={(value) => changeFilterValue(expandedFilter, value)}
                    onClose={() => setExpandedFilter(null)}
                />
            )}
            {expandedFilter?.type === 'address' && (
                <InputAddressDropdown
                    isOpen
                    title={expandedFilter.title}
                    value={value[expandedFilter.name]}
                    onChange={(value) => changeFilterValue(expandedFilter, value)}
                    onClose={() => setExpandedFilter(null)}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        width: '100%',
        height: spacings.margin + spacings.margin + fonts.label.lineHeight,
    },
    list: {
        paddingVertical: spacings.margin / 2,
        paddingLeft: spacings.margin,
    },
    button: {
        marginRight: spacings.margin,
        overflow: 'hidden',
        borderRadius: borders.borderRadiusForm,
        backgroundColor: colors.bgMain,
        borderColor: colors.bgCard,
    },
    buttonActive: {
        backgroundColor: colors.primary,
    },
    buttonDisabled: {
        opacity: 0.3,
    },
    buttonInner: {
        paddingHorizontal: spacings.margin,
        paddingVertical: spacings.margin / 2,
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
    },
    text: {
        ...fonts.filterChip,
        color: colors.primary,
    },
    textActive: {
        color: colors.bgForm,
    },
    icon: {
        height: 13,
        width: 13,
        marginRight: spacings.margin / 4,
    },
});
