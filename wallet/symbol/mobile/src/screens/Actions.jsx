import { Router } from '@/app/Router';
import { FormItem, Screen, StyledText, TabNavigator, TitleBar } from '@/app/components';
import { useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import { borders, colors } from '@/app/styles';
import { spacings } from '@/app/styles';
import React from 'react';
import { ImageBackground, StyleSheet, View, FlatList, TouchableOpacity, Dimensions } from 'react-native';

export const Actions = () => {
    const WalletController = useWalletController();
    const { currentAccount, isWalletReady } = WalletController;

    const list = [
        {
            title: $t('s_actions_addressBook_title'),
            description: $t('s_actions_addressBook_description'),
            icon: require('@/app/assets/images/art-address-book.png'),
            handler: Router.goToAddressBookList
        },
        {
            title: $t('s_actions_harvesting_title'),
            description: $t('s_actions_harvesting_description'),
            icon: require('@/app/assets/images/art-harvesting.png'),
            handler: Router.goToHarvesting
        },
        {
            title: $t('s_actions_send_title'),
            description: $t('s_actions_send_description'),
            icon: require('@/app/assets/images/art-ship.png'),
            handler: Router.goToSend
        },
        {
            title: $t('s_actions_bridge_title'),
            description: $t('s_actions_bridge_description'),
            icon: require('@/app/assets/images/art-bridge.png'),
            handler: Router.goToBridgeAccountList
        }
    ];

    const renderCard = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardImageContainer}>
                <ImageBackground
                    source={item.icon}
                    style={styles.cardImage}
                    imageStyle={styles.cardImageInner}
                />
            </View>
            <View style={styles.cardContent}>
                <StyledText type="subtitle" style={styles.cardTitle}>
                    {item.title}
                </StyledText>
                <StyledText type="body" style={styles.cardDescription}>
                    {item.description}
                </StyledText>
            </View>
        </View>
    );

    return (
        <Screen
            style={{ height: 400 }}
            titleBar={<TitleBar accountSelector settings currentAccount={currentAccount} />}
            navigator={<TabNavigator />}
            isLoading={!isWalletReady}
        >
            <FlatList
                data={list}
                renderItem={({ item, index }) => (
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => item.handler()}
                        style={styles.cardWrapper}
                        key={'act' + index}
                    >
                        {renderCard({ item })}
                    </TouchableOpacity>
                )}
                keyExtractor={(_, idx) => 'act' + idx}
                numColumns={2}
                columnWrapperStyle={styles.row}
                style={styles.list}
                contentContainerStyle={styles.listContent}
            />
        </Screen>
    );
};

const CARD_GAP = spacings.margin;
const CARD_PADDING = spacings.margin;
const windowWidth = Dimensions.get('window').width;
const totalHorizontalPadding = CARD_PADDING * 2;
const totalGap = CARD_GAP;
const cardWidth = (windowWidth - totalHorizontalPadding - totalGap) / 2;
const CARD_HEIGHT = 250;

const styles = StyleSheet.create({
    list: {
        width: '100%',
        height: '100%',
    },
    listContent: {
        paddingHorizontal: spacings.margin,
        paddingVertical: spacings.margin,
    },
    row: {
        flex: 1,
        justifyContent: 'space-between',
        gap: spacings.margin,
        marginBottom: spacings.margin,
    },
    cardWrapper: {
        width: cardWidth,
    },
    card: {
        width: '100%',
        height: CARD_HEIGHT,
        backgroundColor: '#000',
        borderColor: '#000',
        borderRadius: borders.borderRadiusForm,
        overflow: 'hidden',
        position: 'relative', // Enable absolute positioning for children
        justifyContent: 'flex-end',
    },
    cardImageContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '60%',
        zIndex: 1,
    },
    cardImage: {
        width: '100%',
        height: '100%',
        justifyContent: 'flex-end',
    },
    cardImageInner: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    cardContent: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        height: '50%',
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 2,
        padding: spacings.paddingSm + borders.borderWidth,
    },
    cardTitle: {
        marginBottom: spacings.margin / 4,
        textAlign: 'center',
        color: '#fff',
    },
    cardDescription: {
        textAlign: 'center',
        color: '#ccc',
    },
    item: {
        padding: 0,
        minHeight: 100,
        position: 'relative'
    },
    itemIcon: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 100,
        height: 100,
        resizeMode: 'contain'
    },
    itemTextContainer: {
        marginLeft: 100,
        padding: spacings.margin
    },
    itemTitle: {
        marginBottom: spacings.margin / 2
    }
});
