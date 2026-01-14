import { Sizes } from '@/app/styles';
import { Image } from 'react-native';

/** @typedef {import('react')} React */

const sizeMap = {
	xxs: Sizes.Primitives.spacing150, // 12px message type, boolean
	xs: 14, // button plain, widget header icon
	s: Sizes.Primitives.spacing200, // 16px - button copy, transaction send activity icon  
	// 18 - transaction graphic action, checkbox inner icon
	// 20 - close button icon close
	m: Sizes.Primitives.spacing300, // 24px -standard - tx type, navigation, transaction graphic target icon
	l: Sizes.Primitives.spacing400, // 32px - transaction send activity circle wrapper, settings items icons,
	// 36 - icon asset
	xl: Sizes.Primitives.spacing500, // 40px - token icon bridge
	xxl: Sizes.Primitives.spacing600 // 48px - transaction graphic target wrapper, avatar md
};

const sourceMap = {
	default: {
		'account-add': require('@/app/assets/images/icons/white/account-add.png'),
		'harvesting': require('@/app/assets/images/icons/white/harvesting.png'),
		'account-multisig': require('@/app/assets/images/icons/white/account-multisig.png'),
		'hide': require('@/app/assets/images/icons/white/hide.png'),
		'account-remove': require('@/app/assets/images/icons/white/account-remove.png'),
		'history': require('@/app/assets/images/icons/white/history.png'),
		'account': require('@/app/assets/images/icons/white/account.png'),
		'info-circle': require('@/app/assets/images/icons/white/info-circle.png'),
		'address-book': require('@/app/assets/images/icons/white/address-book.png'),
		'key': require('@/app/assets/images/icons/white/key.png'),
		'alert-danger': require('@/app/assets/images/icons/white/alert-danger.png'),
		'message-encrypted': require('@/app/assets/images/icons/white/message-encrypted.png'),
		'alert-warning': require('@/app/assets/images/icons/white/alert-warning.png'),
		'nem': require('@/app/assets/images/icons/white/nem.png'),
		'arrow-left': require('@/app/assets/images/icons/white/arrow-left.png'),
		'open': require('@/app/assets/images/icons/white/open.png'),
		'arrow-right': require('@/app/assets/images/icons/white/arrow-right.png'),
		'pending': require('@/app/assets/images/icons/white/pending.png'),
		'backspace': require('@/app/assets/images/icons/white/backspace.png'),
		'puzzle': require('@/app/assets/images/icons/white/puzzle.png'),
		'block-explorer': require('@/app/assets/images/icons/white/block-explorer.png'),
		'question-circle': require('@/app/assets/images/icons/white/question-circle.png'),
		'check-circle-big': require('@/app/assets/images/icons/white/check-circle-big.png'),
		'receive': require('@/app/assets/images/icons/white/receive.png'),
		'check-circle': require('@/app/assets/images/icons/white/check-circle.png'),
		'revoke': require('@/app/assets/images/icons/white/revoke.png'),
		'check': require('@/app/assets/images/icons/white/check.png'),
		'send-plane': require('@/app/assets/images/icons/white/send-plane.png'),
		'chevron-down': require('@/app/assets/images/icons/white/chevron-down.png'),
		'send-wallet': require('@/app/assets/images/icons/white/send-wallet.png'),
		'chevron-up': require('@/app/assets/images/icons/white/chevron-up.png'),
		'show': require('@/app/assets/images/icons/white/show.png'),
		'copy': require('@/app/assets/images/icons/white/copy.png'),
		'sign': require('@/app/assets/images/icons/white/sign.png'),
		'cross-circle': require('@/app/assets/images/icons/white/cross-circle.png'),
		'symbol': require('@/app/assets/images/icons/white/symbol.png'),
		'cross': require('@/app/assets/images/icons/white/cross.png'),
		'token-custom': require('@/app/assets/images/icons/white/token-custom.png'),
		'delete': require('@/app/assets/images/icons/white/delete.png'),
		'token-ethereum': require('@/app/assets/images/icons/white/token-ethereum.png'),
		'detach': require('@/app/assets/images/icons/white/detach.png'),
		'token-nem': require('@/app/assets/images/icons/white/token-nem.png'),
		'edit': require('@/app/assets/images/icons/white/edit.png'),
		'token-symbol': require('@/app/assets/images/icons/white/token-symbol.png'),
		'ethereum': require('@/app/assets/images/icons/white/ethereum.png')
	},
	primary: {
		'account-add': require('@/app/assets/images/icons/purple/account-add.png'),
		'harvesting': require('@/app/assets/images/icons/purple/harvesting.png'),
		'account-multisig': require('@/app/assets/images/icons/purple/account-multisig.png'),
		'hide': require('@/app/assets/images/icons/purple/hide.png'),
		'account-remove': require('@/app/assets/images/icons/purple/account-remove.png'),
		'history': require('@/app/assets/images/icons/purple/history.png'),
		'account': require('@/app/assets/images/icons/purple/account.png'),
		'info-circle': require('@/app/assets/images/icons/purple/info-circle.png'),
		'address-book': require('@/app/assets/images/icons/purple/address-book.png'),
		'key': require('@/app/assets/images/icons/purple/key.png'),
		'alert-danger': require('@/app/assets/images/icons/purple/alert-danger.png'),
		'message-encrypted': require('@/app/assets/images/icons/purple/message-encrypted.png'),
		'alert-warning': require('@/app/assets/images/icons/purple/alert-warning.png'),
		'nem': require('@/app/assets/images/icons/purple/nem.png'),
		'arrow-left': require('@/app/assets/images/icons/purple/arrow-left.png'),
		'open': require('@/app/assets/images/icons/purple/open.png'),
		'arrow-right': require('@/app/assets/images/icons/purple/arrow-right.png'),
		'pending': require('@/app/assets/images/icons/purple/pending.png'),
		'backspace': require('@/app/assets/images/icons/purple/backspace.png'),
		'puzzle': require('@/app/assets/images/icons/purple/puzzle.png'),
		'block-explorer': require('@/app/assets/images/icons/purple/block-explorer.png'),
		'question-circle': require('@/app/assets/images/icons/purple/question-circle.png'),
		'check-circle-big': require('@/app/assets/images/icons/purple/check-circle-big.png'),
		'receive': require('@/app/assets/images/icons/purple/receive.png'),
		'check-circle': require('@/app/assets/images/icons/purple/check-circle.png'),
		'revoke': require('@/app/assets/images/icons/purple/revoke.png'),
		'check': require('@/app/assets/images/icons/purple/check.png'),
		'send-plane': require('@/app/assets/images/icons/purple/send-plane.png'),
		'chevron-down': require('@/app/assets/images/icons/purple/chevron-down.png'),
		'send-wallet': require('@/app/assets/images/icons/purple/send-wallet.png'),
		'chevron-up': require('@/app/assets/images/icons/purple/chevron-up.png'),
		'show': require('@/app/assets/images/icons/purple/show.png'),
		'copy': require('@/app/assets/images/icons/purple/copy.png'),
		'sign': require('@/app/assets/images/icons/purple/sign.png'),
		'cross-circle': require('@/app/assets/images/icons/purple/cross-circle.png'),
		'symbol': require('@/app/assets/images/icons/purple/symbol.png'),
		'cross': require('@/app/assets/images/icons/purple/cross.png'),
		'token-custom': require('@/app/assets/images/icons/purple/token-custom.png'),
		'delete': require('@/app/assets/images/icons/purple/delete.png'),
		'token-ethereum': require('@/app/assets/images/icons/purple/token-ethereum.png'),
		'detach': require('@/app/assets/images/icons/purple/detach.png'),
		'token-nem': require('@/app/assets/images/icons/purple/token-nem.png'),
		'edit': require('@/app/assets/images/icons/purple/edit.png'),
		'token-symbol': require('@/app/assets/images/icons/purple/token-symbol.png'),
		'ethereum': require('@/app/assets/images/icons/purple/ethereum.png')
	},
	secondary: {
		'account-add': require('@/app/assets/images/icons/aqua/account-add.png'),
		'harvesting': require('@/app/assets/images/icons/aqua/harvesting.png'),
		'account-multisig': require('@/app/assets/images/icons/aqua/account-multisig.png'),
		'hide': require('@/app/assets/images/icons/aqua/hide.png'),
		'account-remove': require('@/app/assets/images/icons/aqua/account-remove.png'),
		'history': require('@/app/assets/images/icons/aqua/history.png'),
		'account': require('@/app/assets/images/icons/aqua/account.png'),
		'info-circle': require('@/app/assets/images/icons/aqua/info-circle.png'),
		'address-book': require('@/app/assets/images/icons/aqua/address-book.png'),
		'key': require('@/app/assets/images/icons/aqua/key.png'),
		'alert-danger': require('@/app/assets/images/icons/aqua/alert-danger.png'),
		'message-encrypted': require('@/app/assets/images/icons/aqua/message-encrypted.png'),
		'alert-warning': require('@/app/assets/images/icons/aqua/alert-warning.png'),
		'nem': require('@/app/assets/images/icons/aqua/nem.png'),
		'arrow-left': require('@/app/assets/images/icons/aqua/arrow-left.png'),
		'open': require('@/app/assets/images/icons/aqua/open.png'),
		'arrow-right': require('@/app/assets/images/icons/aqua/arrow-right.png'),
		'pending': require('@/app/assets/images/icons/aqua/pending.png'),
		'backspace': require('@/app/assets/images/icons/aqua/backspace.png'),
		'puzzle': require('@/app/assets/images/icons/aqua/puzzle.png'),
		'block-explorer': require('@/app/assets/images/icons/aqua/block-explorer.png'),
		'question-circle': require('@/app/assets/images/icons/aqua/question-circle.png'),
		'check-circle-big': require('@/app/assets/images/icons/aqua/check-circle-big.png'),
		'receive': require('@/app/assets/images/icons/aqua/receive.png'),
		'check-circle': require('@/app/assets/images/icons/aqua/check-circle.png'),
		'revoke': require('@/app/assets/images/icons/aqua/revoke.png'),
		'check': require('@/app/assets/images/icons/aqua/check.png'),
		'send-plane': require('@/app/assets/images/icons/aqua/send-plane.png'),
		'chevron-down': require('@/app/assets/images/icons/aqua/chevron-down.png'),
		'send-wallet': require('@/app/assets/images/icons/aqua/send-wallet.png'),
		'chevron-up': require('@/app/assets/images/icons/aqua/chevron-up.png'),
		'show': require('@/app/assets/images/icons/aqua/show.png'),
		'copy': require('@/app/assets/images/icons/aqua/copy.png'),
		'sign': require('@/app/assets/images/icons/aqua/sign.png'),
		'cross-circle': require('@/app/assets/images/icons/aqua/cross-circle.png'),
		'symbol': require('@/app/assets/images/icons/aqua/symbol.png'),
		'cross': require('@/app/assets/images/icons/aqua/cross.png'),
		'token-custom': require('@/app/assets/images/icons/aqua/token-custom.png'),
		'delete': require('@/app/assets/images/icons/aqua/delete.png'),
		'token-ethereum': require('@/app/assets/images/icons/aqua/token-ethereum.png'),
		'detach': require('@/app/assets/images/icons/aqua/detach.png'),
		'token-nem': require('@/app/assets/images/icons/aqua/token-nem.png'),
		'edit': require('@/app/assets/images/icons/aqua/edit.png'),
		'token-symbol': require('@/app/assets/images/icons/aqua/token-symbol.png'),
		'ethereum': require('@/app/assets/images/icons/aqua/ethereum.png')
	},
	inverse: {
		'account-add': require('@/app/assets/images/icons/black/account-add.png'),
		'harvesting': require('@/app/assets/images/icons/black/harvesting.png'),
		'account-multisig': require('@/app/assets/images/icons/black/account-multisig.png'),
		'hide': require('@/app/assets/images/icons/black/hide.png'),
		'account-remove': require('@/app/assets/images/icons/black/account-remove.png'),
		'history': require('@/app/assets/images/icons/black/history.png'),
		'account': require('@/app/assets/images/icons/black/account.png'),
		'info-circle': require('@/app/assets/images/icons/black/info-circle.png'),
		'address-book': require('@/app/assets/images/icons/black/address-book.png'),
		'key': require('@/app/assets/images/icons/black/key.png'),
		'alert-danger': require('@/app/assets/images/icons/black/alert-danger.png'),
		'message-encrypted': require('@/app/assets/images/icons/black/message-encrypted.png'),
		'alert-warning': require('@/app/assets/images/icons/black/alert-warning.png'),
		'nem': require('@/app/assets/images/icons/black/nem.png'),
		'arrow-left': require('@/app/assets/images/icons/black/arrow-left.png'),
		'open': require('@/app/assets/images/icons/black/open.png'),
		'arrow-right': require('@/app/assets/images/icons/black/arrow-right.png'),
		'pending': require('@/app/assets/images/icons/black/pending.png'),
		'backspace': require('@/app/assets/images/icons/black/backspace.png'),
		'puzzle': require('@/app/assets/images/icons/black/puzzle.png'),
		'block-explorer': require('@/app/assets/images/icons/black/block-explorer.png'),
		'question-circle': require('@/app/assets/images/icons/black/question-circle.png'),
		'check-circle-big': require('@/app/assets/images/icons/black/check-circle-big.png'),
		'receive': require('@/app/assets/images/icons/black/receive.png'),
		'check-circle': require('@/app/assets/images/icons/black/check-circle.png'),
		'revoke': require('@/app/assets/images/icons/black/revoke.png'),
		'check': require('@/app/assets/images/icons/black/check.png'),
		'send-plane': require('@/app/assets/images/icons/black/send-plane.png'),
		'chevron-down': require('@/app/assets/images/icons/black/chevron-down.png'),
		'send-wallet': require('@/app/assets/images/icons/black/send-wallet.png'),
		'chevron-up': require('@/app/assets/images/icons/black/chevron-up.png'),
		'show': require('@/app/assets/images/icons/black/show.png'),
		'copy': require('@/app/assets/images/icons/black/copy.png'),
		'sign': require('@/app/assets/images/icons/black/sign.png'),
		'cross-circle': require('@/app/assets/images/icons/black/cross-circle.png'),
		'symbol': require('@/app/assets/images/icons/black/symbol.png'),
		'cross': require('@/app/assets/images/icons/black/cross.png'),
		'token-custom': require('@/app/assets/images/icons/black/token-custom.png'),
		'delete': require('@/app/assets/images/icons/black/delete.png'),
		'token-ethereum': require('@/app/assets/images/icons/black/token-ethereum.png'),
		'detach': require('@/app/assets/images/icons/black/detach.png'),
		'token-nem': require('@/app/assets/images/icons/black/token-nem.png'),
		'edit': require('@/app/assets/images/icons/black/edit.png'),
		'token-symbol': require('@/app/assets/images/icons/black/token-symbol.png'),
		'ethereum': require('@/app/assets/images/icons/black/ethereum.png')
	}
};

/**
 * Icon component
 * 
 * @param {object} props - Component props.
 * @param {string} props.name - Icon name.
 * @param {'xxs' | 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl'} props.size - Icon size (xxs, xs, s, m, l, xl, xxl).
 * @param {'default' | 'secondary' | 'inverse'} props.variant - Icon color (default, secondary, inverse).
 * @param {object} props.src - Optional source path for custom icon.
 * @param {object} props.style - Optional additional styles.
 * 
 * @returns {React.ReactNode} Icon component
 */
export const Icon = ({ name, size = 'm', variant = 'default', src, style: customStyle }) => {
	const iconSize = sizeMap[size];
	const iconSource = src ?? sourceMap[variant][name];

	if (!iconSource)
		throw new Error(`Icon: Icon source not found for name "${name}" and color variant "${variant}".`);

	const mainStyle = {
		width: iconSize,
		height: iconSize,
		resizeMode: 'contain'
	};

	return <Image source={iconSource} style={[mainStyle, customStyle]} />;
};
