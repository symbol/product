import { Primitives } from './primitives';

export const Semantic = {
	role: {
		primary: {
			default: Primitives.purple500,
			weaker: Primitives.purple700,
			muted: Primitives.purple800
		},
		secondary: {
			default: Primitives.aqua400,
			weaker: Primitives.aqua600,
			muted: Primitives.aqua800
		},
		danger: {
			default: Primitives.red200,
			weaker: Primitives.red400,
			muted:  Primitives.red800
		},
		warning: {
			default: Primitives.yellow200,
			weaker: Primitives.yellow400,
			muted:  Primitives.yellow800
		},
		success: {
			default: Primitives.green200,
			weaker: Primitives.green400,
			muted: Primitives.green800
		},
		info: {
			default: Primitives.blue200,
			weaker: Primitives.blue400,
			muted: Primitives.blue800
		},
		neutral: {
			default: Primitives.grey200,
			weaker: Primitives.grey400,
			muted: Primitives.grey800
		}
	},
	background: {
		primary: {
			lighter: Primitives.darkGraphite500,
			default: Primitives.darkGraphite600,
			darker: Primitives.darkGraphite700
		},
		secondary: {
			default: Primitives.darkPurple800,
			darker: Primitives.darkPurple900
		},
		tertiary: {
			lighter: Primitives.darkGrey400,
			default: Primitives.darkGrey900,
			darker: Primitives.black
		}
	},
	content: {
		primary: {
			default: Primitives.white,
			inverse: Primitives.black
		},
		secondary: {
			default: Primitives.grey100,
			inverse: Primitives.grey800
		}
	},
	overlay: {
		primary: {
			default: '#000C'
		}
	}
};

