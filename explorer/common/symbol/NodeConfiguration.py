import ipaddress
import socket
from collections import namedtuple
from urllib.parse import urlparse

NormalizedNode = namedtuple('NormalizedNode', ['scheme', 'host', 'port', 'base_url'])


class SymbolNodeConfigurationError(ValueError):
	"""Raised when Symbol node access config is invalid."""


def _parse_bool(value):
	if isinstance(value, bool):
		return value

	normalized_value = str(value).lower()
	if normalized_value == 'true':
		return True

	if normalized_value == 'false':
		return False

	raise SymbolNodeConfigurationError('Boolean config values must be either true or false')


def _parse_positive_int(name, value):
	try:
		parsed_value = int(value)
	except (TypeError, ValueError) as error:
		raise SymbolNodeConfigurationError(f'{name} must be a positive integer') from error

	if parsed_value < 1:
		raise SymbolNodeConfigurationError(f'{name} must be a positive integer')

	return parsed_value


def _normalize_base_url(node_url):
	parsed_url = urlparse(node_url)

	if parsed_url.scheme not in ('http', 'https'):
		raise SymbolNodeConfigurationError('Symbol node URL scheme must be http or https')
	if not parsed_url.hostname:
		raise SymbolNodeConfigurationError('Symbol node URL must include a host')
	if parsed_url.username or parsed_url.password:
		raise SymbolNodeConfigurationError('Symbol node URL must not include userinfo')
	if parsed_url.query or parsed_url.fragment:
		raise SymbolNodeConfigurationError('Symbol node URL must not include query or fragment')
	if parsed_url.path not in ('', '/'):
		raise SymbolNodeConfigurationError('Symbol node URL must not include a path prefix')

	try:
		port = parsed_url.port
	except ValueError as error:
		raise SymbolNodeConfigurationError('Symbol node URL port must be numeric') from error
	if port is None:
		raise SymbolNodeConfigurationError('Symbol node URL must include an explicit port')
	host = parsed_url.hostname.lower()

	return NormalizedNode(parsed_url.scheme, host, port, f'{parsed_url.scheme}://{host}:{port}')


def _normalize_allowed_hosts(raw_allowed_hosts):
	if not raw_allowed_hosts:
		raise SymbolNodeConfigurationError('SYMBOL_NODE_ALLOWED_HOSTS is required')

	allowed_hosts = set()
	for raw_entry in str(raw_allowed_hosts).split(','):
		entry = raw_entry.strip().lower()
		if not entry:
			continue
		if '://' in entry or '/' in entry or '?' in entry or '#' in entry or '*' in entry:
			raise SymbolNodeConfigurationError('SYMBOL_NODE_ALLOWED_HOSTS entries must be exact host:port values')

		host, separator, port = entry.rpartition(':')
		if not separator or not host or not port.isdigit():
			raise SymbolNodeConfigurationError('SYMBOL_NODE_ALLOWED_HOSTS entries must be exact host:port values')

		allowed_hosts.add(f'{host}:{int(port)}')

	if not allowed_hosts:
		raise SymbolNodeConfigurationError('SYMBOL_NODE_ALLOWED_HOSTS is required')

	return allowed_hosts


def _is_metadata_service_host(host):
	return host in {
		'169.254.169.254',
		'metadata.google.internal'
	}


def _is_forbidden_address(address):
	return any([
		address.is_link_local,
		address.is_multicast,
		address.is_unspecified,
		str(address) == '169.254.169.254'
	])


