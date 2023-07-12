from .screen_loader import lookup_screens_list_for_operation


def create_next_clicked_handler(screens, activate_screen, title_bar, next_button, exit_handler):
	"""Moves to next screen."""

	def handler():
		next_screen = screens.next()
		title_bar.update_navigation(screens)

		if 'end-screen' != screens.ordered[screens.current_id].screen_id:
			if hasattr(next_screen, 'reset'):
				next_screen.reset()
		else:
			operation = screens.get('welcome').operation
			allowed_screens_list = lookup_screens_list_for_operation(screens, operation)

			tokens = []
			for screen_id in allowed_screens_list:
				screen = screens.get(screen_id)
				if hasattr(screen, 'tokens'):
					tokens.extend(screen.tokens)

			next_screen.clear()
			for token in tokens:
				next_screen.add_setting(*token)

			next_button.text = _('wizard-button-finish')
			next_button.handler = exit_handler

		activate_screen(next_screen)

	return handler


def create_prev_clicked_handler(screens, activate_screen, title_bar, next_button, next_clicked):
	"""Moves to previous screen."""

	def handler():
		if screens.has_previous:
			print('has previous')
			previous_screen = screens.previous()
			title_bar.update_navigation(screens)

			activate_screen(previous_screen)
		else:
			print('has NO previous')
			title_bar.reset()

		# restore handler in case it got replaced
		next_button.handler = next_clicked
		next_button.text = _('wizard-button-next')

	return handler
