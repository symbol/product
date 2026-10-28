import asyncio
import json
import socket
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from threading import Event, Thread
from unittest import TestCase

from aiohttp.resolver import AsyncResolver
from common.symbol.NodeConfiguration import SymbolNodeConfiguration

from rest.facade.HarvestingProperties import HarvestingProperties, HarvestingPropertiesUnavailable, load_harvesting_properties


class NodeHandler(BaseHTTPRequestHandler):
	Payload = {}
	Status = 200

	def do_GET(self):  # pylint: disable=invalid-name  # HTTPServer dispatches this method by name.
		self.send_response(self.Status)
		if 302 == self.Status:
			self.send_header('Location', 'http://127.0.0.1:1/network/properties')
		self.end_headers()
		self.wfile.write(json.dumps(self.Payload).encode('utf8'))

	def log_message(self, format, *args):  # pylint: disable=redefined-builtin,unused-argument
		pass


class RecordingResolver:
	"""A cancellable DNS source used at the actual connector boundary."""

	def __init__(self, address, family=socket.AF_INET, delay=0):
		self.address = address
		self.family = family
		self.delay = delay
		self.hosts = []
		self.cancelled = False
		self.closed = False

	async def resolve(self, host, port=0, family=socket.AF_INET):  # pylint: disable=unused-argument
		self.hosts.append(host)
		try:
			await asyncio.sleep(self.delay)
		except asyncio.CancelledError:
			self.cancelled = True
			raise
		return [{
			'hostname': host, 'host': self.address, 'port': port, 'family': self.family,
			'proto': 0, 'flags': socket.AI_NUMERICHOST
		}]

	async def close(self):
		self.closed = True


