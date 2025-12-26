import { Primitives } from './primitives';

export const Semantic = {
	borderWidth: {
		none: Primitives.spacing0, // 0px
		s: Primitives.spacing025 / 2, // 1px
		m: Primitives.spacing025, // 2px
		l: Primitives.spacing050 // 4px
	},
	borderRadius: {
		none: Primitives.spacing0, // 0px
		xs: Primitives.spacing025, // 2px
		s: Primitives.spacing050, // 4px
		m: Primitives.spacing100, // 8px
		l: Primitives.spacing150, // 12px
		xl: Primitives.spacing200, // 16px
		xxl: Primitives.spacing300, // 24px
		round: 9999
	},
	spacing: {
		none: Primitives.spacing0, // 0px
		xs: Primitives.spacing025, // 2px
		s: Primitives.spacing050, // 4px
		m: Primitives.spacing100, // 8px
		l: Primitives.spacing200, // 16px
		xl: Primitives.spacing300, // 24px
		xxl: Primitives.spacing400 // 32px
	},
	controlHeight: {
		m: Primitives.spacing600 // 48px
	},
	layoutPadding: {
		s: Primitives.spacing100, // 8px
		m: Primitives.spacing200, // 16px
		l: Primitives.spacing300, // 24px
		xl: Primitives.spacing400, // 32px,
		xxl: Primitives.spacing500 // 40px
	},
	layoutSpacing: {
		s: Primitives.spacing100, // 8px
		m: Primitives.spacing200, // 16px
		l: Primitives.spacing300, // 24px
		xl: Primitives.spacing400, // 32px,
		xxl: Primitives.spacing500 // 40px
	}
};

export const Component = {
	circleButton: {
		m: {
			surface: {
				size: Primitives.spacing600 // 48px
			},
			icon: {
				size: Primitives.spacing300 // 24px
			}
		}
	},
	circleIcon: {
		s: {
			surface: {
				size: Primitives.spacing400 // 32px
			},
			icon: {
				size: Primitives.spacing200 // 16px
			}
		},
		m: {
			surface: {
				size: Primitives.spacing600 // 48px
			},
			icon: {
				size: Primitives.spacing300 // 24px
			}
		}
	}
};
