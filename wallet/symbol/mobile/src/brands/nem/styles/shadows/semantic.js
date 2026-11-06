const SHADOW_OFFSET_Y = 1;

/**
 * Creates the top, center and bottom options for shadow level.
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
	xs: createDirections({ blurRadius: 2, color: 'rgba(0, 0, 0, 0.033)' }),
	s: createDirections({ blurRadius: 2, color: 'rgba(0, 0, 0, 0.1)' }),
	m: createDirections({ blurRadius: 4, color: 'rgba(0, 0, 0, 0.05)' }),
	l: createDirections({ blurRadius: 8, color: 'rgba(0, 0, 0, 0.1)' })
};

export const Components = {
	accountCard: Semantic.l.bottom,
	accountCardWidget: Semantic.m.bottom,
	buttonCircle: Semantic.s.bottom,
	card: Semantic.m.bottom,
	control: Semantic.s.bottom,
	filter: Semantic.m.bottom,
	header: Semantic.m.bottom,
	listItem: Semantic.m.bottom,
	navigationMenu: Semantic.m.top,
	settingsListItem: Semantic.m.bottom,
	widget: Semantic.l.bottom
};
