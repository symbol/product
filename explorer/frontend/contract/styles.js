/**
 * Value types of the required style tokens.
 * @readonly
 * @enum {string}
 */
export const StyleTokenType = {
	ANY: 'any',
	COLOR: 'color',
	FONT: 'font',
	FONT_FAMILY: 'fontFamily',
	SIZE: 'size',
	TEXT_TRANSFORM: 'textTransform'
};

/**
 * Required SCSS style tokens (styles/variables.scss) expected for each variant.
 * The main theme: every token the shared stylesheets use but do not declare.
 * @type {Record<string, StyleTokenType>}
 */
export const requiredScssStyleTokens = {
	'border-radius-button': StyleTokenType.SIZE,
	'border-radius-card': StyleTokenType.SIZE,
	'border-radius-chip': StyleTokenType.SIZE,
	'border-radius-filter': StyleTokenType.SIZE,
	'border-radius-input': StyleTokenType.SIZE,
	'border-radius-label': StyleTokenType.SIZE,
	'border-width-textbox': StyleTokenType.SIZE,
	'color-background-card': StyleTokenType.COLOR,
	'color-background-footer': StyleTokenType.COLOR,
	'color-background-header': StyleTokenType.COLOR,
	'color-background-main': StyleTokenType.COLOR,
	'color-background-mosaic': StyleTokenType.COLOR,
	'color-background-navigation': StyleTokenType.COLOR,
	'color-background-tooltip': StyleTokenType.COLOR,
	'color-block-cube-front': StyleTokenType.COLOR,
	'color-block-cube-right': StyleTokenType.COLOR,
	'color-block-cube-top': StyleTokenType.COLOR,
	'color-border-navigation': StyleTokenType.COLOR,
	'color-button-bg': StyleTokenType.COLOR,
	'color-chart-tooltip-bg': StyleTokenType.COLOR,
	'color-chart-tooltip-text': StyleTokenType.COLOR,
	'color-danger': StyleTokenType.COLOR,
	'color-filter-active': StyleTokenType.COLOR,
	'color-filter-inactive': StyleTokenType.COLOR,
	'color-heading': StyleTokenType.COLOR,
	'color-info': StyleTokenType.COLOR,
	'color-modal-overlay': StyleTokenType.COLOR,
	'color-primary': StyleTokenType.COLOR,
	'color-primary-light': StyleTokenType.COLOR,
	'color-separator-line-accent': StyleTokenType.COLOR,
	'color-separator-line-neutral': StyleTokenType.COLOR,
	'color-success': StyleTokenType.COLOR,
	'color-tab-active': StyleTokenType.COLOR,
	'color-tab-inactive': StyleTokenType.COLOR,
	'color-tab-line-active': StyleTokenType.COLOR,
	'color-text-body': StyleTokenType.COLOR,
	'color-text-button': StyleTokenType.COLOR,
	'color-text-empty-table': StyleTokenType.COLOR,
	'color-text-link': StyleTokenType.COLOR,
	'color-text-table-title': StyleTokenType.COLOR,
	'color-text-textbox-placeholder': StyleTokenType.COLOR,
	'color-text-title': StyleTokenType.COLOR,
	'color-text-tooltip': StyleTokenType.COLOR,
	'color-textbox-bg': StyleTokenType.COLOR,
	'color-textbox-border': StyleTokenType.COLOR,
	'color-textbox-text': StyleTokenType.COLOR,
	'color-warning': StyleTokenType.COLOR,
	'color-warning-light': StyleTokenType.COLOR,
	'filter-block-fee-icon': StyleTokenType.ANY,
	'font-body': StyleTokenType.FONT,
	'font-body-bold': StyleTokenType.FONT,
	'font-body-monospace': StyleTokenType.FONT,
	'font-button': StyleTokenType.FONT,
	'font-family-base': StyleTokenType.FONT_FAMILY,
	'font-h1': StyleTokenType.ANY, // ANY: the value has no font size.
	'font-h2': StyleTokenType.FONT,
	'font-h3': StyleTokenType.FONT,
	'font-h4': StyleTokenType.FONT,
	'font-highlighted': StyleTokenType.FONT,
	'font-input-placeholder': StyleTokenType.FONT,
	'font-input-text': StyleTokenType.FONT,
	'font-label': StyleTokenType.FONT,
	'font-mosaic-amount': StyleTokenType.FONT,
	'font-nav': StyleTokenType.FONT,
	'font-tab': StyleTokenType.FONT,
	'font-title': StyleTokenType.FONT,
	'layout-background-image': StyleTokenType.ANY,
	'layout-background-position': StyleTokenType.ANY,
	'layout-background-size': StyleTokenType.ANY,
	'text-transform-heading': StyleTokenType.TEXT_TRANSFORM,
	'text-transform-title': StyleTokenType.TEXT_TRANSFORM
};

/**
 * Required JS style tokens (styles/variables.json) expected for each variant.
 * For the places SCSS cannot reach: chart options and inline styles.
 * @type {Record<string, StyleTokenType>}
 */
export const requiredJsStyleTokens = {
	colorChartColumns: StyleTokenType.COLOR,
	colorChartDonutBackground: StyleTokenType.COLOR,
	colorChartDonutMain: StyleTokenType.COLOR,
	colorChartDonutStroke: StyleTokenType.COLOR,
	colorChartLine: StyleTokenType.COLOR,
	colorProgressDanger: StyleTokenType.COLOR,
	colorProgressDefault: StyleTokenType.COLOR,
	colorTransactionSquare: StyleTokenType.COLOR,
	colorTransactionSquareText: StyleTokenType.COLOR
};