// <component>.<role(optional)>.<state(optional)>.<property>
export const Components = {
	loadingIndicator: {
		surface: Semantic.role.secondary.default
	},
	statusbar: {
		background: Semantic.background.tertiary.darker
	},
	titlebar: {
		background: Semantic.background.tertiary.default
	},
	main: {
		background: Semantic.background.primary.darker,
		text: Semantic.content.primary.default
	},
	title: {
		text: Semantic.content.primary.default
	},
	passcode: {
		background: Semantic.background.secondary.default
	},
	dialog: {
		background: Semantic.background.secondary.default
	},
	card: {
		background: Semantic.background.primary.default
	},
	cardHeader: {
		background: Semantic.background.primary.lighter
	},
	dataContainer: {
		background: Semantic.background.tertiary.darker
	},
	divider: {
		default: {
			background: Semantic.background.primary.default
		},
		inverted: {
			background: Semantic.background.primary.darker
		},
		accent: {
			background: Semantic.background.tertiary.lighter
		}
	},
	popupMessage: {
		background: Semantic.background.tertiary.darker,
		text: Semantic.role.secondary.default,
		border: Semantic.role.secondary.default
	},
	networkConnectionStatus: {
		default: {
			text: Semantic.content.primary.inverse
		},
		connected: {
			background: Semantic.role.info.default
		},
		connecting: {
			background: Semantic.role.warning.default
		},
		disconnected: {
			background: Semantic.role.danger.default
		}
	},
	alert: {
		neutral: {
			background: Semantic.background.secondary.default,
			text: Semantic.role.neutral.default
		},
		info: {
			background: Semantic.background.secondary.default,
			text: Semantic.role.info.default
		},
		success: {
			background: Semantic.background.secondary.default,
			text: Semantic.role.success.default
		},
		warning: {
			background: Semantic.background.secondary.default,
			text: Semantic.role.warning.default
		},
		danger: {
			background: Semantic.background.secondary.default,
			text: Semantic.role.danger.default
		}
	},
	statusCard: {
		neutral: {
			background: Semantic.role.neutral.default
		},
		info: {
			background: Semantic.role.info.default
		},
		success: {
			background: Semantic.role.success.default
		},
		warning: {
			background: Semantic.role.warning.default
		},
		danger: {
			background: Semantic.role.danger.default
		}
	},
	statusLabel: {
		neutral: {
			text: Semantic.role.neutral.default
		},
		info: {
			text: Semantic.role.info.default
		},
		success: {
			text: Semantic.role.success.default
		},
		warning: {
			text: Semantic.role.warning.default
		},
		danger: {
			text: Semantic.role.danger.default
		}
	},
	navigationMenu: {
		background: Semantic.background.secondary.default
	},
	navigationMenuItem: {
		default: {
			background: Semantic.background.secondary.default,
			text: Semantic.content.primary.default
		},
		active: {
			background: '#1E2F52',
			text: Semantic.role.secondary.default
		}
	},
	tabs: {
		background: Semantic.background.tertiary.default
	},
	tabsItem: {
		default: {
			text: Semantic.role.secondary.default
		},
		active: {
			text: Semantic.role.secondary.default,
			border: Semantic.role.secondary.default
		}
	},
	summary: {
		background: Semantic.background.tertiary.darker,
		text: Semantic.content.primary.default
	},
	progress: {
		background: Semantic.background.tertiary.darker,
		bar: {
			default: Semantic.role.secondary.default,
			success: Semantic.role.success.default,
			warning: Semantic.role.warning.default,
			danger: Semantic.role.danger.default
		}
	},
	buttonCardEmbedded: {
		primary: {
			default: {
				background: Semantic.role.primary.weaker,
				text: Semantic.content.primary.default
			}
		},
		neutral: {
			default: {
				background: Semantic.role.neutral.muted,
				text: Semantic.content.primary.default
			}
		}
	},
	// Solid button, floating button.
	buttonSolid: {
		secondary: {
			default: {
				border: Semantic.role.secondary.default,
				background: Semantic.role.secondary.default,
				text: Semantic.content.primary.inverse
			},
			pressed: {
				border: Semantic.role.secondary.weaker,
				background: Semantic.role.secondary.weaker,
				text: Semantic.content.primary.inverse
			},
			disabled: {
				border: Semantic.role.secondary.muted,
				background: Semantic.role.secondary.muted,
				text: Semantic.content.primary.inverse
			}
		},
		danger: {
			default: {
				border: Semantic.role.danger.default,
				background: Semantic.role.danger.default,
				text: Semantic.content.primary.inverse
			},
			pressed: {
				border: Semantic.role.danger.weaker,
				background:Semantic.role.danger.weaker, 
				text: Semantic.content.primary.inverse
			},
			disabled: {
				border: Semantic.role.danger.muted,
				background: Semantic.role.danger.muted,
				text: Semantic.content.primary.inverse
			}
		},
		warning: {
			default: {
				border: Semantic.role.warning.default,
				background: Semantic.role.warning.default,
				text: Semantic.content.primary.inverse
			},
			pressed: {
				border: Semantic.role.warning.weaker,
				background: Semantic.role.warning.weaker,
				text: Semantic.content.primary.inverse
			},
			disabled: {
				border: Semantic.role.warning.muted,
				background: Semantic.role.warning.muted,
				text: Semantic.content.primary.inverse
			}
		},
		neutral: {
			default: {
				border: Semantic.role.neutral.default,
				background: Semantic.role.neutral.default,
				text: Semantic.content.primary.inverse
			},
			pressed: {
				border: Semantic.role.neutral.weaker,
				background: Semantic.role.neutral.weaker,
				text: Semantic.content.primary.inverse
			},
			disabled: {
				border: Semantic.role.neutral.muted,
				background: Semantic.role.neutral.muted,
				text: Semantic.content.primary.inverse
			}
		}
	},
	// Bordered buttons
	buttonBordered: {
		secondary: {
			default: {
				background: Semantic.background.secondary.darker,
				text: Semantic.role.secondary.default,
				border: Semantic.role.secondary.default
			},
			pressed: {
				background: Semantic.role.secondary.muted,
				text: Semantic.role.secondary.default,
				border: Semantic.role.secondary.default
			},
			disabled: {
				background: Semantic.background.secondary.darker,
				text: Semantic.role.secondary.muted,
				border: Semantic.role.secondary.muted
			}
		},
		danger: {
			default: {
				background: Semantic.background.secondary.darker,
				text: Semantic.role.danger.default,
				border: Semantic.role.danger.default
			},
			pressed: {
				background: Semantic.role.danger.muted,
				text: Semantic.role.danger.default,
				border: Semantic.role.danger.default
			},
			disabled: {
				background: Semantic.background.secondary.darker,
				text: Semantic.role.danger.muted,
				border: Semantic.role.danger.muted
			}
		},
		warning: {
			default: {
				background: Semantic.background.secondary.darker,
				text: Semantic.role.warning.default,
				border: Semantic.role.warning.default
			},
			pressed: {
				background: Semantic.role.warning.weaker,
				text: Semantic.role.warning.default,
				border: Semantic.role.warning.default
			},
			disabled: {
				background: Semantic.background.secondary.darker,
				text: Semantic.role.warning.muted,
				border: Semantic.role.warning.muted
			}
		},
		neutral: {
			default: {
				background: Semantic.background.secondary.darker,
				text: Semantic.role.neutral.default,
				border: Semantic.role.neutral.default
			},
			pressed: {
				background: Semantic.role.neutral.muted,
				text: Semantic.role.neutral.default,
				border: Semantic.role.neutral.default
			},
			disabled: {
				background: Semantic.background.secondary.darker,
				text: Semantic.role.neutral.muted,
				border: Semantic.role.neutral.muted
			}
		}
	},
	// Text boxes, inputs, check boxes, switches, radio buttons etc.
	control: {
		default: {
			default: {
				background: Semantic.background.tertiary.darker,
				label: Semantic.background.tertiary.lighter,
				placeholder: Semantic.background.tertiary.lighter,
				text: Semantic.content.primary.default,
				border: Semantic.role.primary.default,
				surface: Semantic.role.primary.default
			},
			focused: {
				background: Semantic.background.tertiary.darker,
				label: Semantic.background.tertiary.lighter,
				placeholder: Semantic.background.tertiary.lighter,
				text: Semantic.content.primary.default,
				border: Semantic.role.primary.weaker,
				surface: Semantic.role.primary.weaker
			},
			disabled: {
				background: Semantic.background.tertiary.darker,
				label: Semantic.background.tertiary.lighter,
				placeholder: Semantic.background.tertiary.lighter,
				text: Semantic.background.tertiary.lighter,
				border: Semantic.role.primary.muted,
				surface: Semantic.role.primary.muted
			}
		},
		danger: {
			default: {
				background: Semantic.background.tertiary.darker,
				label: Semantic.background.tertiary.lighter,
				placeholder: Semantic.background.tertiary.lighter,
				text: Semantic.content.primary.default,
				border: Semantic.role.danger.default,
				surface: Semantic.role.danger.default
			},
			focused: {
				background: Semantic.background.tertiary.darker,
				label: Semantic.background.tertiary.lighter,
				placeholder: Semantic.background.tertiary.lighter,
				text: Semantic.content.primary.default,
				border: Semantic.role.danger.weaker,
				surface: Semantic.role.danger.weaker
			},
			disabled: {
				background: Semantic.background.tertiary.darker,
				label: Semantic.background.tertiary.lighter,
				placeholder: Semantic.background.tertiary.lighter,
				text: Semantic.background.tertiary.lighter,
				border: Semantic.role.danger.muted,
				surface: Semantic.role.danger.muted
			}
		}
	},
	select: {
		default: {
			default: {
				background: Primitives.transparent
			},
			selected: {
				background: Semantic.role.primary.default
			}
		}
	},
	// Chips, suggestion buttons etc.
	chip: {
		default: {
			background: Semantic.background.secondary.default,
			text: Semantic.role.secondary.default
		},
		pressed: {
			background: Semantic.role.secondary.weaker,
			text: Semantic.role.secondary.default
		},
		active: {
			background: Semantic.role.secondary.default,
			text: Semantic.content.primary.inverse
		}
	},
	// Tab selector control
	tabSelector: {
		default: {
			background: Semantic.background.secondary.default,
			text: Semantic.role.secondary.default,
			border: Semantic.role.secondary.default
		},
		pressed: {
			background: Semantic.role.secondary.weaker,
			text: Semantic.role.secondary.default
		},
		active: {
			background: Semantic.role.secondary.default,
			text: Semantic.content.primary.inverse
		}
	},
	// Link, plain text button etc.
	link: {
		default: {
			default: {
				text: Semantic.role.secondary.default
			},
			pressed: {
				text: Semantic.role.secondary.weaker
			},
			disabled: {
				text: Semantic.role.secondary.muted
			}
		}
	}
};
