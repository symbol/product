import argparse
import sys

from symbolchain.facade.NemFacade import NemFacade
from symbolchain.facade.SymbolFacade import SymbolFacade

from .AccountPrinter import AccountPrinter
from .AddressGenerator import AddressGenerator
from .MultiAddressMatcher import MultiAddressMatcher

MAX_WALLET_ACCOUNTS = 10


def create_printer(args, network):
	format_mode = AccountPrinter.FormatMode.CSV if 'csv' == args.format else AccountPrinter.FormatMode.PRETTY
	printer = AccountPrinter(network, format_mode)
	if args.out:
		printer.outfiles.append(open(args.out, 'wt', encoding='utf8'))  # pylint: disable=consider-using-with

	if not args.suppress_console:
		printer.outfiles.append(sys.stdout)

	return printer


def main(args):
	parser = argparse.ArgumentParser(
		prog=None if globals().get('__spec__') is None else f'python -m {__spec__.name.partition(".")[0]}',
		description='Symbol Vanity Address Generator'
	)
	parser.add_argument('--blockchain', help='blockchain to target', choices=('symbol', 'nem'), default='symbol')
	parser.add_argument('--network', help='network to target', choices=('testnet', 'mainnet'), default='mainnet')
	parser.add_argument('--patterns', help='patterns to match (comma delimited)', required=True)
	parser.add_argument('--max-offset', help='maximum offset of match start', default=2)
	parser.add_argument('--format', help='output format', choices=('pretty', 'csv'), default='pretty')
	parser.add_argument('--suppress-console', help='suppress printing matches to console', action='store_true')
	parser.add_argument('--out', help='output file')
	args = parser.parse_args(args)

	facade = (SymbolFacade if 'symbol' == args.blockchain else NemFacade)(args.network)

	try:
		printer = create_printer(args, facade.network)
		printer.write_header()

		generator = AddressGenerator(facade, MAX_WALLET_ACCOUNTS, printer.write_account)

		matcher = MultiAddressMatcher(facade.network, args.max_offset, print)
		for pattern in args.patterns.split(','):
			matcher.add_search_pattern(pattern)

		print('generating accounts (this will take a while)...')
		generator.match_all(matcher)
	finally:
		for outfile in printer.outfiles:
			if '<stdout>' != outfile.name:
				outfile.close()


if '__main__' == __name__:
	main(sys.argv[1:])
