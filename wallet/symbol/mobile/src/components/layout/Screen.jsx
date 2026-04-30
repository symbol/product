import { LoadingIndicator } from '@/app/components';
import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { Colors } from '@/app/styles';
import React from 'react';
import { Image, KeyboardAvoidingView, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

/**
 * Screen component. A layout component for screen content with support for scrolling, loading
 * indicators, background images, and pull-to-refresh functionality.
 * @param {object} props - Component props.
 * @param {boolean} props.isScrollDisabled - Disable scrolling if true.
 * @param {boolean} props.isLoading - Show loading indicator if true.
 * @param {string} props.backgroundImageSrc - Background image source.
 * @param {function(): React.ReactNode} props.renderLoading - Custom render function for loading indicator.
 * @param {import('@/app/types/RefreshConfig').RefreshConfig} [props.refresh] - Optional configuration for
 * pull-to-refresh. If not provided, pull-to-refresh is disabled.
 * @param {React.ReactNode} props.children - Child components.
 * @returns {React.ReactNode} Screen layout component.
 */
export const Screen = ({ isScrollDisabled, isLoading, backgroundImageSrc, renderLoading, refresh, children }) => {
	const ContentContainer = isScrollDisabled ? View : ScrollView;
	const isKeyboardAvoidingViewEnabled = PlatformUtils.getOS() === 'ios' ? true : false;
	const defaultRefreshColor = Colors.Components.loadingIndicator.surface;

	// Separate upper and bottom content if defined
	let header = null;
	let upper = null;
	let bottom = null;
	let modals = null;
	let background = null;
	React.Children.forEach(children, child => {
		if (!child)
			return;

		if (child.type === Screen.Header)
			header = child.props.children;

		if (child.type === Screen.Upper)
			upper = child.props.children;

		if (child.type === Screen.Bottom)
			bottom = child.props.children;

		if (child.type === Screen.Modals)
			modals = child.props.children;

		if (child.type === Screen.Background)
			background = child.props.children;
	});

	const isSectioned = Boolean(header || upper || bottom || modals || background);

	return (
		<View style={styles.root}>
			{!!backgroundImageSrc && (
				<Image source={backgroundImageSrc} style={styles.backgroundImage} />
			)}
			<KeyboardAvoidingView style={styles.contentContainer} enabled={isKeyboardAvoidingViewEnabled} behavior="padding">
				{background && (
					<View style={styles.backgroundContainer}>
						{background}
					</View>
				)}
				{header}
				<ContentContainer
					style={styles.contentContainer}
					refreshControl={refresh ? (
						<RefreshControl
							tintColor={refresh.color ?? defaultRefreshColor}
							refreshing={refresh.isRefreshing ?? false}
							onRefresh={refresh.onRefresh}
						/>
					) : null}
				>
					{isSectioned ? upper : children}
				</ContentContainer>
				{bottom && (
					<View>
						{bottom}
					</View>
				)}
				{modals && (
					<View>
						{modals}
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

Screen.Header = props => { return props.children; };
Screen.Upper = props => { return props.children; };
Screen.Bottom = props => { return props.children; };
Screen.Modals = props => { return props.children; };
Screen.Background = props => { return props.children; };

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
	},
	backgroundContainer: {
		position: 'absolute',
		top: 0,
		left: 0,
		width: '100%',
		height: '100%'
	}
});
