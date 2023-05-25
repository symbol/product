import configparser
from pathlib import Path


def prepare_shoestring_configuration(directory, node_features, services_nodewatch='', ca_password=''):
	"""Prepares a shoestring configuration file in the specified directory."""

	parser = configparser.ConfigParser()
	parser.read(Path('tests/resources/sai.shoestring.ini').absolute())

	parser['services']['nodewatch'] = str(services_nodewatch)

	node_features_str = str(node_features)
	parser['node']['features'] = node_features_str[node_features_str.index('.') + 1:]
	parser['node']['caPassword'] = f'pass:{ca_password}' if ca_password else ''

	output_filepath = Path(directory) / 'sai.shoestring.ini'
	with open(output_filepath, 'wt', encoding='utf8') as outfile:
		parser.write(outfile)

	return output_filepath
