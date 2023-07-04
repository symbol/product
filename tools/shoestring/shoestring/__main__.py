import argparse
import asyncio
import gettext
import importlib
import os
import sys


def register_subcommand(subparsers, name, help_text):
	parser = subparsers.add_parser(name, help=help_text)
	module = importlib.import_module(f'shoestring.commands.{name.replace("-", "_")}')
	module.add_arguments(parser)


def parse_args(args):
	parser = argparse.ArgumentParser(description=_('main-title'))
	subparsers = parser.add_subparsers(title='subcommands', help=_('main-subcommands-help'))

	register_subcommand(subparsers, 'announce-transaction', _('main-announce-transaction-help'))
	register_subcommand(subparsers, 'health', _('main-health-help'))
	register_subcommand(subparsers, 'import-bootstrap', _('main-import-bootstrap-help'))
	register_subcommand(subparsers, 'init', _('main-init-help'))
	register_subcommand(subparsers, 'min-cosignatures-count', _('main-min-cosignatures-count-help'))
	register_subcommand(subparsers, 'pemtool', _('main-pemtool-help'))
	register_subcommand(subparsers, 'renew-certificates', _('main-renew-certificates-help'))
	register_subcommand(subparsers, 'renew-voting-keys', _('main-renew-voting-keys-help'))
	register_subcommand(subparsers, 'reset-data', _('main-reset-data-help'))
	register_subcommand(subparsers, 'setup', _('main-setup-help'))
	register_subcommand(subparsers, 'signer', _('main-signer-help'))
	register_subcommand(subparsers, 'upgrade', _('main-upgrade-help'))

	return parser.parse_args(args)


async def main(args):
	lang = gettext.translation('messages', localedir='lang', languages=(os.environ.get('LC_MESSAGES', 'en'), 'en'))
	lang.install()

	args = parse_args(args)
	possible_task = args.func(args)
	if possible_task:
		await possible_task


if '__main__' == __name__:
	asyncio.run(main(sys.argv[1:]))
