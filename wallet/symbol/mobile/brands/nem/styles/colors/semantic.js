import { Primitives } from './primitives';

export const Semantic = {
	role: {
		primary: {
			muted: Primitives.nemBlue100,
			default: Primitives.nemBlue500,
			strong: Primitives.nemBlue600,
			stronger: Primitives.nemBlue700
		},
		secondary: {
			muted: Primitives.nemGreen100,
			default: Primitives.nemGreen500,
			strong: Primitives.nemGreen600,
			stronger: Primitives.nemGreen700
		},
		danger: {
			muted: Primitives.red100,
			default: Primitives.red500,
			strong: Primitives.red600,
			stronger: Primitives.red700
		},
		warning: {
			muted: Primitives.nemYellow100,
			default: Primitives.nemYellow500,
			strong: Primitives.nemYellow600,
			stronger: Primitives.nemYellow700
		},
		success: {
			muted: Primitives.green100,
			default: Primitives.green500,
			strong: Primitives.green600,
			stronger: Primitives.green700
		},
		info: {
			muted: Primitives.nemBlue100,
			default: Primitives.nemBlue500,
			strong: Primitives.nemBlue600,
			stronger: Primitives.nemBlue700
		},
		neutral: {
			muted: Primitives.grey100,
			default: Primitives.grey500,
			strong: Primitives.grey600,
			stronger: Primitives.grey700
		}
	},
	background: {
		primary: {
			lighter: Primitives.lightBlueGrey100,
			default: Primitives.white,
			darker: Primitives.unnamedColor2
		},
		secondary: {
			default: Primitives.lightBlueGrey200,
			darker: Primitives.darkPurple900
		},
		tertiary: {
			lighter: Primitives.grey500,
			default: Primitives.unnamedColor1,
			darker: Primitives.black
		}
	},
	content: {
		primary: {
			default: Primitives.darkPurple900,
			muted: Primitives.grey500,
			inverse: Primitives.white
		},
		secondary: {
			default: Primitives.grey700,
			muted: Primitives.grey500,
			inverse: Primitives.grey100
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
		background: Semantic.background.tertiary.default
	},
	header: {
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
	accountCard: {
		default: {
			default: {
				background: Semantic.background.primary.default,
				border: Semantic.background.primary.default
			},
			active: {
				background: Semantic.role.primary.muted,
				border: Semantic.role.primary.default
			}
		},
		multisig: {
			default: {
				background: Semantic.role.warning.muted,
				border: Semantic.role.warning.muted
			},
			active: {
				background: Semantic.role.warning.muted,
				border: Semantic.role.warning.default
			}
		}
	},
	accountCardWidgetBody: {
		background: Semantic.background.tertiary.darker
	},
	accountCardWidgetButton: {
		default: {
			background: Primitives.blackOpacity50,
			separator: Semantic.background.tertiary.darker,
			text: Semantic.content.primary.inverse
		},
		disabled: {
			background: Primitives.blackOpacity50
		}
	},
	actionCard: {
		default: {
			background: Semantic.background.primary.default
		},
		pressed: {
			background: Semantic.background.primary.lighter
		}
	},
	actionCardContent: {
		background: Semantic.background.primary.default,
		text: Semantic.content.primary.default
	},
	dataContainer: {
		background: Semantic.background.primary.default
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
		background: Semantic.background.primary.default,
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
			background: Semantic.role.neutral.muted,
			text: Semantic.role.neutral.stronger
		},
		info: {
			background: Semantic.role.info.muted,
			text: Semantic.role.info.stronger
		},
		success: {
			background: Semantic.role.success.muted,
			text: Semantic.role.success.stronger
		},
		warning: {
			background: Semantic.role.warning.muted,
			text: Semantic.role.warning.stronger
		},
		danger: {
			background: Semantic.role.danger.muted,
			text: Semantic.role.danger.stronger
		}
	},
	statusCard: {
		neutral: {
			background: Semantic.role.neutral.muted,
			text: Semantic.content.primary.default
		},
		info: {
			background: Semantic.role.info.muted,
			text: Semantic.content.primary.default
		},
		success: {
			background: Semantic.role.success.muted,
			text: Semantic.content.primary.default
		},
		warning: {
			background: Semantic.role.warning.muted,
			text: Semantic.content.primary.default
		},
		danger: {
			background: Semantic.role.danger.muted,
			text: Semantic.content.primary.default
		}
	},
	statusLabel: {
		neutral: {
			text: Semantic.role.neutral.strong
		},
		info: {
			text: Semantic.role.info.strong
		},
		success: {
			text: Semantic.role.success.strong
		},
		warning: {
			text: Semantic.role.warning.strong
		},
		danger: {
			text: Semantic.role.danger.strong
		}
	},
	amount: {
		positive: {
			text: Semantic.role.success.strong
		},
		negative: {
			text: Semantic.role.danger.strong
		},
		neutral: {
			text: Semantic.content.primary.default
		},
		inverted: {
			text: Semantic.content.primary.inverse
		}
	},
	emptyList: {
		text: Semantic.content.primary.default
	},
	navigationMenu: {
		background: Semantic.background.tertiary.default
	},
	navigationMenuItem: {
		default: {
			background: Semantic.background.tertiary.default,
			text: Semantic.content.primary.muted
		},
		active: {
			background: Semantic.background.tertiary.default,
			text: Semantic.content.primary.default
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
		background: Semantic.background.primary.default,
		text: Semantic.content.primary.default
	},
	progress: {
		background: Semantic.background.primary.darker,
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
				background: Semantic.role.secondary.default,
				text: Semantic.content.primary.inverse
			},
			disabled: {
				background: Semantic.role.secondary.muted,
				text: Semantic.content.primary.muted
			}
		},
		neutral: {
			default: {
				background: Semantic.background.primary.default,
				text: Semantic.role.secondary.default
			},
			disabled: {
				background: Semantic.background.primary.default,
				text: Semantic.content.primary.muted
			}
		}
	},
	buttonSendReceive: {
		primary: {
			default: {
				background: Semantic.role.secondary.default,
				separator: Semantic.role.secondary.muted,
				text: Semantic.content.primary.inverse
			},
			disabled: {
				background: Semantic.role.secondary.muted,
				separator: Semantic.background.secondary.darker,
				text: Semantic.content.primary.muted
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
				border: Semantic.role.warning.default,
				background: Semantic.role.warning.default,
				text: Semantic.content.primary.inverse
			},
			disabled: {
				border: Semantic.background.tertiary.lighter,
				background: Semantic.background.tertiary.lighter,
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
				border: Semantic.role.danger.strong,
				background:Semantic.role.danger.strong,
				text: Semantic.content.primary.inverse
			},
			disabled: {
				border: Semantic.background.tertiary.lighter,
				background: Semantic.background.tertiary.lighter,
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
				border: Semantic.role.warning.strong,
				background: Semantic.role.warning.strong,
				text: Semantic.content.primary.inverse
			},
			disabled: {
				border: Semantic.background.tertiary.lighter,
				background: Semantic.background.tertiary.lighter,
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
				border: Semantic.role.neutral.strong,
				background: Semantic.role.neutral.strong,
				text: Semantic.content.primary.inverse
			},
			disabled: {
				border: Semantic.background.tertiary.lighter,
				background: Semantic.background.tertiary.lighter,
				text: Semantic.content.primary.inverse
			}
		}
	},
	// Bordered buttons
	buttonBordered: {
		secondary: {
			default: {
				background: Semantic.background.secondary.darker,
				text: Semantic.content.primary.inverse,
				border: Semantic.background.secondary.darker
			},
			pressed: {
				background: Semantic.role.secondary.default,
				text: Semantic.content.primary.inverse,
				border: Semantic.role.secondary.default
			},
			disabled: {
				background: Semantic.background.tertiary.lighter,
				text: Semantic.content.primary.inverse,
				border: Semantic.background.tertiary.lighter
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
				background: Semantic.background.tertiary.lighter,
				text: Semantic.content.primary.inverse,
				border: Semantic.background.tertiary.lighter
			}
		},
		warning: {
			default: {
				background: Semantic.background.secondary.darker,
				text: Semantic.role.warning.default,
				border: Semantic.role.warning.default
			},
			pressed: {
				background: Semantic.role.warning.muted,
				text: Semantic.role.warning.default,
				border: Semantic.role.warning.default
			},
			disabled: {
				background: Semantic.background.tertiary.lighter,
				text: Semantic.content.primary.inverse,
				border: Semantic.background.tertiary.lighter
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
				background: Semantic.background.tertiary.lighter,
				text: Semantic.content.primary.inverse,
				border: Semantic.background.tertiary.lighter
			}
		}
	},
	// Text boxes, inputs, check boxes, switches, radio buttons etc.
	control: {
		default: {
			default: {
				background: Semantic.background.primary.default,
				label: Semantic.content.primary.default,
				placeholder: Semantic.content.primary.default,
				text: Semantic.content.primary.default,
				border: Semantic.role.primary.default,
				surface: Semantic.role.primary.default
			},
			focused: {
				background: Semantic.background.primary.default,
				label: Semantic.content.primary.default,
				placeholder: Semantic.content.primary.default,
				text: Semantic.content.primary.default,
				border: Semantic.role.primary.strong,
				surface: Semantic.role.primary.strong
			},
			disabled: {
				background: Semantic.background.primary.default,
				label: Semantic.content.primary.muted,
				placeholder: Semantic.content.primary.muted,
				text: Semantic.content.primary.muted,
				border: Semantic.role.primary.muted,
				surface: Semantic.role.primary.muted
			}
		},
		danger: {
			default: {
				background: Semantic.background.primary.default,
				label: Semantic.content.primary.default,
				placeholder: Semantic.content.primary.default,
				text: Semantic.content.primary.default,
				border: Semantic.role.danger.default,
				surface: Semantic.role.danger.default
			},
			focused: {
				background: Semantic.background.primary.default,
				label: Semantic.content.primary.default,
				placeholder: Semantic.content.primary.default,
				text: Semantic.content.primary.default,
				border: Semantic.role.danger.strong,
				surface: Semantic.role.danger.strong
			},
			disabled: {
				background: Semantic.background.primary.default,
				label: Semantic.content.primary.muted,
				placeholder: Semantic.content.primary.muted,
				text: Semantic.content.primary.muted,
				border: Semantic.role.danger.muted,
				surface: Semantic.role.danger.muted
			}
		}
	},
	controlErrorMessage: {
		text: Semantic.role.danger.stronger
	},
	select: {
		default: {
			default: {
				background: Primitives.transparent
			},
			selected: {
				background: Semantic.role.primary.muted
			}
		}
	},
	// Chips, suggestion buttons etc.
	chip: {
		default: {
			background: Semantic.background.primary.default,
			text: Semantic.role.secondary.default
		},
		pressed: {
			background: Semantic.role.secondary.muted,
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
			background: Semantic.background.tertiary.default,
			text: Semantic.role.secondary.default,
			border: Semantic.role.secondary.default
		},
		pressed: {
			background: Semantic.role.secondary.muted,
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
				text: Semantic.role.secondary.default
			},
			disabled: {
				text: Semantic.role.secondary.muted
			}
		}
	}
};
