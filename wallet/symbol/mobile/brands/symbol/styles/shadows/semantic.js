import { Primitives as ColorPrimitives } from '../colors/primitives';
import { Primitives as SizePrimitives } from '../sizes/primitives';

const SHADOW_OFFSET_Y = SizePrimitives.spacing025; // 2px

/**
 * Creates the top, center and bottom versions of one shadow level.
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
	s: createDirections({
		blurRadius: SizePrimitives.spacing050, // 4px
		color: ColorPrimitives.blackOpacity30
	})
};

export const Components = {
	accountCard: Semantic.none,
	accountCardWidget: Semantic.none,
	buttonCircle: Semantic.s.bottom,
	filter: Semantic.none,
	header: Semantic.none,
	listItem: Semantic.none,
	navigationMenu: Semantic.none,
	settingsListItem: Semantic.none,
	widget: Semantic.none
};
