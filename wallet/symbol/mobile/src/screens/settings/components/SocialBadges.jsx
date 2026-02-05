import { config } from '@/app/config';
import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { Sizes } from '@/app/styles';
import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';

const imageMap = {
	discord: require('@/app/assets/images/social/discord.png'),
	github: require('@/app/assets/images/social/github.png'),
	twitter: require('@/app/assets/images/social/twitter.png')
};

/**
 * Social badge component
 * 
 * @param {object} props - Component props
 * @param {any} props.image - Badge image name.
 * @param {string} props.linkUrl - URL to open on press.
 * 
 * @returns {React.ReactNode} Social badge component
 */
const SocialBadge = ({ image, linkUrl }) => {
	const imageSrc = imageMap[image];
	const handlePress = () => PlatformUtils.openLink(linkUrl);

	return (
		<TouchableOpacity 
			style={styles.badge}
			accessibilityRole="link"
			accessibilityLabel={`Link to ${image}`}
			onPress={handlePress}
		>
			<Image style={styles.image} source={imageSrc} />
		</TouchableOpacity>
	);
};

/**
 * Social badges list component
 * 
 * @returns {React.ReactNode} Social badges component
 */
export const SocialBadges = () => {
	const badges = [
		{
			image: 'discord',
			linkUrl: config.discordURL
		},
		{
			image: 'github',
			linkUrl: config.githubURL
		},
		{
			image: 'twitter',
			linkUrl: config.twitterURL
		}
	];

	return (
		<View style={styles.root}>
			{badges.map(badge => (
				<SocialBadge
					key={badge.image}
					image={badge.image}
					linkUrl={badge.linkUrl}
				/>
			))}
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		width: '100%',
		justifyContent: 'space-between',
		flexDirection: 'row'
	},
	badge: {
		width: Sizes.Semantic.spacing.m * 16,
		height: Sizes.Semantic.spacing.m * 16
	},
	image: {
		height: '100%',
		width: '100%',
		resizeMode: 'contain'
	}
});
