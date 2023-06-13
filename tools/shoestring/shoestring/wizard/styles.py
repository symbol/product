from prompt_toolkit.styles import Style


def initialize():
	return Style([
		('titlebar', 'fg:black bg:white'),
		('navigation', 'bg:ansiblue'),

		('button', 'bg:white fg:black'),
		('button.arrow', 'fg:ansiblue'),
		('button button.focused', 'bg:ansiwhite fg:ansibrightgreen bold'),

		('shadow', 'bg:black fg:black')  # doesn't seem to be working
	])
