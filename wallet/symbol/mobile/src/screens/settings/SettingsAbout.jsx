import { SocialBadges } from './components/SocialBadges';
import packageJSON from '../../../package.json';
import { Card, Screen, Spacer, Stack, StyledText, TableView } from '@/app/components';
import { $t } from '@/app/localization';
import React from 'react';

/**
 * SettingsAbout screen component. A screen displaying application version information, dependency
 * versions, and details about the protocol along with social media links.
 */
export const SettingsAbout = () => {
	const aboutTable = [
		{
			title: 'appVersion',
			value: packageJSON.version,
			type: 'text'
		},
		{
			title: 'symbolSdkVersion',
			value: packageJSON.dependencies['symbol-sdk'],
			type: 'text'
		},
		{
			title: 'reactNativeVersion',
			value: packageJSON.dependencies['react-native'],
			type: 'text'
		}
	];

	return (
		<Screen>
			<Spacer>
				<Stack>
					<StyledText type="title">{$t('settings_about_version_title')}</StyledText>
					<Card>
						<Spacer>
							<TableView data={aboutTable} isTitleTranslatable />
						</Spacer>
					</Card>
					<StyledText type="title">{$t('settings_about_symbol_title')}</StyledText>
					<StyledText type="body">{$t('settings_about_symbol_body')}</StyledText>
					<SocialBadges />
				</Stack>
			</Spacer>
		</Screen>
	);
};
