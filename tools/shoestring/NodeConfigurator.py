import json
import os
import random
import re
import shutil
from pathlib import Path
from zipfile import ZipFile

from zenlog import log

from compose import patch_api_compose, patch_peer_compose
from patcher import patch_config
from settings import check_harvesting_files, node_settings, role_settings


def to_short_name(filename):
    return filename.name[len('config-'):-len('.properties')]


def select_random_peers(source, destination, count):
    all_nodes = None
    with open(source, 'rt', encoding='utf8') as input_file:
        all_nodes = json.load(input_file)

    random.shuffle(all_nodes['knownPeers'])
    num_nodes = min(len(all_nodes['knownPeers']), count)
    all_nodes['knownPeers'] = all_nodes['knownPeers'][:num_nodes]

    with open(destination, 'wt', encoding='utf8') as output_file:
        json.dump(all_nodes, output_file, indent=4)


class NodeConfigurator:
    def __init__(self, output_directory, force_output, node_mode, feature_settings, network):
        self.templates = Path(__file__).parent / 'templates'
        self.startup = Path(__file__).parent / 'startup'
        self.dir = Path(output_directory)
        self.force_dir = force_output
        self.mode = node_mode
        self.network = network

        self.is_voting = feature_settings['voting']
        self.is_harvesting = feature_settings['harvesting']
        self.ask_pass = feature_settings['ask-pass']

    def check_harvesting_requirements(self):
        if not self.is_harvesting:
            return

        check_harvesting_files()

    def check_voting_requirements(self):
        if not self.is_voting:
            return

        num_voting_key_files = sum([1 for _ in Path('.').glob('private_key_tree*.dat')])
        num_destination_key_files = sum([1 for _ in Path(self.dir / 'votingkeys').glob('private_key_tree*.dat')])

        if 0 == num_voting_key_files and 0 == num_destination_key_files:
            raise RuntimeError('no voting key files found, neither in current dir nor in destination directory')

    def check_requirements(self):
        self.check_harvesting_requirements()
        self.check_voting_requirements()

        certs = Path('certificates')
        num_files_all = sum(1 for _ in certs.glob('**/*'))
        num_files = sum(1 for _ in certs.glob('*'))

        # currently 5, cause rest expects splitted crt for some reason (verify)
        #
        if num_files_all != 5 or num_files != 5:
            raise RuntimeError('unexpected number of files in certificates directory, expect exactly 5 files')

        names = {file.name for file in certs.glob('*')}
        expected_names = set(['ca.pubkey.pem', 'node.full.crt.pem', 'node.key.pem', 'node.crt.pem', 'ca.crt.pem'])

        if names != expected_names:
            raise RuntimeError(f'expecting following files in certificates directory: {expected_names}')

    def unzip_nemesis(self):
        log.info('extracting nemesis seed')
        with ZipFile(self.dir / 'nemesis-seed.zip') as nemesis_package:
            nemesis_package.extractall(self.dir / 'nemesis')

    def prepare_resources(self):
        log.info('preparing base settings')
        destination = self.dir / 'resources'
        if destination.is_dir():
            if self.force_dir:
                shutil.rmtree(destination)
            else:
                raise FileExistsError('output directory already exists, use --force to overwrite')

        self._copy_and_patch_resources(destination)

        if self.is_harvesting:
            log.info('turning on harvesting')
            self.run_patches(node_settings['harvesting'])

        if self.is_voting:
            log.info('turning on voting')
            self.run_patches(node_settings['voting'])

    @staticmethod
    def copy_directory(source, destination, filter_cb=None):
        for filepath in source.glob('*'):
            if filter_cb and filter_cb(filepath):
                continue

            shutil.copy2(filepath, destination)
            os.chmod(destination / filepath.name, 0o600)

    def _copy_and_patch_resources(self, destination):
        source = self.templates / 'resources'
        os.makedirs(destination, 0o700)
        self.copy_directory(source, destination, lambda filepath: to_short_name(filepath) in role_settings[self.mode]['filtered'])

        network_resources = self.templates / f'{self.network}/resources'
        self.copy_directory(network_resources, destination)

        if 'peer' == self.mode:
           return

        self.run_patches(role_settings[self.mode]['patches'])

    def run_patches(self, patch_map):
        for short_name, patch_cb in patch_map.items():
            patch_config(self.dir, short_name, patch_cb, ask_pass=self.ask_pass)

    def prepare_peers(self):
        num_peers = 20
        destination = self.dir / 'resources'
        for role in ['api', 'p2p']:
            filename = f'peers-{role}.json'
            select_random_peers(self.templates / f'{self.network}/all-{filename}', destination / filename, num_peers)

    def create_subdir(self, dir_name):
        dir_path = self.dir / dir_name
        if dir_path.is_dir() and self.force_dir:
            shutil.rmtree(dir_path)

        os.makedirs(dir_path)

    def unzip_mongo_scripts(self):
        log.info('extracting mongo scripts')
        with ZipFile(self.dir / 'mongo-scripts.zip') as nemesis_package:
            nemesis_package.extractall(self.dir / 'mongo')

    def prepare_startup_files(self):
        docker_compose_path = self.dir / 'docker-compose.yml'
        if self.mode == 'peer':
            shutil.copy2(self.templates / 'docker-compose-peer.yml', docker_compose_path)
            patch_peer_compose(docker_compose_path)
        else:
            shutil.copy2(self.templates / 'docker-compose-dual.yml', docker_compose_path)
            patch_api_compose(docker_compose_path)

            self.create_subdir('startup')
            self.copy_directory(self.startup, self.dir / 'startup')

            self.unzip_mongo_scripts()

            self.create_subdir('dbdata')

        self.create_subdir('data')
        self.create_subdir('logs')

    def copy_certificates(self):
        log.info('copying certificates')
        self.create_subdir('certificates')
        self.copy_directory(Path('certificates'), self.dir / 'certificates')

    def find_next_free_id(self):
        # go through all the files, and return max id + 1
        first_free_id = 1
        for filepath in Path(self.dir / 'votingkeys').glob('private_key_tree*.dat'):
            match = re.match(r'private_key_tree(.*)\.dat', filepath.name)
            if match:
                first_free_id = max(first_free_id, int(match.group(1)) + 1)
        return first_free_id

    def move_voting_key_file(self):
        destination_directory = self.dir / 'votingkeys'
        if not destination_directory.is_dir():
            os.makedirs(destination_directory)

        matching_names = {}
        for filepath in Path('.').glob('private_key_tree*.dat'):
            match = re.match(r'private_key_tree(.*)\.dat', filepath.name)
            if match:
                matching_names[int(match.group(1))] = filepath

        for _, filepath in sorted(matching_names.items()):
            free_id = self.find_next_free_id()
            destination_filename = f'private_key_tree{free_id}.dat'
            destination_filepath = destination_directory / destination_filename
            shutil.move(filepath, destination_filepath)
            log.info(f'moving {filepath} -> {destination_filepath}')

    def run(self):
        self.check_requirements()
        self.unzip_nemesis()
        self.prepare_resources()
        self.prepare_peers()
        self.prepare_startup_files()
        self.copy_certificates()
        self.move_voting_key_file()
