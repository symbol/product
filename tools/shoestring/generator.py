#!/usr/bin/env python3

import argparse
import os
from pathlib import Path

from downloader import download_file
from NodeConfigurator import NodeConfigurator

NEMESIS_SEED = {
    'name': 'nemesis-seed.zip',
    'url': 'https://github.com/symbol/symbol/releases/download/client%2Fcatapult%2Fv1.0.0.0/nemesis-seed.zip',
    'hash': 'A58EDE0460B84D3B21FFE4F5F0F4CE109CF6476DAFB346D61F87C0152BFE9B4D'
            '382737A496553129CAA570B944392175A1B70C0A456ABB0974781F9F94209E5C'
}

MONGO_SCRIPTS = {
    'name': 'mongo-scripts.zip',
    'url': 'https://github.com/symbol/symbol/releases/download/client%2Fcatapult%2Fv1.0.0.0/mongo-scripts.zip',
    'hash': 'BCEEA933ED32BAD4F1D25F5CBA2116EE84DD286161FB31E6CBC75974D4665AC8'
            '2E93FF3F3188E736B125929CAC8D8D418E4092086E47D848FA43924B21A8D8AD'
}


def main():
    parser = argparse.ArgumentParser(description='Node configurator generator', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument('--mode', help='node type', choices=('api', 'peer', 'dual'), required=True)
    parser.add_argument('--voting', help='node will be voting', action='store_true')
    parser.add_argument('--harvesting', help='node will be harvesting', action='store_true')
    parser.add_argument('--output', help='output directory', default='../settings')
    parser.add_argument('--force', help='overwrite output directory', action='store_true')
    parser.add_argument('--ask-pass', help='ask about pass when loading pem key files', action='store_true')
    parser.add_argument('--network', help='network type', choices=('mainnet', 'testnet'), default='mainnet')
    args = parser.parse_args()

    if not Path(args.output).is_dir():
        os.makedirs(args.output, mode=0o700)

    feature_settings = {
        'voting': args.voting,
        'harvesting': args.harvesting,
        'ask-pass': args.ask_pass
    }
    configurator = NodeConfigurator(args.output, args.force, args.mode, feature_settings, args.network)
    download_file(configurator.dir, NEMESIS_SEED)
    download_file(configurator.dir, MONGO_SCRIPTS)
    configurator.run()


if __name__ == '__main__':
    main()
