import { Sizes } from '@/app/styles';
import { iconSourceMap } from '@/brand/assets/images/icons/icon-source-map';
import { iconConfig } from '@/brand/config/icon-config';
import { Image } from 'react-native';

/** @typedef {import('react')} React */
/** @typedef {import('@/app/types/ColorVariants').IconColorVariants} IconColorVariants */

const sizeMap = Sizes.Semantic.iconSize;

/** Icon names for each color variant */
const iconNames = {
	default: [
		'account-add',
		'harvesting',
		'account-multisig',
		'hide',
		'account-remove',
		'history',
		'account',
		'info-circle',
		'address-book',
		'key',
		'alert-danger',
		'message-encrypted',
		'alert-warning',
		'nem',
		'arrow-left',
		'open',
		'arrow-right',
		'pending',
		'backspace',
		'puzzle',
		'block-explorer',
		'question-circle',
		'check-circle-big',
		'receive',
		'check-circle',
		'revoke',
		'check',
		'send-plane',
		'chevron-down',
		'send-wallet',
		'chevron-up',
		'chevron-right',
		'chevron-left',
		'show',
		'copy',
		'sign',
		'cross-circle',
		'symbol',
		'cross',
		'token-custom',
		'delete',
		'token-ethereum',
		'detach',
		'token-nem',
		'edit',
		'token-symbol',
		'ethereum',
		'plus',
		'minus',
		'file-code',
		'settings',
		'swap',
		'lock',
		'namespace',
		'message'
	],
	secondary: [
		'account-add',
		'harvesting',
		'account-multisig',
		'hide',
		'account-remove',
		'history',
		'account',
		'info-circle',
		'address-book',
		'key',
		'alert-danger',
		'message-encrypted',
		'alert-warning',
		'nem',
		'arrow-left',
		'open',
		'arrow-right',
		'pending',
		'backspace',
		'puzzle',
		'block-explorer',
		'question-circle',
		'check-circle-big',
		'receive',
		'check-circle',
		'revoke',
		'check',
		'send-plane',
		'chevron-down',
		'send-wallet',
		'chevron-up',
		'show',
		'copy',
		'sign',
		'cross-circle',
		'symbol',
		'cross',
		'token-custom',
		'delete',
		'token-ethereum',
		'detach',
		'token-nem',
		'edit',
		'token-symbol',
		'ethereum',
		'plus',
		'minus',
		'faucet'
	],
	inverse: [
		'account-add',
		'harvesting',
		'account-multisig',
		'hide',
		'account-remove',
		'history',
		'account',
		'info-circle',
		'address-book',
		'key',
		'alert-danger',
		'message-encrypted',
		'alert-warning',
		'nem',
		'arrow-left',
		'open',
		'arrow-right',
		'pending',
		'backspace',
		'puzzle',
		'block-explorer',
		'question-circle',
		'check-circle-big',
		'receive',
		'check-circle',
		'revoke',
		'check',
		'send-plane',
		'chevron-down',
		'send-wallet',
		'chevron-up',
		'show',
		'copy',
		'sign',
		'cross-circle',
		'symbol',
		'cross',
		'token-custom',
		'delete',
		'token-ethereum',
		'detach',
		'token-nem',
		'edit',
		'token-symbol',
		'ethereum',
		'plus',
		'minus',
		'swap',
		'lock'
	],
	danger: [
		'alert-danger'
	],
	warning: [
		'alert-warning',
		'pending',
		'send-plane',
		'lock'
	],
	success: [
		'check-circle',
		'check-circle-big'
	],
	info: [
		'sign',
		'info-circle'
	],
	neutral: [
		'info-circle',
		'cross-circle',
		'question-circle'
	]
};

// Image sources extracted from the brand icon configuration.
const sourceMap = Object.fromEntries(Object.entries(iconNames).map(([variant, names]) => {
	const sources = iconSourceMap[iconConfig.variants[variant]];

	return [variant, Object.fromEntries(names.map(name => [name, sources[name]]))];
}));

/**
 * Icon component. A component for displaying icons with configurable sizes and color variants.
 * @param {object} props - Component props.
 * @param {string} props.name - Icon name.
 * @param {'xxs' | 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl'} [props.size='m'] - Icon size.
 * @param {IconColorVariants} [props.variant='default']
 *   - Icon color variant.
 * @param {object} [props.src] - Optional source for a custom icon image.
 * @param {object} [props.style] - Optional additional styles.
 * @returns {React.ReactNode} Icon component.
 */
export const Icon = ({ name, size = 'm', variant = 'default', src, style: customStyle }) => {
	const iconSize = sizeMap[size];
	const iconSource = src ?? sourceMap[variant]?.[name];

	if (!iconSource && __DEV__)
		throw new Error(`Icon: Icon source not found for name "${name}" and color variant "${variant}".`);

	const mainStyle = {
		width: iconSize,
		height: iconSize,
		resizeMode: 'contain'
	};
	const fallbackIconSource = sourceMap.default['question-circle'];

	return (
		<Image
			source={iconSource ?? fallbackIconSource}
			style={[mainStyle, customStyle]}
			accessibilityLabel={`${name} icon`}
			testID={`icon-${name}`}
		/>
	);
};
