import { Primitives, missingColor } from './primitives';

export const Semantic = {
	role: {
		primary: {
			default: Primitives.nemBlue500,
			weaker: missingColor,
			muted: Primitives.nemBlue100
		},
		secondary: {
			default: Primitives.nemGreen500,
			weaker: missingColor,
			muted: Primitives.nemGreen0
		},
		danger: {
			default: Primitives.red500,
			weaker: Primitives.red400,
			muted:  Primitives.red100
		},
		warning: {
			default: Primitives.nemYellow500,
			weaker: missingColor,
			muted:  Primitives.nemYellow0
		},
		success: {
			default: Primitives.green500,
			weaker: missingColor,
			muted: Primitives.green0
		},
		info: {
			default: Primitives.nemBlue500,
			weaker: missingColor,
			muted: missingColor
		},
		neutral: {
			default: Primitives.nemBlue500,
			weaker: missingColor,
			muted: Primitives.nemBlue100
		}
	},
	background: {
		primary: {
			lighter: Primitives.lightBlueGrey100,
			default: Primitives.white,
			darker: Primitives.lightBlueGrey300
		},
		secondary: {
			default: Primitives.lightBlueGrey200,
			darker: Primitives.darkPurple900
		},
		tertiary: {
			lighter: Primitives.grey300,
			default: Primitives.lightBlueGrey100,
			darker: missingColor
		}
	},
	content: {
		primary: {
			default: Primitives.darkPurple900,
			muted: Primitives.grey300,
			inverse: Primitives.white
		},
		secondary: {
			default: missingColor,
			muted: missingColor,
			inverse: missingColor
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
				border: Semantic.role.warning.weaker
			},
			active: {
				background: Semantic.role.warning.muted,
				border: Semantic.role.warning.default
			}
		}
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
				background: Semantic.role.primary.weaker,
				separator: Semantic.role.primary.muted,
				text: Semantic.content.primary.inverse
			},
			disabled: {
				background: Semantic.role.primary.muted,
				separator: Semantic.background.primary.darker,
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
				border: Semantic.role.danger.weaker,
				background:Semantic.role.danger.weaker, 
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
				border: Semantic.role.warning.weaker,
				background: Semantic.role.warning.weaker,
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
				border: Semantic.role.neutral.weaker,
				background: Semantic.role.neutral.weaker,
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
				background: Semantic.role.warning.weaker,
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
				background: Semantic.role.primary.muted,
				label: Semantic.content.primary.default,
				placeholder: Semantic.content.primary.default,
				text: Semantic.content.primary.default,
				border: Semantic.role.primary.default,
				surface: Semantic.role.primary.default
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
				border: Semantic.role.danger.weaker,
				surface: Semantic.role.danger.weaker
			},
			focused: {
				background: Semantic.role.danger.muted,
				label: Semantic.content.primary.default,
				placeholder: Semantic.content.primary.default,
				text: Semantic.content.primary.default,
				border: Semantic.role.danger.weaker,
				surface: Semantic.role.danger.weaker
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
				text: Semantic.content.primary.default
			},
			pressed: {
				text: Semantic.role.secondary.default
			},
			disabled: {
				text: Semantic.content.primary.muted
			}
		}
	}
};
