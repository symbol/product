import argparse
import asyncio
import sys

from .commands.pemtool import add_arguments as add_pemtool_arguments
from .commands.reset_data import add_arguments as add_reset_data_arguments
from .commands.setup import add_arguments as add_setup_arguments
from .commands.signer import add_arguments as add_signer_arguments


def parse_args(args):
	parser = argparse.ArgumentParser(description='Shoestring Tool')
	subparsers = parser.add_subparsers(title='subcommands', help='valid subcommands')

	parser_pemtool = subparsers.add_parser('pemtool', help='generates PEM files')
	add_pemtool_arguments(parser_pemtool)

	parser_reset_data = subparsers.add_parser('reset-data', help='resets data to allow a resync from scratch')
	add_reset_data_arguments(parser_reset_data)

	parser_setup = subparsers.add_parser('setup', help='sets up a node')
	add_setup_arguments(parser_setup)

	parser_signer = subparsers.add_parser('signer', help='signs a transaction')
	add_signer_arguments(parser_signer)

	return parser.parse_args(args)


async def main(args):
	args = parse_args(args)
	possible_task = args.func(args)
	if possible_task:
		await possible_task


if '__main__' == __name__:
	asyncio.run(main(sys.argv[1:]))
