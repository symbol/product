const SHADOW_OFFSET_Y = 2;

/**
 * Creates the top, center and bottom versions of one shadow level.
 * @param {object} level - Shadow level values.
 * @param {number} level.blurRadius - Shadow blur radius.
 * @param {string} level.color - Shadow color.
 * @returns {{top: object[], center: object[], bottom: object[]}} Shadow lists by direction.
 */
const createDirections = ({ blurRadius, color }) => {
	const createShadow = offsetY => [{
		offsetX: 0,
		offsetY,
		blurRadius,
		color
	}];

	return {
		top: createShadow(-SHADOW_OFFSET_Y),
		center: createShadow(0),
		bottom: createShadow(SHADOW_OFFSET_Y)
	};
};

export const Semantic = {
	none: [],
	s: createDirections({ blurRadius: 4, color: 'rgba(0, 0, 0, 0.3)' })
};

export const Components = {
	accountCard: Semantic.none,
	accountCardWidget: Semantic.none,
	buttonCircle: Semantic.s.bottom,
	card: Semantic.none,
	control: Semantic.none,
	filter: Semantic.none,
	header: Semantic.none,
	listItem: Semantic.none,
	navigationMenu: Semantic.none,
	settingsListItem: Semantic.none,
	widget: Semantic.none
};
