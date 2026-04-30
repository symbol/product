import { Colors, Sizes, Typography } from '@/app/styles';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

/** @typedef {import('@/app/types/ColorVariants').ContentColorVariants} ContentColorVariants */

/**
 * Typography type variant controlling the text style family.
 * @typedef {'title'|'label'|'body'} TextType
 */

/**
 * Text size variant controlling the scale of rendered text.
 * @typedef {'s'|'m'|'l'} TextSize
 */

/**
 * StyledText component. A text component supporting various typography types, sizes, color variants,
 * bold styling, and inverse color schemes.
 * @param {object} props - Component props.
 * @param {string|React.ReactNode} props.children - Text content to render.
 * @param {object} [props.style] - Additional styles for the text element.
 * @param {TextType} [props.type='body'] - Text type defining typography styles.
 * @param {boolean} [props.bold=false] - Whether to render the text in bold.
 * @param {TextSize} [props.size='m'] - Text size.
 * @param {ContentColorVariants} [props.variant] - Color variant for the text.
 * @param {boolean} [props.inverse=false] - Whether to use inverse color scheme.
 * @returns {React.ReactNode} StyledText component.
 */
export const StyledText = ({ children, style, type = 'body', bold = false, size = 'm', variant = 'primary', inverse = false }) => {
	const normalizedType = ['title', 'label', 'body'].includes(type) ? type : 'body';
	const normalizedSize = ['s', 'm', 'l', 'xl'].includes(size) ? size : 'm';

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
			l: styles.bodyL,
			xl: styles.bodyXL
		}
	};
	const boldMap = {
		s: styles.bodyBoldS,
		m: styles.bodyBoldM,
		l: styles.bodyBoldL,
		xl: styles.bodyBoldL
	};

	const baseStyle = typeMap[normalizedType]?.[normalizedSize] ?? styles.bodyM;
	const weightStyle = normalizedType === 'body' && bold ? boldMap[normalizedSize] : baseStyle;

	const variantKey = inverse ? 'inverse' : 'default';
	const textColor = Colors.Semantic.content[variant][variantKey];

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
	bodyXL: {
		...Typography.Semantic.body.xl
	},
	bodyBoldS: {
		...Typography.Semantic.bodyBold.s
	},
	bodyBoldM: {
		...Typography.Semantic.bodyBold.m
	},
	bodyBoldL: {
		...Typography.Semantic.bodyBold.l
	},
	bodyBoldXL: {
		...Typography.Semantic.bodyBold.xl
	}
});