class HarvestingPropertiesTest(TestCase):
	@staticmethod
	def _load(payload, status=200):
		class Handler(NodeHandler):
			pass

		Handler.Payload = payload
		Handler.Status = status
		with HTTPServer(('127.0.0.1', 0), Handler) as server:
			thread = Thread(target=server.handle_request)
			thread.start()
			try:
				config = SymbolNodeConfiguration.from_url(f'http://127.0.0.1:{server.server_port}', allow_loopback=True)
				return load_harvesting_properties(config)
			finally:
				thread.join(timeout=5)

	def test_loads_grouped_atomic_values(self):
		self.assertEqual(HarvestingProperties(1000, 20000), self._load({'chain': {
			'minHarvesterBalance': "1'000", 'maxHarvesterBalance': "20'000"
		}}))

	def test_rejects_invalid_or_missing_properties(self):
		chain = {'minHarvesterBalance': '100', 'maxHarvesterBalance': '200'}
		for invalid in [None, '', '1.5', True, "12'34", '18446744073709551616']:
			with self.subTest(invalid=invalid), self.assertRaises(HarvestingPropertiesUnavailable):
				self._load({'chain': {**chain, 'minHarvesterBalance': invalid}})
		for field in chain:
			with self.subTest(missing=field), self.assertRaises(HarvestingPropertiesUnavailable):
				self._load({'chain': {key: value for key, value in chain.items() if key != field}})
		for invalid_chain in [
			{**chain, 'minHarvesterBalance': '201'},
			{**chain, 'maxHarvesterBalance': 'invalid'}
		]:
			with self.subTest(chain=invalid_chain), self.assertRaises(HarvestingPropertiesUnavailable):
				self._load({'chain': invalid_chain})

	def test_rejects_failed_http_request(self):
		with self.assertRaises(HarvestingPropertiesUnavailable):
			self._load({}, 503)

	def test_rejects_node_redirect(self):
		with self.assertRaises(HarvestingPropertiesUnavailable):
			self._load({}, 302)

	def test_real_async_resolver_connects_to_localhost(self):
		# Arrange: use the production resolver and an actual HTTP server.
		class Handler(NodeHandler):
			Payload = {'chain': {
				'minHarvesterBalance': '100', 'maxHarvesterBalance': '200'
			}}

		with HTTPServer(('127.0.0.1', 0), Handler) as server:
			thread = Thread(target=server.handle_request)
			thread.start()
			try:
				config = SymbolNodeConfiguration.from_url(f'http://localhost:{server.server_port}', allow_loopback=True)
				# Act:
				result = load_harvesting_properties(config)
			finally:
				thread.join(timeout=5)

		# Assert:
		self.assertEqual(HarvestingProperties(100, 200), result)

	def test_uses_validated_answer_once_when_dns_would_change(self):
		# Arrange: a second DNS query would return a forbidden address.
		class ChangingResolver(RecordingResolver):
			async def resolve(self, host, port=0, family=socket.AF_INET):
				if self.hosts:
					self.address = '169.254.169.254'
				return await super().resolve(host, port, family)

		resolver = ChangingResolver('127.0.0.1')
		with HTTPServer(('127.0.0.1', 0), NodeHandler) as server:
			thread = Thread(target=server.handle_request)
			thread.start()
			try:
				config = SymbolNodeConfiguration.from_url(f'http://node.test:{server.server_port}', allow_loopback=True)
				NodeHandler.Payload = {'chain': {
					'minHarvesterBalance': '100', 'maxHarvesterBalance': '200'
				}}
				# Act:
				result = load_harvesting_properties(config, resolver_factory=lambda: resolver)
			finally:
				thread.join(timeout=5)

		# Assert:
		self.assertEqual(HarvestingProperties(100, 200), result)
		self.assertEqual(['node.test'], resolver.hosts)
		self.assertTrue(resolver.closed)

	def test_rejects_forbidden_resolved_address(self):
		# A permitted name cannot cause the connector to use a forbidden DNS answer.
		resolver = RecordingResolver('127.0.0.1')
		config = SymbolNodeConfiguration.from_url('http://node.test:3000')
		with self.assertRaises(HarvestingPropertiesUnavailable):
			load_harvesting_properties(config, resolver_factory=lambda: resolver)
		self.assertEqual(['node.test'], resolver.hosts)
		self.assertTrue(resolver.closed)

	def test_rejects_ipv4_mapped_loopback_when_private_addresses_are_allowed(self):
		resolver = RecordingResolver('::ffff:127.0.0.1', family=socket.AF_INET6)
		config = SymbolNodeConfiguration.from_url('http://node.test:3000', allow_private=True)
		with self.assertRaises(HarvestingPropertiesUnavailable):
			load_harvesting_properties(config, resolver_factory=lambda: resolver)
		self.assertEqual(['node.test'], resolver.hosts)
		self.assertTrue(resolver.closed)

	def test_rejects_dns_resolution_failure_and_closes_resolver(self):
		class FailingResolver(RecordingResolver):
			async def resolve(self, host, port=0, family=socket.AF_INET):
				self.hosts.append(host)
				raise OSError('DNS lookup failed')

		resolver = FailingResolver('127.0.0.1')
		config = SymbolNodeConfiguration.from_url('http://node.test:3000')
		with self.assertRaises(HarvestingPropertiesUnavailable):
			load_harvesting_properties(config, resolver_factory=lambda: resolver)
		self.assertEqual(['node.test'], resolver.hosts)
		self.assertTrue(resolver.closed)

	def test_preserves_primary_error_when_resolver_cleanup_fails(self):
		# Arrange: both the DNS operation and its cleanup fail.
		class FailingResolver(RecordingResolver):
			async def resolve(self, host, port=0, family=socket.AF_INET):  # pylint: disable=unused-argument
				raise HarvestingPropertiesUnavailable('primary DNS error')

			async def close(self):
				self.closed = True
				raise OSError('cleanup failure')

		resolver = FailingResolver('127.0.0.1')
		config = SymbolNodeConfiguration.from_url('http://node.test:3000')
		# Act + Assert: cleanup failure must not replace the original unavailable reason.
		with self.assertRaisesRegex(HarvestingPropertiesUnavailable, 'primary DNS error'):
			load_harvesting_properties(config, resolver_factory=lambda: resolver)
		self.assertTrue(resolver.closed)

	def test_rejects_forbidden_numeric_target_before_connecting(self):
		config = SymbolNodeConfiguration.from_url('http://127.0.0.1:3000')
		with self.assertRaises(HarvestingPropertiesUnavailable):
			load_harvesting_properties(config)

	def test_rejects_request_target_that_does_not_match_configuration(self):
		config = SymbolNodeConfiguration.from_url('http://node.test:3000')
		config.base_url = 'http://other.test:3000'
		with self.assertRaises(HarvestingPropertiesUnavailable):
			load_harvesting_properties(config)

	def test_dns_timeout_returns_without_waiting_for_remaining_resolution(self):
		# Arrange: the resolver cooperatively observes cancellation and records cleanup.
		resolver = RecordingResolver('127.0.0.1', delay=10)
		config = SymbolNodeConfiguration.from_url('http://node.test:3000', timeout_seconds=1)
		started = time.monotonic()

		# Act + Assert:
		with self.assertRaises(HarvestingPropertiesUnavailable):
			load_harvesting_properties(config, resolver_factory=lambda: resolver)
		elapsed = time.monotonic() - started
		self.assertGreaterEqual(elapsed, 0.8)
		self.assertLess(elapsed, 2.5)
		self.assertTrue(resolver.cancelled)
		self.assertTrue(resolver.closed)

	def test_real_async_dns_timeout_cancels_and_closes_resolver(self):
		# Arrange: c-ares sends a query to a local UDP socket that never answers.
		class TrackedResolver(AsyncResolver):
			def __init__(self, port):
				super().__init__(nameservers=['127.0.0.1'], udp_port=port, timeout=10, tries=1, lookups='b')
				self.closed = False

			async def close(self):
				await super().close()
				self.closed = True

		resolvers = []
		with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as dns_socket:
			dns_socket.bind(('127.0.0.1', 0))
			dns_socket.settimeout(1)

			def create_resolver():
				resolver = TrackedResolver(dns_socket.getsockname()[1])
				resolvers.append(resolver)
				return resolver

			config = SymbolNodeConfiguration.from_url('http://node-timeout.invalid:3000', timeout_seconds=1)
			started = time.monotonic()
			# Act + Assert: the call returns without waiting for c-ares's longer DNS timeout.
			with self.assertRaises(HarvestingPropertiesUnavailable):
				load_harvesting_properties(config, resolver_factory=create_resolver)
			elapsed = time.monotonic() - started
			self.assertGreaterEqual(elapsed, 0.8)
			self.assertLess(elapsed, 2.5)
			self.assertTrue(dns_socket.recvfrom(512)[0])
		self.assertEqual(1, len(resolvers))
		self.assertTrue(resolvers[0].closed)

	def test_dns_and_http_share_one_total_timeout(self):
		# Arrange: DNS consumes most of the budget and the server then holds its response.
		release = Event()
		entered = Event()
		resolver = RecordingResolver('127.0.0.1', delay=0.8)

		class Handler(NodeHandler):
			def do_GET(self):  # pylint: disable=invalid-name
				entered.set()
				release.wait(timeout=5)

		with HTTPServer(('127.0.0.1', 0), Handler) as server:
			thread = Thread(target=server.handle_request)
			thread.start()
			try:
				config = SymbolNodeConfiguration.from_url(
					f'http://node.test:{server.server_port}', allow_loopback=True, timeout_seconds=1)
				started = time.monotonic()
				# Act + Assert: resetting the timeout after DNS would take at least 1.8 seconds.
				with self.assertRaises(HarvestingPropertiesUnavailable):
					load_harvesting_properties(config, resolver_factory=lambda: resolver)
				elapsed = time.monotonic() - started
				self.assertGreaterEqual(elapsed, 0.8)
				self.assertLess(elapsed, 1.6)
				self.assertTrue(entered.is_set())
				self.assertTrue(resolver.closed)
			finally:
				release.set()
				thread.join(timeout=5)

	def test_http_response_timeout_returns_before_server_finishes(self):
		# Arrange: the server accepts the request but holds the response until released.
		release = Event()
		entered = Event()

		class Handler(NodeHandler):
			def do_GET(self):  # pylint: disable=invalid-name
				entered.set()
				release.wait(timeout=5)

		with HTTPServer(('127.0.0.1', 0), Handler) as server:
			thread = Thread(target=server.handle_request)
			thread.start()
			try:
				config = SymbolNodeConfiguration.from_url(
					f'http://127.0.0.1:{server.server_port}', allow_loopback=True, timeout_seconds=1)
				started = time.monotonic()
				# Act + Assert:
				with self.assertRaises(HarvestingPropertiesUnavailable):
					load_harvesting_properties(config)
				elapsed = time.monotonic() - started
				self.assertGreaterEqual(elapsed, 0.8)
				self.assertLess(elapsed, 2.5)
				self.assertTrue(entered.is_set())
			finally:
				release.set()
				thread.join(timeout=5)
