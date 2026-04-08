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
		s: Primitives.spacing400, // 32px
		m: Primitives.spacing600 // 48px
	},
	circleControlSize: {
		s: Primitives.spacing300, // 24px
		m: Primitives.spacing400, // 32px
		l: Primitives.spacing600, // 48px,
		xl: Primitives.spacing800 // 64px
	},
	selectHeight: {
		m: Primitives.spacing500 // 40px
	},
	avatarHeight: {
		s: Primitives.spacing300, // 24px
		m: Primitives.spacing400, // 32px
		l: Primitives.spacing500,  // 40px
		xl: Primitives.spacing600  // 48px
	},
	layoutPadding: {
		none: Primitives.spacing0, // 0px
		s: Primitives.spacing100, // 8px
		m: Primitives.spacing200, // 16px
		l: Primitives.spacing300, // 24px
		xl: Primitives.spacing400, // 32px,
		xxl: Primitives.spacing500 // 40px
	},
	layoutSpacing: {
		none: Primitives.spacing0, // 0px
		xs: Primitives.spacing050, // 4px
		s: Primitives.spacing100, // 8px
		m: Primitives.spacing200, // 16px
		l: Primitives.spacing300, // 24px
		xl: Primitives.spacing400, // 32px,
		xxl: Primitives.spacing500, // 40px
		xxxl: Primitives.spacing600, // 48px
		xxxxl: Primitives.spacing1000 // 80px
	},
	headerHeight: {
		m: Primitives.spacing700 // 56px
	},
	navigationMenuHeight: {
		m: Primitives.spacing700 // 56px
	},
	iconSize: {
		xxs: Primitives.spacing150, // 12px message type, boolean, widget header icon (was 14)
		xs: Primitives.spacing200, // 16px - button copy, transaction send activity icon  
		// 18 - transaction graphic action, checkbox inner icon, edit button, button plain
		s: Primitives.spacing250, // 20 - close button icon close
		m: Primitives.spacing300, // 24px -standard - tx type, navigation, transaction graphic target icon
		l: Primitives.spacing400, // 32px - transaction send activity circle wrapper, settings items icons,
		// 36 - icon asset
		xl: Primitives.spacing500 // 40px - token icon bridge
		// 48px - transaction graphic target wrapper, avatar md
	}
};

export const Component = {
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
