import { AccountAvatar, Icon, StyledText, TokenAvatar } from '@/app/components';
import { Colors, Sizes, Typography } from '@/app/styles';
import { Image, StyleSheet, View } from 'react-native';

/** @typedef {import('@/app/screens/history/types/TransactionGraphic').TransactionGraphicArrowCaption} TransactionGraphicArrowCaption */
/** @typedef {import('@/app/screens/history/types/TransactionGraphic').TransactionGraphicAvatarType} TransactionGraphicAvatarType */
/** @typedef {import('@/app/screens/history/types/TransactionGraphic').TransactionGraphicSide} TransactionGraphicSide */
/** @typedef {import('react').ReactNode} ReactNode */

const AVATAR_SIZE_L = Sizes.Semantic.avatarHeight.l;
const ARROW_MAX_HEIGHT = AVATAR_SIZE_L;
const ARROW_CONTENT_LINE_HEIGHT = Typography.Semantic.label.m.lineHeight;

const graphicImageSourceMap = {
	arrow: require('@/app/assets/images/components/graphic/arrow.png')
};

/**
 * Namespace avatar placeholder for transaction graphics.
 * @returns {ReactNode} NamespaceAvatar component.
 */
const NamespaceAvatar = () => (
	<View style={styles.avatar}>
		<Icon name="namespace" size="xs" />
	</View>
);

/**
 * Lock avatar placeholder for transaction graphics.
 * @returns {ReactNode} LockAvatar component.
 */
const LockAvatar = () => (
	<View style={styles.avatar}>
		<Icon name="lock" size="xs" />
	</View>
);

/**
 * Renders the avatar used on either side of the transaction graphic.
 *
 * @param {Object} props - Component props.
 * @param {TransactionGraphicAvatarType} props.type - Avatar type to render.
 * @param {string} [props.imageId] - Optional avatar image identifier.
 * @param {string} [props.accountAddress] - Account avatar address.
 * @returns {ReactNode} Avatar component.
 */
const Avatar = ({ type, imageId, accountAddress }) => {
	const avatarComponentMap = {
		account: AccountAvatar,
		token: TokenAvatar,
		namespace: NamespaceAvatar,
		lock: LockAvatar
	};

	const AvatarComponent = avatarComponentMap[type];

	if (!AvatarComponent) {
		throw new Error(`TransactionGraphic: Unsupported avatar type "${type}".
            Supported types are: ${Object.keys(avatarComponentMap).join(', ')}`);
	}

	return <AvatarComponent imageId={imageId} address={accountAddress} size="l" />;
};

/**
 * Renders one arrow caption item.
 *
 * @param {TransactionGraphicArrowCaption} props - Caption data.
 * @returns {ReactNode} ArrowCaption component.
 */
const ArrowCaption = ({ value, type }) => {
	if (type === 'text') {
		return (
			<StyledText type="label" size='s'>
				{value}
			</StyledText>
		);
	}

	return <Icon name={value} size="xs" />;
};


/**
 * TransactionGraphic component. Displays a visual representation of a transaction
 * showing source and target with arrows and captions for transaction type and amount.
 *
 * @param {Object} props - Component props.
 * @param {string} props.typeText - Localized transaction type label.
 * @param {TransactionGraphicSide} props.source - Source side display data.
 * @param {TransactionGraphicSide} props.target - Target side display data.
 * @param {TransactionGraphicArrowCaption[]} props.arrowCaptions - Captions rendered inside the arrow.
 * @returns {ReactNode} TransactionGraphic component.
 */
export const TransactionGraphic = ({ typeText, source, target, arrowCaptions }) => {
	const sourceLabelStyle = source.color ? { color: source.color } : null;
	const targetLabelStyle = target.color ? { color: target.color } : null;

	return (
		<View style={styles.root}>
			<StyledText type="label" style={[styles.sourceLabelText, sourceLabelStyle]}>
				{source.text}
			</StyledText>

			<View style={styles.arrowContainer}>
				<Avatar type={source.type} imageId={source.imageId} accountAddress={source.accountAddress} />
				<Image source={graphicImageSourceMap.arrow} style={styles.arrowImage} />
				<View style={styles.arrowContentContainer}>
					<StyledText type="label" size="s" style={styles.typeText}>
						{typeText}
					</StyledText>
					<View style={styles.captionContainer}>
						{arrowCaptions.map((caption, index) => (
							<ArrowCaption
								key={index}
								value={caption.value}
								type={caption.type}
							/>
						))}
					</View>
				</View>
				<Avatar type={target.type} imageId={target.imageId} accountAddress={target.accountAddress} />
			</View>
			<StyledText type="label" style={[styles.targetLabelText, targetLabelStyle]}>
				{target.text}
			</StyledText>
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		flexDirection: 'column'
	},
	avatar: {
		backgroundColor: Colors.Semantic.background.tertiary.darker,
		borderRadius: AVATAR_SIZE_L / 2,
		width: AVATAR_SIZE_L,
		height: AVATAR_SIZE_L,
		justifyContent: 'center',
		alignItems: 'center'
	},
	sourceLabelText: {
		width: '50%'
	},
	arrowContainer: {
		position: 'relative',
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'center',
		gap: Sizes.Semantic.layoutSpacing.m
	},
	arrowImage: {
		flex: 1,
		flexShrink: 1,
		resizeMode: 'contain',
		maxHeight: ARROW_MAX_HEIGHT
	},
	arrowContentContainer: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		justifyContent: 'center',
		alignItems: 'center'
	},
	typeText: {
		minHeight: ARROW_CONTENT_LINE_HEIGHT
	},
	captionContainer: {
		minHeight: ARROW_CONTENT_LINE_HEIGHT,
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'center',
		gap: Sizes.Semantic.layoutSpacing.s,
		width: '100%'
	},
	targetLabelText: {
		width: '50%',
		textAlign: 'right',
		alignSelf: 'flex-end'
	}
});
