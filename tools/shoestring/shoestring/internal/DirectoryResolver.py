import os
from pathlib import Path


def _default_directory():
	return os.environ.get('SHOESTRING_HOME') or os.environ.get('HOME') or str(Path.cwd())


def resolve_directory(directory=None):
	"""Selects the installation directory, requiring an absolute SHOESTRING_HOME."""

	if directory is not None:
		return directory

	directory = _default_directory()
	if os.environ.get('SHOESTRING_HOME') and not Path(directory).is_absolute():
		raise ValueError(_('directory-error-home-not-absolute').format(directory=directory))

	return directory


def add_directory_argument(parser):
	"""Registers the installation directory option without validating unused defaults."""

	# argparse interpolates percent signs in help strings.
	default_path = _default_directory().replace('%', '%%')
	parser.add_argument('--directory', help=_('argument-help-directory').format(default_path=default_path))
