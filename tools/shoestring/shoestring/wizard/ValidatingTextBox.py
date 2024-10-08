import ipaddress
import json
import socket
from pathlib import Path

from prompt_toolkit.filters import Always
from prompt_toolkit.validation import Validator
from prompt_toolkit.widgets import Label, TextArea
from symbolchain.CryptoTypes import PrivateKey

# region validators


def is_not_empty(value):
	"""Returns True when input is not empty."""

	return bool(value)


def is_file_path(value):
	"""Returns True when input is a valid file path."""

	return Path(value).is_file()


def does_not_exist(value):
	"""Returns True when input is not a path to existing filesystem object."""

	return not Path(value).exists() and Path(value).parent.absolute().is_dir()


def is_directory_path(value):
	"""Returns True when input is a valid directory path."""

	return Path(value).is_dir()


def is_integer(value):
	"""Returns True when input is an integer (without a sign)."""

	return value.isdigit()


def is_hex_private_key_string(value):
	"""Returns True when input is a valid directory path."""

	try:
		PrivateKey(value)
		return True
	except ValueError:
		return False


def is_ip_address(value):
	"""Returns True when input is a valid IP address."""

	try:
		ipaddress.ip_address(value)
		return True
	except ValueError:
		return False


def is_hostname(value):
	"""Returns True when input is a valid hostname."""

	if not value:
		return False

	try:
		socket.getaddrinfo(value, 7890)
		return True
	except socket.gaierror:
		return False


def is_json(value):
	"""Returns True when input is valid json."""

	if not value:
		return True

	try:
		json.loads(value)
		return True
	except ValueError:
		return False

# endregion


# region ValidatingTextBox

class ValidatingTextBox:
	"""Composed of a label and a text area with custom validation support."""

	def __init__(
		self,
		label_text,
		validator,
		validation_error_text,
		default_value='',
		multiline=False
	):  # pylint: disable=too-many-arguments,too-many-positional-arguments
		"""Creates a validating text box."""
		validator = validator if isinstance(validator, Validator) else Validator.from_callable(validator, validation_error_text)

		self.input = TextArea(
			default_value,
			multiline=multiline,
			validator=validator)
		self.input.buffer.validate_while_typing = Always()

		# window is already created and Label's style is only expected to be a string, so we need to modify
		# underlying window's style directly
		self.label = Label(label_text)
		self.label.window.style = lambda: 'class:label' if self.is_valid else 'class:label,error'

		# run validation against initial value
		self.input.buffer.validate()

	@property
	def is_valid(self):
		"""Returns True when entered input is valid."""

		return not self.input.buffer.validation_error

# endregion
