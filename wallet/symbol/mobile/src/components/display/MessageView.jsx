import { Icon, StyledText } from '@/app/components';
import { MessageType } from '@/app/constants';
import { Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const ICON_SIZE = 'm';

const iconMap = {
	encrypted: 'message-encrypted',
	raw: 'file-code'
};

/**
 * MessageView component. A display component for transaction messages, showing appropriate icons
 * for encrypted or raw message types and displaying human-readable text when available.
 *
 * @param {object} props - Component props.
 * @param {object} props.message - Message object containing type and content information.
 * @param {number} props.message.type - The type of message. 0 - plain text, 1 - encrypted, rest - raw data.
 * @param {string} [props.message.text] - Optional human-readable text. content of the message.
 * @param {string} props.message.payload - Raw payload data.
 *
 * @returns {React.ReactNode} MessageView component.
 */
export const MessageView = ({ message }) => {
	let iconName;

	if (message.type === MessageType.ENCRYPTED_TEXT)
		iconName = iconMap.encrypted;
	else if (message.type !== MessageType.PLAIN_TEXT)
		iconName = iconMap.raw;

	const isTextVisible = Boolean(message.text);
	const isIconVisible = Boolean(iconName);

	return (
		<View style={styles.root}>
			{isIconVisible && (
				<Icon name={iconName} size={ICON_SIZE} />
			)}
			{isTextVisible && (
				<StyledText>{message.text}</StyledText>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		flexDirection: 'row',
		gap: Sizes.Semantic.spacing.s
	}
});
