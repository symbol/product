import shutil


def write_node_key_file(factory, import_source=None):
	"""Write node private key file."""

	if import_source:
		shutil.copy(import_source, '.')
		return

	if not factory:
		raise RuntimeError('unable to generate node private key')

	factory.generate_random_node_private_key()
