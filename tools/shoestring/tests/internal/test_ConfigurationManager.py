import tempfile
import unittest
from pathlib import Path

from shoestring.internal.ConfigurationManager import ConfigurationManager, load_patches_from_file, parse_time_span


class ConfigurationManagerTest(unittest.TestCase):
	# region test constants

	CONFIG_LINES_WITH_DISTINCT_KEYS = [
		'[operating_systems]',
		'ubuntuCore = 22.04',
		'fedora = 36',
		'debian = 11.4',
		'',
		'[build_tools]',
		'boost = 80',
		'cmake = 3.23.2',
		'gosu = 1.14'
	]

	CONFIG_LINES_WITH_SAME_KEY_IN_MULTIPLE_GROUPS = [  # pylint: disable=invalid-name
		'[group1]',
		'ubuntuCore = 22.04',
		'fedora = 36',
		'debian = 11.4',
		'',
		'[group2]',
		'ubuntuCore = 20.04',
		'fedora = 30',
		'debian = 10.4',
	]

	# endregion

	# region ctor

	def test_can_create_config_manager(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			# Act:
			manager = ConfigurationManager(temp_directory)

			# Assert:
			self.assertEqual(Path(temp_directory), manager.source_directory)

	# endregion

	# region lookup

	def _assert_lookup(self, original_lines, search_identifiers, expected_values):
		with tempfile.TemporaryDirectory() as temp_directory:
			manager = ConfigurationManager(temp_directory)

			with open(Path(temp_directory) / 'foo.properties', 'wt', encoding='utf8') as outfile:
				outfile.write('\n'.join(original_lines))

			# Act:
			values = manager.lookup('foo.properties', search_identifiers)

			# Assert:
			self.assertEqual(expected_values, values)

	def test_can_lookup_value(self):
		# Arrange:
		search_identifiers = [
			('operating_systems', 'fedora'),
			('build_tools', 'boost')
		]
		expected_values = ['36', '80']

		# Act + Assert:
		self._assert_lookup(self.CONFIG_LINES_WITH_DISTINCT_KEYS, search_identifiers, expected_values)

	def test_can_lookup_empty_value(self):
		# Arrange:
		search_identifiers = [
			('operating_systems', ''),
			('build_tools', '')
		]
		expected_values = [None, None]

		# Act + Assert:
		self._assert_lookup(self.CONFIG_LINES_WITH_DISTINCT_KEYS, search_identifiers, expected_values)

	def test_can_lookup_value_with_shared_cross_section_key(self):
		# Arrange:
		search_identifiers = [
			('group1', 'fedora'),
			('group2', 'fedora')
		]
		expected_values = ['36', '30']

		# Act + Assert:
		self._assert_lookup(self.CONFIG_LINES_WITH_SAME_KEY_IN_MULTIPLE_GROUPS, search_identifiers, expected_values)

	def test_cannot_lookup_unspecified_value(self):
		# Arrange:
		search_identifiers = [
			('tool', 'fedora'),
			('build_tools', 'make')
		]
		expected_values = [None, None]

		# Act + Assert:
		self._assert_lookup(self.CONFIG_LINES_WITH_DISTINCT_KEYS, search_identifiers, expected_values)

	# endregion

	# region patch

	def _assert_patching(self, original_lines, replacements, expected_lines):
		with tempfile.TemporaryDirectory() as temp_directory:
			manager = ConfigurationManager(temp_directory)

			with open(Path(temp_directory) / 'foo.properties', 'wt', encoding='utf8') as outfile:
				outfile.write('\n'.join(original_lines))

			# Act:
			manager.patch('foo.properties', replacements)

			with open(Path(temp_directory) / 'foo.properties', 'rt', encoding='utf8') as infile:
				contents = infile.read()

			# Assert:
			self.assertEqual('\n'.join(expected_lines), contents)

	def test_can_patch_file(self):
		# Arrange:
		replacements = [
			('operating_systems', 'fedora', '37'),
			('build_tools', 'boost', '70'),
			('build_tools', 'gosu', 'XYZ')
		]
		expected_lines = [
			'[operating_systems]',
			'ubuntuCore = 22.04',
			'fedora = 37',
			'debian = 11.4',
			'',
			'[build_tools]',
			'boost = 70',
			'cmake = 3.23.2',
			'gosu = XYZ',
			''
		]

		# Act + Assert:
		self._assert_patching(self.CONFIG_LINES_WITH_DISTINCT_KEYS, replacements, expected_lines)

	def test_can_patch_file_with_shared_cross_section_keys(self):
		# Arrange:
		replacements = [
			('group1', 'fedora', '37'),
			('group2', 'ubuntuCore', '18.04'),
			('group2', 'debian', 'XYZ')
		]
		expected_lines = [
			'[group1]',
			'ubuntuCore = 22.04',
			'fedora = 37',
			'debian = 11.4',
			'',
			'[group2]',
			'ubuntuCore = 18.04',
			'fedora = 30',
			'debian = XYZ',
			''
		]

		# Act + Assert:
		self._assert_patching(self.CONFIG_LINES_WITH_SAME_KEY_IN_MULTIPLE_GROUPS, replacements, expected_lines)

	# endregion

	# region load_patches_from_file

	def test_can_load_patches_from_file_well_formed(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			properties_filepath = Path(temp_directory) / 'foo.properties'
			with open(properties_filepath, 'wt', encoding='utf8') as outfile:
				outfile.write('\n'.join([
					'[machine.operating_systems]',
					'ubuntuCore = 22.04',
					'fedora = 36',
					'debian = 11.4',
					'',
					'[build.build_tools.cpp]',
					'boost = 80',
					'',
					'[build.build_tools.all]',
					'cmake = 3.23.2',
					'gosu = 1.14'
				]))

			# Act:
			patches = load_patches_from_file(properties_filepath)

			# Assert:
			self.assertEqual({
				'machine': [
					('operating_systems', 'ubuntuCore', '22.04'),
					('operating_systems', 'fedora', '36'),
					('operating_systems', 'debian', '11.4')
				],
				'build': [
					('build_tools.cpp', 'boost', '80'),
					('build_tools.all', 'cmake', '3.23.2'),
					('build_tools.all', 'gosu', '1.14')
				]
			}, patches)

	def _assert_cannot_load_patches_from_file(self, lines):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			properties_filepath = Path(temp_directory) / 'foo.properties'
			with open(properties_filepath, 'wt', encoding='utf8') as outfile:
				outfile.write('\n'.join(lines))

			# Act + Assert:
			with self.assertRaises(Exception):
				load_patches_from_file(properties_filepath)

	def test_cannot_load_patches_from_file_malformed_ini(self):
		self._assert_cannot_load_patches_from_file([
			'ubuntuCore = 22.04',
			'fedora = 36',
			'debian = 11.4',
			'',
			'[build.build_tools.cpp]',
			'boost = 80'
		])

	def test_cannot_load_patches_from_file_malformed_section_header(self):
		self._assert_cannot_load_patches_from_file([
			'[machineoperating_systems]',
			'ubuntuCore = 22.04',
			'fedora = 36',
			'debian = 11.4',
			'',
			'[build.build_tools.cpp]',
			'boost = 80'
		])

	# endregion

	# region parse_time_span

	def test_can_parse_valid_time_span(self):
		self.assertEqual(1234, parse_time_span('1234ms'))
		self.assertEqual(1234 * 1000, parse_time_span('1234s'))
		self.assertEqual(1234 * 1000 * 60, parse_time_span('1234m'))
		self.assertEqual(1234 * 1000 * 60 * 60, parse_time_span('1234h'))

	def test_cannot_parse_invalid_time_span(self):
		for invalid_str in ('12H4s', '', 's', '1234g'):
			with self.assertRaises(ValueError):
				parse_time_span(invalid_str)

	# endregion
