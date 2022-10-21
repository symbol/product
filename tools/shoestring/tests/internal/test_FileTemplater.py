import tempfile
import unittest
from pathlib import Path

import jinja2

from shoestring.internal.FileTemplater import apply_template


class PreparerTest(unittest.TestCase):
	def _assert_can_apply_template_to_file(self, input_lines, output_lines):
		# Arrange:
		with tempfile.TemporaryDirectory() as directory:
			input_filename = Path(directory) / 'input.txt'
			output_filename = Path(directory) / 'output.txt'
			with open(input_filename, 'wt', encoding='utf8') as outfile:
				outfile.write('\n'.join(input_lines))

			# Act:
			apply_template(input_filename, {
				'placeholder': 'template',
				'token_descriptor': 'replacement text'
			}, output_filename)

			# Assert:
			with open(output_filename, 'rt', encoding='utf8') as infile:
				text = infile.read()
				self.assertEqual('\n'.join(output_lines), text)

	def test_can_apply_template_with_perfect_formatting(self):
		self._assert_can_apply_template_to_file([
			'This is a {{ placeholder }} file, where all {{ token_descriptor }} tokens will be replaced.',
			'Outside of braces, placeholder tokens are not replaced.',
			'All {{ token_descriptor }} tokens are replaced in this file.'
		], [
			'This is a template file, where all replacement text tokens will be replaced.',
			'Outside of braces, placeholder tokens are not replaced.',
			'All replacement text tokens are replaced in this file.'
		])

	def test_can_apply_template_with_variable_whitespace(self):
		self._assert_can_apply_template_to_file([
			'This is a {{placeholder}} file, where all {{   token_descriptor }} tokens will be replaced.',
			'Outside of braces, placeholder tokens are not replaced.',
			'All {{ token_descriptor   }} tokens are replaced in this file.'
		], [
			'This is a template file, where all replacement text tokens will be replaced.',
			'Outside of braces, placeholder tokens are not replaced.',
			'All replacement text tokens are replaced in this file.'
		])

	def test_can_apply_template_when_some_variables_are_not_defined(self):
		self._assert_can_apply_template_to_file([
			'This is a{{ other_placeholder }} file, where all {{ token_descriptor }} tokens will be replaced.'
		], [
			'This is a file, where all replacement text tokens will be replaced.'
		])

	def test_cannot_apply_malformed_template(self):
		with self.assertRaises(jinja2.exceptions.TemplateSyntaxError):
			self._assert_can_apply_template_to_file([
				'This is a{{ other_placeholder file, where all {{ token_descriptor }} tokens will be replaced.'
			], None)