class SymbolNodeConfiguration:
	"""Validated Symbol node access configuration."""

	def __init__(self, **kwargs):
		self.scheme = kwargs['scheme']
		self.host = kwargs['host']
		self.port = kwargs['port']
		self.base_url = kwargs['base_url']
		self.allowed_hosts = kwargs['allowed_hosts']
		self.allow_private = kwargs.get('allow_private', False)
		self.allow_loopback = kwargs.get('allow_loopback', False)
		self.timeout_seconds = kwargs.get('timeout_seconds', 10)

	@classmethod
	def from_app_config(cls, app_config):
		"""Creates a node configuration from Flask-style app config."""

		node_url = app_config.get('SYMBOL_NODE_URL')
		if not node_url:
			raise SymbolNodeConfigurationError('Symbol node URL is not configured')

		return cls._from_values(app_config)

	@classmethod
	def from_url(cls, node_url, **kwargs):
		"""Creates a node config from an explicit node URL."""

		normalized_node = _normalize_base_url(node_url)
		return cls._from_normalized_values(
			normalized_node,
			{
				'SYMBOL_NODE_ALLOWED_HOSTS': f'{normalized_node.host}:{normalized_node.port}',
				'SYMBOL_NODE_ALLOW_PRIVATE': kwargs.get('allow_private', False),
				'SYMBOL_NODE_ALLOW_LOOPBACK': kwargs.get('allow_loopback', False),
				'SYMBOL_NODE_REQUEST_TIMEOUT_SECONDS': kwargs.get('timeout_seconds', 10)
			}
		)

	@classmethod
	def _from_values(cls, values):
		node_url = values.get('SYMBOL_NODE_URL')
		normalized_node = _normalize_base_url(node_url)
		return cls._from_normalized_values(
			normalized_node,
			values
		)

	@classmethod
	def _from_normalized_values(cls, normalized_node, values):
		allowed_hosts = _normalize_allowed_hosts(values.get('SYMBOL_NODE_ALLOWED_HOSTS'))
		normalized_host = f'{normalized_node.host}:{normalized_node.port}'

		if normalized_host not in allowed_hosts:
			raise SymbolNodeConfigurationError('Configured Symbol node host is not in SYMBOL_NODE_ALLOWED_HOSTS')
		if _is_metadata_service_host(normalized_node.host):
			raise SymbolNodeConfigurationError('Metadata service Symbol node host is not allowed')

		return cls(
			scheme=normalized_node.scheme,
			host=normalized_node.host,
			port=normalized_node.port,
			base_url=normalized_node.base_url,
			allowed_hosts=frozenset(allowed_hosts),
			allow_private=_parse_bool(values.get('SYMBOL_NODE_ALLOW_PRIVATE', 'false')),
			allow_loopback=_parse_bool(values.get('SYMBOL_NODE_ALLOW_LOOPBACK', 'false')),
			timeout_seconds=_parse_positive_int(
				'SYMBOL_NODE_REQUEST_TIMEOUT_SECONDS',
				values.get('SYMBOL_NODE_REQUEST_TIMEOUT_SECONDS', 10)
			)
		)

	def assert_request_allowed(self, request_url):
		"""Validates a Symbol node request target against the configured allowed hosts and address policy."""

		scheme, host, port, base_url = _normalize_base_url(request_url)
		if (scheme, host, port) != (self.scheme, self.host, self.port):
			raise SymbolNodeConfigurationError('Symbol node request target does not match configured base URL')

		for _, _, _, _, sockaddr in socket.getaddrinfo(host, port, type=socket.SOCK_STREAM):
			address = ipaddress.ip_address(sockaddr[0])
			if _is_forbidden_address(address):
				raise SymbolNodeConfigurationError('Resolved Symbol node address is not allowed')
			if address.is_loopback and not self.allow_loopback:
				raise SymbolNodeConfigurationError('Loopback Symbol node address requires SYMBOL_NODE_ALLOW_LOOPBACK=true')
			if address.is_private and not address.is_loopback and not self.allow_private:
				raise SymbolNodeConfigurationError('Private Symbol node address requires SYMBOL_NODE_ALLOW_PRIVATE=true')

		return base_url

	def to_dict(self):
		"""Returns safe runtime node configuration for health/status responses."""

		return {
			'baseUrl': self.base_url,
			'allowPrivate': self.allow_private,
			'allowLoopback': self.allow_loopback,
			'timeoutSeconds': self.timeout_seconds
		}
