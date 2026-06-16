import importlib.util
from pathlib import Path

_NODE_CONFIG_PATH = Path(__file__).resolve().parents[4] / 'common' / 'symbol' / 'NodeConfig.py'
_NODE_CONFIG_SPEC = importlib.util.spec_from_file_location('common_symbol_node_config', _NODE_CONFIG_PATH)
_node_config = importlib.util.module_from_spec(_NODE_CONFIG_SPEC)
_NODE_CONFIG_SPEC.loader.exec_module(_node_config)

SymbolNodeConfig = _node_config.SymbolNodeConfig
SymbolNodeConfigError = _node_config.SymbolNodeConfigError
socket = _node_config.socket
