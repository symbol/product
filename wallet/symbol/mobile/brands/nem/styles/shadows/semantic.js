import { Primitives as ColorPrimitives } from '../colors/primitives';
import { Primitives as SizePrimitives } from '../sizes/primitives';

const SHADOW_OFFSET_Y = SizePrimitives.spacing025 / 2; // 1px

/**
 * Creates the top, center and bottom options for shadow level.
 * @param {object} level - Shadow level values.
 * @param {number} level.blurRadius - Shadow blur radius.
 * @param {string} level.color - Shadow color.
 * @returns {{top: object[], center: object[], bottom: object[]}} Shadow lists by direction.
 */
const createDirections = ({ blurRadius, color }) => {
	const createShadow = offsetY => [{
		offsetX: SizePrimitives.spacing0,
		offsetY,
		blurRadius,
		color
	}];

	return {
		top: createShadow(-SHADOW_OFFSET_Y),
		center: createShadow(SizePrimitives.spacing0),
		bottom: createShadow(SHADOW_OFFSET_Y)
	};
};

export const Semantic = {
	none: [],
	xs: createDirections({
		blurRadius: SizePrimitives.spacing025, // 2px
		color: ColorPrimitives.blackOpacity3
	}),
	s: createDirections({
		blurRadius: SizePrimitives.spacing025, // 2px
		color: ColorPrimitives.blackOpacity10
	}),
	m: createDirections({
		blurRadius: SizePrimitives.spacing200, // 16px
		color: ColorPrimitives.blackOpacity3
	})
};

export const Components = {
	accountCard: Semantic.s.bottom,
	buttonCircle: Semantic.s.bottom,
	filter: Semantic.xs.bottom,
	header: Semantic.m.bottom,
	listItem: Semantic.m.bottom,
	navigationMenu: Semantic.m.top,
	settingsItem: Semantic.m.bottom,
	widget: Semantic.m.bottom
};
