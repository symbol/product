import { StyledText, TextBox, TouchableNative } from '@/app/components';
import { useValidation } from '@/app/hooks';
import { Bip39 } from '@/app/lib/bip39';
import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { $t } from '@/app/localization';
import { Colors, Sizes, Typography } from '@/app/styles';
import { validateMnemonic, validateRequired } from '@/app/utils';
import _ from 'lodash';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';

const { WORDLIST } = Bip39;
const MAX_SUGGESTIONS_COUNT = 20;

/**
 * MnemonicInput component for entering and validating BIP39 mnemonic phrases.
 * Provides autocomplete suggestions from the BIP39 English wordlist.
 *
 * @param {object} props - Component props
 * @param {string} props.value - Current mnemonic input value.
 * @param {string} [props.label] - Label for the input field.
 * @param {function} props.onChange - Callback when input value changes.
 * @param {function} props.onValidityChange - Callback when validity state changes.
 * 
 * @returns {React.ReactElement} Rendered MnemonicInput component
 */
export const MnemonicInput = ({ value, label, onChange, onValidityChange }) => {
	const textBoxRef = useRef();
	const [suggestions, setSuggestions] = useState([]);

	// Validation
	const errorMessage = useValidation(value, [validateRequired(), validateMnemonic()], $t);

	useEffect(() => {
		onValidityChange(!errorMessage);
	}, [value, errorMessage]);

	// Suggestions
	const updateSuggestions = () => {
		const lastWord = value.split(' ').pop();
		const matchedSuggestions = _.filter(WORDLIST, word => word.startsWith(lastWord));
		const shouldShowSuggestions = matchedSuggestions.length < MAX_SUGGESTIONS_COUNT;

		setSuggestions(shouldShowSuggestions ? matchedSuggestions : []);
	};

	useEffect(() => {
		updateSuggestions();
	}, [value]);

	// Handlers
	const handleSuggestionPress = word => {
		const lastSpaceIndex = value.lastIndexOf(' ');
		const stringWithoutLastWord = value.substring(0, lastSpaceIndex);

		handleChange(`${stringWithoutLastWord} ${word} `);
		textBoxRef.current.focus();
	};
	const handleChange = str => {
		const formattedString = str
			.replace(/(\r\n|\n|\r)/gm, ' ')
			.replace(/\s+/g, ' ')
			.toLowerCase();

		onChange(formattedString);
	};

	/**
	 * Renders a single suggestion item.
	 * @param {object} param0 - Render item params.
	 * @param {string} param0.item - Suggestion word.
	 */
	const renderSuggestionItem = ({ item }) => (
		<View style={styles.suggestionButton}>
			<TouchableNative
				containerStyle={styles.suggestionButtonInner}
				color={Colors.Components.chip.active.background}
				onPress={() => handleSuggestionPress(item)}
			>
				<StyledText type="label" style={styles.suggestionText}>
					{item}
				</StyledText>
			</TouchableNative>
		</View>
	);

	return (
		<View style={styles.root}>
			<TextBox
				multiline
				label={label}
				innerRef={textBoxRef}
				errorMessage={errorMessage}
				value={value}
				keyboardType={PlatformUtils.getOS() === 'ios' ? null : 'visible-password'}
				onChange={handleChange}
			/>
			<View style={styles.suggestionsContainer}>
				<FlatList
					horizontal
					showsHorizontalScrollIndicator={false}
					style={styles.suggestionsList}
					contentContainerStyle={styles.suggestionsContent}
					data={suggestions}
					keyExtractor={(_, index) => `suggestion-${index}`}
					renderItem={renderSuggestionItem}
				/>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		position: 'relative'
	},
	suggestionsContainer: {
		position: 'absolute',
		bottom: 0,
		width: '100%',
		paddingHorizontal: Sizes.Semantic.borderWidth.m
	},
	suggestionsList: {
		width: '100%',
		height: Sizes.Semantic.spacing.m + Sizes.Semantic.spacing.m + Typography.Semantic.label.s.lineHeight
	},
	suggestionsContent: {
		paddingVertical: Sizes.Semantic.spacing.s,
		paddingLeft: Sizes.Semantic.spacing.m
	},
	suggestionButton: {
		marginRight: Sizes.Semantic.spacing.m,
		overflow: 'hidden',
		borderRadius: Sizes.Semantic.borderRadius.l,
		backgroundColor: Colors.Components.chip.active.background
	},
	suggestionButtonInner: {
		paddingHorizontal: Sizes.Semantic.spacing.m,
		paddingVertical: Sizes.Semantic.spacing.s,
		justifyContent: 'center',
		alignItems: 'center',
		height: '100%'
	},
	suggestionText: {
		...Typography.Semantic.label.s,
		color: Colors.Components.chip.active.text
	}
});
