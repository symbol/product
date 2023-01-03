import React from 'react';
import { Image, Linking, StyleSheet, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { TableView, Screen, FormItem, StyledText } from 'src/components';
import { config } from 'src/config';
import { $t } from 'src/localization';
import packageJSON from '../../package.json';

export function SettingsAbout() {
    const tableData = {
        appVersion: packageJSON.version,
        symbolSdkVersion: packageJSON.dependencies['symbol-sdk'],
        reactNativeVersion: packageJSON.dependencies['react-native'],
    };

    const onDiscordPress = () => Linking.openURL(config.discordURL);
    const onGithubPress = () => Linking.openURL(config.githubURL);
    const onTwitterPress = () => Linking.openURL(config.twitterURL);

    return (
        <Screen>
            <FormItem>
                <StyledText type="title">
                    {$t('settings_about_version_title')}
                </StyledText>
                <TableView data={tableData} />
            </FormItem>
            <FormItem>
                <StyledText type="title">
                    {$t('settings_about_symbol_title')}
                </StyledText>
                <StyledText type="body">
                    {$t('settings_about_symbol_body')}
                </StyledText>
            </FormItem>
            <FormItem>
                <View style={styles.badges}>
                    <TouchableOpacity style={styles.badge} containerStyle={styles.badge} onPress={onDiscordPress}>
                        <Image style={styles.image} source={require('src/assets/images/badge-discord.png')} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.badge} containerStyle={styles.badge} onPress={onGithubPress}>
                        <Image style={styles.image} containerStyle={styles.badge} source={require('src/assets/images/badge-github.png')} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.badge} containerStyle={styles.badge} onPress={onTwitterPress}>
                        <Image style={styles.image} source={require('src/assets/images/badge-twitter.png')} />
                    </TouchableOpacity>
                </View>
            </FormItem>
        </Screen>
    );
};

const styles = StyleSheet.create({
    badges: {
        width: '100%',
        height: 200,
        flexDirection: 'row',
    },
    badge: {
        position: 'relative',
        flex: 1,
        width: '100%',
        height: 100
    },
    image: {
        height: '100%',
        width: '100%',
        resizeMode: 'contain'
    },
});
