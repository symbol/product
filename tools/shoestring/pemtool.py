#!/usr/bin/env python3

import argparse
import getpass
from binascii import unhexlify
from pathlib import Path

from symbolchain.CryptoTypes import PrivateKey
from symbolchain.PrivateKeyStorage import PrivateKeyStorage


def read_key(filename):
    return open(filename, 'rt', encoding='utf8').read()


def get_private_key(filename):
    private_key = getpass.getpass('Enter private key (in hex): ') if not filename else read_key(filename)
    return private_key.strip()


def main():
    parser = argparse.ArgumentParser(description='PEM tool')
    parser.add_argument('--output', help='output PEM key file', required=True)
    parser.add_argument('--input', help='input private key file (optional)')
    parser.add_argument('--ask-pass', help='encrypt PEM with a password (password prompt will be shown)', action='store_true')
    parser.add_argument('--force', help='overwrite output file if it already exists', action='store_true')
    args = parser.parse_args()

    output_name = args.output
    if output_name.endswith('.pem'):
        output_name = output_name[:-4]

    filepath = Path(output_name + '.pem')
    if filepath.exists() and not args.force:
        raise FileExistsError(f'output file ({filepath}) already exists, use --force to overwrite')

    private_key = PrivateKey(unhexlify(get_private_key(args.input)))

    password = None
    if args.ask_pass:
        password = getpass.getpass(f'Provide {filepath} password: ')
        confirmation = getpass.getpass(f'Confirm {filepath} password: ')
        if confirmation != password:
            raise RuntimeError('Provided passwords do not match')

    storage = PrivateKeyStorage('.', password)
    storage.save(output_name, private_key)
    print(f'saved {filepath}')


if __name__ == '__main__':
    main()
