from jinja2 import Template


def apply_template(input_filename, mappings, output_filename):
	"""Fills in variables in an input file template and produces an output file."""

	with open(input_filename, 'rt', encoding='utf8') as infile:
		with open(output_filename, 'wt', encoding='utf8') as outfile:
			Template(infile.read()).stream(**mappings).dump(outfile)
