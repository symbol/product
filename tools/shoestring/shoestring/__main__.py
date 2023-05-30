import argparse
import asyncio
import importlib
import sys


def register_subcommand(subparsers, name, help_text):
	parser = subparsers.add_parser(name, help=help_text)
	module = importlib.import_module(f'shoestring.commands.{name.replace("-", "_")}')
	module.add_arguments(parser)


def parse_args(args):
	parser = argparse.ArgumentParser(description='Shoestring Tool')
	subparsers = parser.add_subparsers(title='subcommands', help='valid subcommands')

	register_subcommand(subparsers, 'pemtool', 'generates PEM files')
	register_subcommand(subparsers, 'renew-voting-keys', 'renews voting keys')
	register_subcommand(subparsers, 'reset-data', 'resets data to allow a resync from scratch')
	register_subcommand(subparsers, 'setup', 'sets up a node')
	register_subcommand(subparsers, 'signer', 'signs a transaction')

	return parser.parse_args(args)


async def main(args):
	args = parse_args(args)
	possible_task = args.func(args)
	if possible_task:
		await possible_task


if '__main__' == __name__:
	asyncio.run(main(sys.argv[1:]))
