import configparser
import re
from pathlib import Path


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
