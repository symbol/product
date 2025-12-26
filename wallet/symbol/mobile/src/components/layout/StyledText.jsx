import { Colors, Sizes, Typography } from '@/app/styles';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

/**
 * @typedef {'title'|'label'|'body'} TextType
 */

/**
 * @typedef {'s'|'m'|'l'} TextSize
 */

/**
 * StyledText component
 *
 * @param {object} props - Component props
 * @param {string|React.ReactNode} props.children - Text content to render.
 * @param {object} [props.style] - Additional styles for the text element.
 * @param {TextType} [props.type='body'] - Text type defining typography styles.
 * @param {boolean} [props.bold=false] - Whether to render the text in bold.
 * @param {TextSize} [props.size='m'] - Text size.
 */
export const StyledText = ({ children, style, type = 'body', bold = false, size = 'm', variant }) => {
	const normalizedType = ['title', 'label', 'body'].includes(type) ? type : 'body';
	const normalizedSize = ['s', 'm', 'l'].includes(size) ? size : 'm';
	const colorVariant = variant ?? 'primary';

	const typeMap = {
		title: {
			s: styles.titleS,
			m: styles.titleM,
			l: styles.titleL
		},
		label: {
			s: styles.labelS,
			m: styles.labelM,
			l: styles.labelL
		},
		body: {
			s: styles.bodyS,
			m: styles.bodyM,
			l: styles.bodyL
		}
	};
	const boldMap = {
		s: styles.bodyBoldS,
		m: styles.bodyBoldM,
		l: styles.bodyBoldL
	};

	const baseStyle = typeMap[normalizedType]?.[normalizedSize] ?? styles.bodyM;
	const weightStyle = normalizedType === 'body' && bold ? boldMap[normalizedSize] : baseStyle;

	const textColor =
		Colors.Semantic.content?.[colorVariant]?.default ?? Colors.Semantic.content.primary.default;

	return (
		<Text style={[styles.base, weightStyle, { color: textColor }, style]}>
			{children}
		</Text>
	);
};

const styles = StyleSheet.create({
	base: {
		color: Colors.Semantic.content.primary.default,
		margin: Sizes.Semantic.spacing.none
	},
	titleS: {
		...Typography.Semantic.title.s
	},
	titleM: {
		...Typography.Semantic.title.m
	},
	titleL: {
		...Typography.Semantic.title.l
	},
	labelS: {
		...Typography.Semantic.label.s
	},
	labelM: {
		...Typography.Semantic.label.m
	},
	bodyS: {
		...Typography.Semantic.body.s
	},
	bodyM: {
		...Typography.Semantic.body.m
	},
	bodyL: {
		...Typography.Semantic.body.l
	},
	bodyBoldS: {
		...Typography.Semantic.bodyBold.s
	},
	bodyBoldM: {
		...Typography.Semantic.bodyBold.m
	},
	bodyBoldL: {
		...Typography.Semantic.bodyBold.l
	}
});
