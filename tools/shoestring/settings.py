# note: default settings assume: peer, non-voting, non-harvesting
import getpass
from pathlib import Path

from symbolchain.PrivateKeyStorage import PrivateKeyStorage

HARVESTING_KEY_FILENAME = 'private.harvesting'
VRF_KEY_FILENAME = 'private.vrf'


def get_txt_key(filename):
    return open(filename + '.txt', 'rt', encoding='utf8').read().strip()


def get_pem_key(ask_pass, filename):
    password = getpass.getpass(f'Provide {filename}.pem password: ') if ask_pass else None
    storage = PrivateKeyStorage('.', password)
    return str(storage.load(filename))


# region mode-dependent patching

def patch_api_recovery_extensions(config, **kwargs):
    del kwargs
    config['extensions']['extension.addressextraction'] = 'true'
    config['extensions']['extension.mongo'] = 'true'
    config['extensions']['extension.zeromq'] = 'true'


def patch_api_server_extensions(config, **kwargs):
    del kwargs
    config['extensions']['extension.filespooling'] = 'true'
    config['extensions']['extension.partialtransaction'] = 'true'
    config['extensions']['extension.harvesting'] = 'false'
    config['extensions']['extension.syncsource'] = 'false'


def patch_api_node_common(config, **kwargs):
    del kwargs
    config['node']['enableAutoSyncCleanup'] = 'false'
    config['node']['trustedHosts'] = '127.0.0.1, 172.20.0.25'
    config['node']['localNetworks'] = '127.0.0.1, 172.20.0.25'


def patch_api_node(config, **kwargs):
    patch_api_node_common(config, **kwargs)
    config['localnode']['roles'] = 'Api'


def patch_dual_server_extensions(config, **kwargs):
    del kwargs
    config['extensions']['extension.filespooling'] = 'true'
    config['extensions']['extension.partialtransaction'] = 'true'


def patch_dual_node(config, **kwargs):
    patch_api_node_common(config, **kwargs)
    config['localnode']['roles'] = 'Peer,Api'

# endregion


# region feature dependent patching

def check_harvesting_files():
    if Path(HARVESTING_KEY_FILENAME + '.pem').is_file() and Path(VRF_KEY_FILENAME + '.pem').is_file():
        return

    if Path(HARVESTING_KEY_FILENAME + '.txt').is_file() and Path(VRF_KEY_FILENAME + '.txt').is_file():
        return

    raise RuntimeError(f'harvesting requested, but harvesting or vrf key files do not exist ({HARVESTING_KEY_FILENAME}, {VRF_KEY_FILENAME})'
                       ' (.pem or .txt)')


def patch_harvesting(config, **kwargs):
    ask_pass = kwargs.get('ask_pass', False)

    if Path(HARVESTING_KEY_FILENAME + '.pem').is_file() and Path(VRF_KEY_FILENAME + '.pem').is_file():
        harvesting_private_key = get_pem_key(ask_pass, HARVESTING_KEY_FILENAME)
        vrf_private_key = get_pem_key(ask_pass, VRF_KEY_FILENAME)
    else:
        harvesting_private_key = get_txt_key(HARVESTING_KEY_FILENAME)
        vrf_private_key = get_txt_key(VRF_KEY_FILENAME)

    config['harvesting']['enableAutoHarvesting'] = 'true'
    config['harvesting']['harvesterSigningPrivateKey'] = harvesting_private_key
    config['harvesting']['harvesterVrfPrivateKey'] = vrf_private_key


def patch_voting(config, **kwargs):
    del kwargs
    config['finalization']['enableVoting'] = 'true'
    config['finalization']['unfinalizedBlocksDuration'] = '0m'


def patch_voting_node(config, **kwargs):
    del kwargs
    config['localnode']['roles'] += ',Voting'

# endregion


role_settings = {
    'peer': {
        'filtered': ['database', 'pt', 'extensions-broker', 'logging-broker', 'messaging']
    },
    'api': {
        'filtered': ['harvesting'],
        'patches': {
            'extensions-server':  patch_api_server_extensions,
            'extensions-recovery': patch_api_recovery_extensions,
            'node':  patch_api_node,
        }
    },
    'dual': {
        'filtered': [],
        'patches': {
            'extensions-server': patch_dual_server_extensions,
            'extensions-recovery': patch_api_recovery_extensions,
            'node':  patch_dual_node,
        }
    }
}
node_settings = {
    'harvesting': {
        'harvesting': patch_harvesting
    },
    'voting': {
        'finalization': patch_voting,
        'node': patch_voting_node
    }
}
