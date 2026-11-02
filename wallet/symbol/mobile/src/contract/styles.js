export const StyleTokenType = {
	COLOR: 'color',
	SIZE: 'size',
	SHADOW: 'shadow',
	TEXT_STYLE: 'textStyle'
};

/**
 * Required style tokens expected for each brand.
 * Follow the shape in brand's style tokens definitions.
 * Typography tokens are less strict obviously, due to broader variation of optional sub-properties.
 */
export const requiredStyleTokens = {
	Colors: {
		Components: {
			loadingIndicator: {
				surface: StyleTokenType.COLOR
			},
			statusbar: {
				background: StyleTokenType.COLOR
			},
			header: {
				background: StyleTokenType.COLOR
			},
			main: {
				background: StyleTokenType.COLOR,
				text: StyleTokenType.COLOR
			},
			title: {
				text: StyleTokenType.COLOR
			},
			passcode: {
				background: StyleTokenType.COLOR
			},
			dialog: {
				background: StyleTokenType.COLOR
			},
			card: {
				background: StyleTokenType.COLOR
			},
			cardHeader: {
				background: StyleTokenType.COLOR
			},
			accountCard: {
				default: {
					default: {
						background: StyleTokenType.COLOR,
						border: StyleTokenType.COLOR
					},
					active: {
						background: StyleTokenType.COLOR,
						border: StyleTokenType.COLOR
					}
				},
				multisig: {
					default: {
						background: StyleTokenType.COLOR,
						border: StyleTokenType.COLOR
					},
					active: {
						background: StyleTokenType.COLOR,
						border: StyleTokenType.COLOR
					}
				}
			},
			accountCardWidgetBody: {
				background: StyleTokenType.COLOR
			},
			accountCardWidgetButton: {
				default: {
					background: StyleTokenType.COLOR,
					separator: StyleTokenType.COLOR,
					text: StyleTokenType.COLOR
				},
				disabled: {
					background: StyleTokenType.COLOR
				}
			},
			actionCard: {
				default: {
					background: StyleTokenType.COLOR
				},
				pressed: {
					background: StyleTokenType.COLOR
				}
			},
			actionCardContent: {
				background: StyleTokenType.COLOR,
				text: StyleTokenType.COLOR
			},
			dataContainer: {
				background: StyleTokenType.COLOR
			},
			divider: {
				default: {
					background: StyleTokenType.COLOR
				},
				inverted: {
					background: StyleTokenType.COLOR
				},
				accent: {
					background: StyleTokenType.COLOR
				}
			},
			popupMessage: {
				background: StyleTokenType.COLOR,
				text: StyleTokenType.COLOR,
				border: StyleTokenType.COLOR
			},
			networkConnectionStatus: {
				default: {
					text: StyleTokenType.COLOR
				},
				connected: {
					background: StyleTokenType.COLOR
				},
				connecting: {
					background: StyleTokenType.COLOR
				},
				disconnected: {
					background: StyleTokenType.COLOR
				}
			},
			alert: {
				neutral: {
					background: StyleTokenType.COLOR,
					text: StyleTokenType.COLOR
				},
				info: {
					background: StyleTokenType.COLOR,
					text: StyleTokenType.COLOR
				},
				success: {
					background: StyleTokenType.COLOR,
					text: StyleTokenType.COLOR
				},
				warning: {
					background: StyleTokenType.COLOR,
					text: StyleTokenType.COLOR
				},
				danger: {
					background: StyleTokenType.COLOR,
					text: StyleTokenType.COLOR
				}
			},
			statusCard: {
				neutral: {
					background: StyleTokenType.COLOR
				},
				info: {
					background: StyleTokenType.COLOR
				},
				success: {
					background: StyleTokenType.COLOR
				},
				warning: {
					background: StyleTokenType.COLOR
				},
				danger: {
					background: StyleTokenType.COLOR
				}
			},
			statusLabel: {
				neutral: {
					text: StyleTokenType.COLOR
				},
				info: {
					text: StyleTokenType.COLOR
				},
				success: {
					text: StyleTokenType.COLOR
				},
				warning: {
					text: StyleTokenType.COLOR
				},
				danger: {
					text: StyleTokenType.COLOR
				}
			},
			amount: {
				positive: {
					text: StyleTokenType.COLOR
				},
				negative: {
					text: StyleTokenType.COLOR
				},
				neutral: {
					text: StyleTokenType.COLOR
				},
				inverted: {
					text: StyleTokenType.COLOR
				}
			},
			emptyList: {
				text: StyleTokenType.COLOR
			},
			navigationMenu: {
				background: StyleTokenType.COLOR
			},
			navigationMenuItem: {
				default: {
					background: StyleTokenType.COLOR,
					text: StyleTokenType.COLOR
				},
				active: {
					background: StyleTokenType.COLOR,
					text: StyleTokenType.COLOR
				}
			},
			tabs: {
				background: StyleTokenType.COLOR
			},
			tabsItem: {
				default: {
					text: StyleTokenType.COLOR
				},
				active: {
					text: StyleTokenType.COLOR,
					border: StyleTokenType.COLOR
				}
			},
			summary: {
				background: StyleTokenType.COLOR,
				text: StyleTokenType.COLOR
			},
			progress: {
				background: StyleTokenType.COLOR,
				bar: {
					default: StyleTokenType.COLOR,
					success: StyleTokenType.COLOR,
					warning: StyleTokenType.COLOR,
					danger: StyleTokenType.COLOR
				}
			},
			buttonCardEmbedded: {
				primary: {
					default: {
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR
					},
					disabled: {
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR
					}
				},
				neutral: {
					default: {
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR
					},
					disabled: {
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR
					}
				}
			},
			buttonSendReceive: {
				primary: {
					default: {
						background: StyleTokenType.COLOR,
						separator: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR
					},
					disabled: {
						background: StyleTokenType.COLOR,
						separator: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR
					}
				}
			},
			buttonSolid: {
				secondary: {
					default: {
						border: StyleTokenType.COLOR,
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR
					},
					pressed: {
						border: StyleTokenType.COLOR,
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR
					},
					disabled: {
						border: StyleTokenType.COLOR,
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR
					}
				},
				danger: {
					default: {
						border: StyleTokenType.COLOR,
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR
					},
					pressed: {
						border: StyleTokenType.COLOR,
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR
					},
					disabled: {
						border: StyleTokenType.COLOR,
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR
					}
				},
				warning: {
					default: {
						border: StyleTokenType.COLOR,
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR
					},
					pressed: {
						border: StyleTokenType.COLOR,
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR
					},
					disabled: {
						border: StyleTokenType.COLOR,
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR
					}
				},
				neutral: {
					default: {
						border: StyleTokenType.COLOR,
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR
					},
					pressed: {
						border: StyleTokenType.COLOR,
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR
					},
					disabled: {
						border: StyleTokenType.COLOR,
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR
					}
				}
			},
			buttonBordered: {
				secondary: {
					default: {
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR,
						border: StyleTokenType.COLOR
					},
					pressed: {
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR,
						border: StyleTokenType.COLOR
					},
					disabled: {
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR,
						border: StyleTokenType.COLOR
					}
				},
				danger: {
					default: {
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR,
						border: StyleTokenType.COLOR
					},
					pressed: {
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR,
						border: StyleTokenType.COLOR
					},
					disabled: {
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR,
						border: StyleTokenType.COLOR
					}
				},
				warning: {
					default: {
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR,
						border: StyleTokenType.COLOR
					},
					pressed: {
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR,
						border: StyleTokenType.COLOR
					},
					disabled: {
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR,
						border: StyleTokenType.COLOR
					}
				},
				neutral: {
					default: {
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR,
						border: StyleTokenType.COLOR
					},
					pressed: {
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR,
						border: StyleTokenType.COLOR
					},
					disabled: {
						background: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR,
						border: StyleTokenType.COLOR
					}
				}
			},
			control: {
				default: {
					default: {
						background: StyleTokenType.COLOR,
						label: StyleTokenType.COLOR,
						placeholder: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR,
						border: StyleTokenType.COLOR,
						surface: StyleTokenType.COLOR
					},
					focused: {
						background: StyleTokenType.COLOR,
						label: StyleTokenType.COLOR,
						placeholder: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR,
						border: StyleTokenType.COLOR,
						surface: StyleTokenType.COLOR
					},
					disabled: {
						background: StyleTokenType.COLOR,
						label: StyleTokenType.COLOR,
						placeholder: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR,
						border: StyleTokenType.COLOR,
						surface: StyleTokenType.COLOR
					}
				},
				danger: {
					default: {
						background: StyleTokenType.COLOR,
						label: StyleTokenType.COLOR,
						placeholder: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR,
						border: StyleTokenType.COLOR,
						surface: StyleTokenType.COLOR
					},
					focused: {
						background: StyleTokenType.COLOR,
						label: StyleTokenType.COLOR,
						placeholder: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR,
						border: StyleTokenType.COLOR,
						surface: StyleTokenType.COLOR
					},
					disabled: {
						background: StyleTokenType.COLOR,
						label: StyleTokenType.COLOR,
						placeholder: StyleTokenType.COLOR,
						text: StyleTokenType.COLOR,
						border: StyleTokenType.COLOR,
						surface: StyleTokenType.COLOR
					}
				}
			},
			controlErrorMessage: {
				text: StyleTokenType.COLOR
			},
			select: {
				default: {
					default: {
						background: StyleTokenType.COLOR
					},
					selected: {
						background: StyleTokenType.COLOR
					}
				}
			},
			chip: {
				default: {
					background: StyleTokenType.COLOR,
					text: StyleTokenType.COLOR
				},
				pressed: {
					background: StyleTokenType.COLOR,
					text: StyleTokenType.COLOR
				},
				active: {
					background: StyleTokenType.COLOR,
					text: StyleTokenType.COLOR
				}
			},
			tabSelector: {
				default: {
					background: StyleTokenType.COLOR,
					text: StyleTokenType.COLOR,
					border: StyleTokenType.COLOR
				},
				pressed: {
					background: StyleTokenType.COLOR,
					text: StyleTokenType.COLOR
				},
				active: {
					background: StyleTokenType.COLOR,
					text: StyleTokenType.COLOR
				}
			},
			link: {
				default: {
					default: {
						text: StyleTokenType.COLOR
					},
					pressed: {
						text: StyleTokenType.COLOR
					},
					disabled: {
						text: StyleTokenType.COLOR
					}
				}
			}
		}
	},
	Sizes: {
		Semantic: {
			borderWidth: {
				none: StyleTokenType.SIZE,
				s: StyleTokenType.SIZE,
				m: StyleTokenType.SIZE,
				l: StyleTokenType.SIZE
			},
			borderRadius: {
				none: StyleTokenType.SIZE,
				xs: StyleTokenType.SIZE,
				s: StyleTokenType.SIZE,
				m: StyleTokenType.SIZE,
				l: StyleTokenType.SIZE,
				xl: StyleTokenType.SIZE,
				xxl: StyleTokenType.SIZE,
				round: StyleTokenType.SIZE
			},
			spacing: {
				none: StyleTokenType.SIZE,
				xs: StyleTokenType.SIZE,
				s: StyleTokenType.SIZE,
				m: StyleTokenType.SIZE,
				l: StyleTokenType.SIZE,
				xl: StyleTokenType.SIZE,
				xxl: StyleTokenType.SIZE
			},
			controlHeight: {
				s: StyleTokenType.SIZE,
				m: StyleTokenType.SIZE
			},
			circleControlSize: {
				s: StyleTokenType.SIZE,
				m: StyleTokenType.SIZE,
				l: StyleTokenType.SIZE,
				xl: StyleTokenType.SIZE
			},
			selectHeight: {
				m: StyleTokenType.SIZE
			},
			avatarHeight: {
				s: StyleTokenType.SIZE,
				m: StyleTokenType.SIZE,
				l: StyleTokenType.SIZE,
				xl: StyleTokenType.SIZE
			},
			layoutPadding: {
				none: StyleTokenType.SIZE,
				s: StyleTokenType.SIZE,
				m: StyleTokenType.SIZE,
				l: StyleTokenType.SIZE,
				xl: StyleTokenType.SIZE,
				xxl: StyleTokenType.SIZE
			},
			layoutSpacing: {
				none: StyleTokenType.SIZE,
				xs: StyleTokenType.SIZE,
				s: StyleTokenType.SIZE,
				m: StyleTokenType.SIZE,
				l: StyleTokenType.SIZE,
				xl: StyleTokenType.SIZE,
				xxl: StyleTokenType.SIZE,
				xxxl: StyleTokenType.SIZE,
				xxxxl: StyleTokenType.SIZE
			},
			headerHeight: {
				m: StyleTokenType.SIZE
			},
			navigationMenuHeight: {
				m: StyleTokenType.SIZE
			},
			iconSize: {
				xxs: StyleTokenType.SIZE,
				xs: StyleTokenType.SIZE,
				s: StyleTokenType.SIZE,
				m: StyleTokenType.SIZE,
				l: StyleTokenType.SIZE,
				xl: StyleTokenType.SIZE
			},
			qrCodeSize: {
				s: StyleTokenType.SIZE,
				m: StyleTokenType.SIZE,
				l: StyleTokenType.SIZE
			}
		},
		Components: {
			accountCard: {
				borderRadius: StyleTokenType.SIZE
			},
			accountCardWidget: {
				borderRadius: StyleTokenType.SIZE
			},
			actionCard: {
				borderRadius: StyleTokenType.SIZE
			},
			button: {
				borderRadius: StyleTokenType.SIZE
			},
			card: {
				borderRadius: StyleTokenType.SIZE
			},
			circleIcon: {
				s: {
					surface: {
						size: StyleTokenType.SIZE
					},
					icon: {
						size: StyleTokenType.SIZE
					}
				},
				m: {
					surface: {
						size: StyleTokenType.SIZE
					},
					icon: {
						size: StyleTokenType.SIZE
					}
				}
			},
			control: {
				borderRadius: StyleTokenType.SIZE,
				borderWidth: StyleTokenType.SIZE
			},
			listItem: {
				borderRadius: StyleTokenType.SIZE
			},
			settingsListItem: {
				borderRadius: StyleTokenType.SIZE
			},
			widget: {
				borderRadius: StyleTokenType.SIZE
			}
		}
	},
	Shadows: {
		Components: {
			accountCard: StyleTokenType.SHADOW,
			accountCardWidget: StyleTokenType.SHADOW,
			buttonCircle: StyleTokenType.SHADOW,
			card: StyleTokenType.SHADOW,
			control: StyleTokenType.SHADOW,
			filter: StyleTokenType.SHADOW,
			header: StyleTokenType.SHADOW,
			listItem: StyleTokenType.SHADOW,
			navigationMenu: StyleTokenType.SHADOW,
			settingsListItem: StyleTokenType.SHADOW,
			widget: StyleTokenType.SHADOW
		}
	},
	Typography: {
		Semantic: {
			body: {
				xs: StyleTokenType.TEXT_STYLE,
				s: StyleTokenType.TEXT_STYLE,
				m: StyleTokenType.TEXT_STYLE,
				l: StyleTokenType.TEXT_STYLE,
				xl: StyleTokenType.TEXT_STYLE
			},
			bodyBold: {
				xs: StyleTokenType.TEXT_STYLE,
				s: StyleTokenType.TEXT_STYLE,
				m: StyleTokenType.TEXT_STYLE,
				l: StyleTokenType.TEXT_STYLE,
				xl: StyleTokenType.TEXT_STYLE
			},
			title: {
				s: StyleTokenType.TEXT_STYLE,
				m: StyleTokenType.TEXT_STYLE,
				l: StyleTokenType.TEXT_STYLE
			},
			button: {
				s: StyleTokenType.TEXT_STYLE,
				m: StyleTokenType.TEXT_STYLE
			},
			link: {
				s: StyleTokenType.TEXT_STYLE,
				m: StyleTokenType.TEXT_STYLE
			},
			input: {
				m: StyleTokenType.TEXT_STYLE
			},
			label: {
				xs: StyleTokenType.TEXT_STYLE,
				s: StyleTokenType.TEXT_STYLE,
				m: StyleTokenType.TEXT_STYLE
			},
			mnemonic: {
				m: StyleTokenType.TEXT_STYLE
			}
		}
	}
};
