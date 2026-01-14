import { Grid, LoadingIndicator } from '@/app/components';
import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { Colors } from '@/app/styles';
import React from 'react';
import { Image, KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';

/**
 * Screen layout component
 * 
 * @param {object} props - Component props
 * @param {boolean} props.isScrollDisabled - Disable scrolling if true
 * @param {boolean} props.isLoading - Show loading indicator if true
 * @param {boolean} props.hasGrid - Show grid overlay if true (development only)
 * @param {string} props.backgroundImageSrc - Background image source
 * @param {function} props.renderLoading - Custom render function for loading indicator
 * @param {React.ReactNode} props.children - Child components
 * 
 * @returns {React.ReactNode} Screen layout component
 */
export const Screen = ({ isScrollDisabled, isLoading, hasGrid, backgroundImageSrc, renderLoading, children }) => {
	const ContentContainer = isScrollDisabled ? View : ScrollView;
	const isKeyboardAvoidingViewEnabled = PlatformUtils.getOS() === 'ios' ? true : false;

	// Separate upper and bottom content if defined
	let upper = null;
	let bottom = null;
	if (React.Children.count(children) === 2) {
		React.Children.forEach(children, child => {
			if (!child)
				return;

			if (child.type === Screen.Upper)
				upper = child.props.children;

			if (child.type === Screen.Bottom)
				bottom = child.props.children;
		});
	}

	return (
		<View style={styles.root}>
			{!!backgroundImageSrc && (
				<Image source={backgroundImageSrc} style={styles.backgroundImage} />
			)}
			<Grid isVisible={__DEV__ && hasGrid} />
			<KeyboardAvoidingView style={styles.contentContainer} enabled={isKeyboardAvoidingViewEnabled} behavior="padding">
				<ContentContainer style={styles.contentContainer}>
					{upper ? upper : children}
				</ContentContainer>
				{bottom && (
					<View>
						{bottom}
					</View>
				)}
			</KeyboardAvoidingView>
			{isLoading && (
				<View style={styles.loadingIndicatorContainer}>
					{renderLoading ? (
						renderLoading()
					) : (
						<LoadingIndicator />			 
					)}
				</View>
			)}
		</View >
	);
};

Screen.Upper = props => { return props.children; };
Screen.Bottom = props => { return props.children; };

const styles = StyleSheet.create({
	root: {
		position: 'relative',
		height: '100%',
		flex: 1,
		flexDirection: 'column',
		justifyContent: 'space-between',
		backgroundColor: Colors.Components.main.background
	},
	contentContainer: {
		flex: 1
	},
	upperContainer: {
		flex: 1
	},
	loadingIndicatorContainer: {
		position: 'absolute',
		top: 0,
		left: 0,
		width: '100%',
		height: '100%',
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: Colors.Components.main.background,
		zIndex: 9999
	},
	backgroundImage: {
		position: 'absolute',
		top: 0,
		left: 0,
		width: '100%',
		height: '100%',
		resizeMode: 'cover'
	}
});
