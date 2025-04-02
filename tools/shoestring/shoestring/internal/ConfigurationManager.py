import configparser
import re
from pathlib import Path

from symbolchain.symbol.Network import NetworkTimestamp


class ConfigurationManager:
	"""Manages configuration properties files in a resources directory."""

	def __init__(self, resources):
		"""Creates a manager around a source directory."""

		self.source_directory = Path(resources)

		self.section_regex = re.compile(r'^\[(.*)\]$')
		self.key_regex = re.compile(r'^(\S+)(\s*)=\s*(.*)$')

	def lookup(self, filename, search_identifiers):
		"""Retrieves specific configuration values."""

		config_filepath = self.source_directory / filename

		current_section = None
		values = [None] * len(search_identifiers)
		with open(config_filepath, 'rt', encoding='utf8') as infile:
			for line in infile:
				for i, (section, key) in enumerate(search_identifiers):
					if current_section == section:
						key_match = self.key_regex.match(line)
						if key_match and key == key_match.group(1):
							values[i] = key_match.group(3)
							break

				section_match = self.section_regex.match(line)
				if section_match:
					current_section = section_match.group(1)

		return values

	def patch(self, filename, replacements):
		"""Patches the specified file with the specified replacements."""

		config_filepath = self.source_directory / filename

		lines = []
		current_section = None
		with open(config_filepath, 'rt', encoding='utf8') as infile:
			for line in infile:
				for section, key, value in replacements:
					if current_section != section:
						continue

					key_match = self.key_regex.match(line)
					if not key_match or key != key_match.group(1):
						continue

					spacing = key_match.group(2)
					line = f'{key}{spacing}={spacing}{value}'

				lines.append(line.strip())

				section_match = self.section_regex.match(line)
				if section_match:
					current_section = section_match.group(1)

		with open(config_filepath, 'wt', encoding='utf8') as outfile:
			outfile.write('\n'.join(lines))
			outfile.write('\n')


def load_patches_from_file(filename):
	"""Loads patch information from a file."""

	parser = configparser.ConfigParser()
	parser.optionxform = str  # configure case-sensitive keys
	parser.read(filename)

	patches = {}
	for section in parser.sections():
		separator_index = section.index('.')
		group_name = section[:separator_index]
		local_section_name = section[separator_index + 1:]

		if group_name not in patches:
			patches[group_name] = []

		patches[group_name].extend([(local_section_name, key, parser[section][key]) for key in parser[section]])

	return patches


def load_shoestring_patches_from_file(filename, only_sections=None):
	"""Loads patch information from ini file."""

	parser = configparser.ConfigParser()
	parser.optionxform = str  # configure case-sensitive keys
	parser.read(filename)

	sections = parser.sections() if only_sections is None else only_sections
	patches = []
	for section in sections:
		patches.extend([(section, key, parser[section][key]) for key in parser[section]])

	return patches


def parse_time_span(str_value):
	"""Parses a time span configuration value."""

	if not str_value:
		raise ValueError('cannot parse empty string')

	unit_indicator = str_value[-1]
	value = NetworkTimestamp(0)
	if 's' == unit_indicator:
		if len(str_value) > 2 and 'm' == str_value[-2]:
			value = value.add_milliseconds(int(str_value[:-2]))
		else:
			value = value.add_seconds(int(str_value[:-1]))
	elif 'm' == unit_indicator:
		value = value.add_minutes(int(str_value[:-1]))
	elif 'h' == unit_indicator:
		value = value.add_hours(int(str_value[:-1]))
	else:
		raise ValueError(f'time span specified in unknown units \'{unit_indicator}\'')

	return value.timestamp


def merge_json_configuration(lhs, rhs):
	"""Merges two json configuration objects."""

	for key in rhs.keys():
		if isinstance(rhs[key], dict) and key in lhs and isinstance(lhs[key], dict):
			merge_json_configuration(lhs[key], rhs[key])
		else:
			lhs[key] = rhs[key]
