import { ButtonClose, Icon, StyledText } from '@/app/components';
import { useColorTransition } from '@/app/hooks';
import { Colors, Sizes, Typography } from '@/app/styles';
import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * An internal modal component used by the Dropdown for item selection, displaying a list of options in a modal overlay.
 *
 * @param {object} props - Component props
 * @param {*} props.value - Currently selected value.
 * @param {Array<{value: *, label: string}>} props.list - List of selectable items.
 * @param {string} props.title - Modal title.
 * @param {boolean} props.isOpen - Whether the modal is visible.
 * @param {function} [props.renderItem] - Custom render function for list items.
 * @param {function} props.onClose - Callback when modal is closed.
 * @param {function} props.onChange - Callback when a value is selected.
 * 
 * @returns {React.ReactNode} DropdownModal component
 */
export const DropdownModal = props => {
	const { value, list, title, isOpen, renderItem: renderCustomItem, onClose, onChange } = props;

	// Items
	const getItemWrapperStyle = itemValue => [styles.item, itemValue === value && styles.item__selected];
	const renderItem = (item, index) => {
		if (renderCustomItem) 
			return renderCustomItem({ item, index });

		return <StyledText>{item.label}</StyledText>;
	};
	const handleItemPress = (selectedValue, e) => {
		e?.stopPropagation?.();
		onChange(selectedValue);
		onClose();
	};

	return (
		<Modal 
			animationType="fade" 
			transparent visible={isOpen} 
			onRequestClose={onClose}
		>
			<Pressable style={styles.overlay} onPress={onClose}>
				<SafeAreaView style={styles.safeArea}>
					<Pressable style={styles.modalContainer} onPress={e => e.stopPropagation()}>
						<StyledText type="title">
							{title}
						</StyledText>
						{isOpen && (
							<FlatList
								data={list}
								keyExtractor={(_, index) => 'dropdown' + index}
								renderItem={({ item, index }) => (
									<TouchableOpacity 
										style={getItemWrapperStyle(item.value)} 
										onPress={e => handleItemPress(item.value, e)}
									>
										{renderItem(item, index)}
									</TouchableOpacity>
								)}
							/>
						)}
					</Pressable>
					<ButtonClose style={styles.buttonClose} onPress={onClose} />
				</SafeAreaView>
			</Pressable>
		</Modal>
	);
};

/**
 * A dropdown component that displays a selected value and opens a modal for selecting from a list of options, with animated interactions.
 *
 * @param {object} props - Component props
 * @param {string} props.label - Label displayed above the selected value.
 * @param {*} props.value - Currently selected value.
 * @param {Array<{value: *, label: string}>} props.list - List of selectable items.
 * @param {boolean} [props.isDisabled=false] - Whether the dropdown is disabled.
 * @param {function} [props.renderItem] - Custom render function for list items.
 * @param {object} [props.style] - Additional styles for the component container.
 * @param {function} props.onChange - Callback when a value is selected.
 *
 * @returns {React.ReactNode} Dropdown component
 */
export const Dropdown = props => {
	const { label, value, list, isDisabled = false, renderItem, style, onChange } = props;
	const [isOpen, setIsOpen] = useState(false);

	// Colors and style animations
	const palette = Colors.Components.control.default;

	const {
		animateIn,
		animateOut,
		createAnimatedStyles
	} = useColorTransition({
		palette,
		transitionState: 'focused',
		isDisabled
	});
	const animatedContainer = createAnimatedStyles([
		{ property: 'background', styleProperty: 'backgroundColor' },
		{ property: 'border', styleProperty: 'borderColor' }
	]);
	const animatedLabel = createAnimatedStyles([
		{ property: 'label', styleProperty: 'color' }
	]);
	const animatedText = createAnimatedStyles([
		{ property: 'text', styleProperty: 'color' }
	]);

	const valueText = list.find(item => item.value === value)?.label || value;

	// Handlers
	const handleWrapperPress = e => {
		e?.stopPropagation?.();
		if (isDisabled)
			return;
		setIsOpen(true);
	};
	const handleClose = () => {
		setIsOpen(false);
	};

	return (
		<View>
			<Pressable 
				onPress={handleWrapperPress} 
				onPressIn={animateIn} 
				onPressOut={animateOut} 
				disabled={isDisabled}
			>
				<Animated.View style={[styles.root, animatedContainer, style]}>
					<View style={styles.inputContainer}>
						<Animated.Text style={[styles.label, animatedLabel]}>
							{label}
						</Animated.Text>
						<Animated.Text style={[styles.value, animatedText]}>
							{valueText}
						</Animated.Text>
					</View>
					<Icon name="chevron-down" size="m" />
				</Animated.View>
			</Pressable>
			<DropdownModal
				value={value}
				list={list}
				title={label}
				isOpen={isOpen}
				renderItem={renderItem}
				onClose={handleClose}
				onChange={onChange}
			/>
		</View>
	);
};

const CONTAINER_BORDER_WIDTH = Sizes.Semantic.borderWidth.m;
const EXTRA_PIXEL_OFFSET = 0.75;

const styles = StyleSheet.create({
	root: {
		position: 'relative',
		width: '100%',
		minHeight: Sizes.Semantic.controlHeight.m,
		paddingRight: Sizes.Semantic.spacing.m,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		borderRadius: Sizes.Semantic.borderRadius.s,
		borderWidth: CONTAINER_BORDER_WIDTH,
		borderStyle: 'solid'
	},
	inputContainer: {
		alignSelf: 'stretch',
		flex: 1,
		flexDirection: 'column',
		paddingRight: Sizes.Semantic.spacing.m,
		paddingLeft: Sizes.Semantic.spacing.m - EXTRA_PIXEL_OFFSET
	},
	label: {
		...Typography.Semantic.label.s,
		transform: [{ translateY: (Typography.Semantic.label.s.lineHeight / 4) - (CONTAINER_BORDER_WIDTH / 2) }],
		paddingLeft: EXTRA_PIXEL_OFFSET
	},
	value: {
		...Typography.Semantic.input.m,
		color: Colors.Components.control.default.default.text,
		height: Typography.Semantic.input.m.lineHeight,
		padding: 0
	},
	overlay: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		top: 0,
		backgroundColor: Colors.Semantic.overlay.primary.default,
		padding: Sizes.Semantic.layoutPadding.m
	},
	safeArea: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center'
	},
	modalContainer: {
		width: '100%',
		minHeight: '30%',
		maxHeight: '70%',
		backgroundColor: Colors.Components.dialog.background,
		borderRadius: Sizes.Semantic.borderRadius.m,
		padding: Sizes.Semantic.layoutPadding.m
	},
	item: {
		flexDirection: 'row',
		alignItems: 'center',
		minHeight: Sizes.Semantic.selectHeight.m,
		paddingHorizontal: Sizes.Semantic.spacing.m,
		paddingVertical: Sizes.Semantic.spacing.s,
		borderRadius: Sizes.Semantic.borderRadius.s,
		backgroundColor: Colors.Components.select.default.default.background
	},
	item__selected: {
		backgroundColor: Colors.Components.select.default.selected.background
	},
	buttonClose: {
		marginTop: Sizes.Semantic.spacing.m,
		padding: Sizes.Semantic.layoutPadding.m,
		alignSelf: 'center'
	}
});
