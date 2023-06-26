from prompt_toolkit.styles import Style


def initialize():
	return Style([
		('titlebar', 'fg:black bg:white'),
		('navigation', 'bg:ansiblue'),

		('button', 'bg:ansiwhite fg:ansigray'),
		('button button.focused', 'bg:white fg:black bold'),

		('button button.inactive', 'bg:ansired fg:ansired'),
		('button button.focused button.focused.inactive', 'bg:ansired fg:ansired'),

		('button.arrow', 'fg:ansiblue'),

		('error', 'fg:ansibrightred bold'),

		('shadow', 'bg:black fg:black')  # doesn't seem to be working
	])
