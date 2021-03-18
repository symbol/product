import os
import sys

import yaml

DEFAULT_SERVER_IMAGE = 'symbolplatform/symbol-server:gcc'
DEFAULT_REST_IMAGE = 'symbolplatform/symbol-rest:release'


def patch_compose(filepath, patch_cb):
    with open(filepath, 'rt', encoding='utf8') as input_file:
        docker_compose = yaml.load(input_file, Loader=yaml.SafeLoader)

    patch_cb(docker_compose)

    with open(filepath, 'wt', encoding='utf8') as output_file:
        output_file.write(yaml.dump(docker_compose, default_style='\'', sort_keys=False))


def patch_user(compose, container_names):
    if not sys.platform.startswith('win'):
        user_entry = f'{os.getuid()}:{os.getgid()}'
        for container in container_names:
            compose['services'][container]['user'] = user_entry


def patch_peer_server_image(compose):
    # use latest image
    compose['services']['server']['image'] = DEFAULT_SERVER_IMAGE
    patch_user(compose, ['server'])


def patch_api_server_image(compose):
    # use latest image
    for container in ['server', 'broker']:
        compose['services'][container]['image'] = DEFAULT_SERVER_IMAGE

    patch_user(compose, ['db', 'initiate', 'server', 'broker', 'node'])

    compose['services']['node']['image'] = DEFAULT_REST_IMAGE


def patch_peer_compose(filepath):
    patch_compose(filepath, patch_peer_server_image)


def patch_api_compose(filepath):
    patch_compose(filepath, patch_api_server_image)
