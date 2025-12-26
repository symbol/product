import { Colors, Sizes, Typography } from '@/app/styles';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

export const WalletCreationAnimation = props => {
	const { steps, currentStep } = props;
	const [timer, setTimer] = useState(null);
	const [index, setIndex] = useState(0);

	const currentStepText = steps[currentStep - 1];
	const currentLine = currentStepText.slice(0, index);
	const typedLines = steps.slice(0, currentStep - 1);

	useEffect(() => {
		const textLength = currentStepText.length;
		const duration = 10;
		setIndex(0);
		clearInterval(timer);

		const newTimer = setInterval(() => {
			setIndex(index => (index < textLength ? index + 1 : index));
		}, duration);
		setTimer(newTimer);
	}, [currentStep]);

	return (
		<View style={styles.root}>
			<Image source={require('@/app/assets/images/art/symbol-ascii.png')} style={styles.logo} />
			<View style={styles.terminal}>
				{typedLines.map((line, index) => (
					<Text style={styles.line} key={'la' + index}>
						<Text style={styles.titleText}>Symbol Wallet: </Text>
						<Text style={styles.loadingText}>{line}</Text>
					</Text>
				))}
				<Text style={styles.line}>
					<Text style={styles.titleText}>Symbol Wallet: </Text>
					<Text style={styles.loadingText}>{currentLine}</Text>
				</Text>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		width: '100%',
		flex: 1,
		flexDirection: 'column',
		justifyContent: 'space-around',
		alignItems: 'center',
		backgroundColor: Colors.Semantic.background.tertiary.darker,
		padding: Sizes.Semantic.layoutPadding.m
	},
	logo: {
		width: '100%',
		margin: 'auto',
		resizeMode: 'contain'
	},
	terminal: {
		width: '100%',
		height: '30%'
	},
	line: {
		width: '100%'
	},
	titleText: {
		...Typography.Semantic.label.m,
		color: Colors.Semantic.role.secondary.default
	},
	loadingText: {
		...Typography.Semantic.label.m,
		color: Colors.Components.main.text
	}
});
