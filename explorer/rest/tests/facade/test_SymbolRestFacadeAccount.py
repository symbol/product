import asyncio
import time
from decimal import Decimal
from unittest import TestCase

from common.symbol.NativeMosaic import NativeMosaicInfo
from common.symbol.NodeConfiguration import SymbolNodeConfiguration
from flask import Flask
from symbolchain.symbol.Network import Network

from rest.db.SymbolDatabase import AccountListRecord, AccountRecord, AccountStatisticsRecord
from rest.facade.HarvestingProperties import HarvestingProperties, HarvestingPropertiesUnavailable, load_harvesting_properties
from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.routes.symbol import setup_symbol_routes


def create_account_record(
	address=bytes.fromhex('98FD35818960C7B18B72F49A5598FA9F712A354DB33EDE57'),
	node_public_key=None,
	vrf_public_key=None):
	"""Creates a minimal valid account record for facade wiring tests."""

	return AccountRecord(
		address,
		None,
		'main',
		None,
		0,
		bytes.fromhex('11' * 32),
		node_public_key,
		vrf_public_key,
		[],
		[],
		2,
		[],
		())


class RecordingAccountDatabase:
	def __init__(self):
		self.account_query = None
		self.account_record = create_account_record()
		self.account_list_query = None
		self.account_list_record = AccountListRecord(
			bytes.fromhex('98FD35818960C7B18B72F49A5598FA9F712A354DB33EDE57'),
			None, 'main', 0, '72C0212E67A08BCE', (), ())
		self.account_statistics_query = None
		self.account_statistics_record = AccountStatisticsRecord(1, 1, 1, 1, Decimal('1'), ())

	def try_get_account(self, address, public_key):
		self.account_query = (address, public_key)

		return self.account_record

	def get_account_list(self, query, max_age_seconds, harvesting_active_window_days=7):
		self.account_list_query = (query, max_age_seconds, harvesting_active_window_days)
		return [self.account_list_record]

	def get_account_statistics(self, max_age_seconds, harvesting_active_window_days, harvesting_properties):
		self.account_statistics_query = (max_age_seconds, harvesting_active_window_days, harvesting_properties)
		return self.account_statistics_record


class SymbolRestFacadeAccountTest(TestCase):
	def test_get_account_statistics_formats_snapshot_and_passes_refresh_settings(self):
		# Arrange:
		database = RecordingAccountDatabase()
		facade = SymbolRestFacade(
			database,
			SymbolNodeConfiguration.from_url('http://127.0.0.1:3000', allow_loopback=True),
			NativeMosaicInfo('72C0212E67A08BCE', 6),
			Network.TESTNET,
			7200,
			7,
			harvesting_properties_loader=lambda _: HarvestingProperties(1, 2))

		# Act:
		result = facade.get_account_statistics()

		# Assert:
		self.assertEqual((7200, 7, HarvestingProperties(1, 2)), database.account_statistics_query)
		self.assertEqual(1, result['total'])
		self.assertEqual(0.0, result['top10AccountsImportance'])
		self.assertEqual([], result['pendingVerification'])

	def test_statistics_http_reports_node_failure_as_unavailable(self):
		# Arrange:
		database = RecordingAccountDatabase()

		def unavailable(_node_config):
			raise HarvestingPropertiesUnavailable('node unavailable')

		facade = SymbolRestFacade(
			database, SymbolNodeConfiguration.from_url('http://127.0.0.1:3000', allow_loopback=True),
			NativeMosaicInfo('72C0212E67A08BCE', 6), Network.TESTNET, 7200, 7,
			harvesting_properties_loader=unavailable)
		app = Flask(__name__)
		setup_symbol_routes(app, facade)

		# Act:
		response = app.test_client().get('/api/symbol/account/statistics')

		# Assert:
		self.assertEqual(503, response.status_code)
		self.assertEqual({'status': 503, 'message': 'Symbol backend data is unavailable'}, response.get_json())
		self.assertIsNone(database.account_statistics_query)

	def test_statistics_http_reports_dns_timeout_without_querying_database(self):
		# Arrange: the real loader uses an injected resolver that blocks until cancelled.
		class SlowResolver:
			def __init__(self):
				self.cancelled = False
				self.closed = False

			async def resolve(self, host, port, family):  # pylint: disable=unused-argument
				try:
					await asyncio.sleep(10)
				except asyncio.CancelledError:
					self.cancelled = True
					raise

			async def close(self):
				self.closed = True

		database = RecordingAccountDatabase()
		resolver = SlowResolver()
		facade = SymbolRestFacade(
			database, SymbolNodeConfiguration.from_url('http://node.test:3000', timeout_seconds=1),
			NativeMosaicInfo('72C0212E67A08BCE', 6), Network.TESTNET, 7200, 7,
			harvesting_properties_loader=lambda config: load_harvesting_properties(config, resolver_factory=lambda: resolver))
		app = Flask(__name__)
		setup_symbol_routes(app, facade)
		started = time.monotonic()

		# Act:
		response = app.test_client().get('/api/symbol/account/statistics')

		# Assert: shutdown completes within the deadline plus scheduling allowance.
		elapsed = time.monotonic() - started
		self.assertGreaterEqual(elapsed, 0.8)
		self.assertLess(elapsed, 2.5)
		self.assertEqual(503, response.status_code)
		self.assertEqual({'status': 503, 'message': 'Symbol backend data is unavailable'}, response.get_json())
		self.assertIsNone(database.account_statistics_query)
		self.assertTrue(resolver.cancelled)
		self.assertTrue(resolver.closed)

	def test_get_accounts_formats_snapshot_list_and_passes_refresh_age(self):
		# Arrange:
		database = RecordingAccountDatabase()
		facade = SymbolRestFacade(
			database,
			SymbolNodeConfiguration.from_url('http://127.0.0.1:3000', allow_loopback=True),
			NativeMosaicInfo('72C0212E67A08BCE', 6),
			Network.TESTNET,
			7200,
			7)

		# Act:
		result = facade.get_accounts('query')

		# Assert:
		self.assertEqual(('query', 7200, 7), database.account_list_query)
		self.assertEqual([{
			'address': 'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY',
			'publicKey': None,
			'accountType': 'main',
			'importance': 0.0,
			'balance': 0,
			'namespaces': [],
			'mosaics': [],
			'description': None,
			'isHarvestingActive': False,
			'isMultisig': False
		}], result)

	def test_try_get_account_passes_search_and_network_to_view(self):
		# Arrange:
		database = RecordingAccountDatabase()
		facade = SymbolRestFacade(
			database,
			SymbolNodeConfiguration.from_url('http://127.0.0.1:3000', allow_loopback=True),
			NativeMosaicInfo('72C0212E67A08BCE', 6),
			Network.TESTNET)

		# Act:
		result = facade.try_get_account(None, bytes.fromhex('01' * 32))

		# Assert:
		self.assertEqual((None, bytes.fromhex('01' * 32)), database.account_query)
		self.assertEqual('TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY', result['address'])
		self.assertEqual('TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY', result['supplementalKeys']['linked'])

	def test_try_get_account_formats_mainnet_account_and_supplemental_keys(self):
		# Arrange:
		database = RecordingAccountDatabase()
		database.account_record = create_account_record(
			bytes.fromhex('68A991D03CBA797AED52A061E6BF2F7F238D8A85CFCED03D'),
			bytes.fromhex('22' * 32),
			bytes.fromhex('00' * 32))
		facade = SymbolRestFacade(
			database,
			SymbolNodeConfiguration.from_url('http://127.0.0.1:3000', allow_loopback=True),
			NativeMosaicInfo('72C0212E67A08BCE', 6),
			Network.MAINNET)

		# Act:
		result = facade.try_get_account(None, bytes.fromhex('01' * 32))

		# Assert:
		self.assertEqual('NCUZDUB4XJ4XV3KSUBQ6NPZPP4RY3CUFZ7HNAPI', result['address'])
		self.assertEqual((None, bytes.fromhex('01' * 32)), database.account_query)
		self.assertEqual({
			'linked': 'ND6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWO7UY5Y',
			'node': 'NAHJNXEF62ZEVSOI3NP7YWODLCAMBNZCY4X3FNY',
			'vrf': 'NAXQUTQQNS6JEJG7PLC6FRVJ2USS44GLMUL5QKI'
		}, result['supplementalKeys'])


class SymbolRestFacadeAccountListConfigurationTest(TestCase):
	def test_get_accounts_requires_configured_refresh_age(self):
		# Arrange:
		facade = SymbolRestFacade(
			RecordingAccountDatabase(),
			SymbolNodeConfiguration.from_url('http://127.0.0.1:3000', allow_loopback=True),
			NativeMosaicInfo('72C0212E67A08BCE', 6), Network.TESTNET)

		# Act:
		with self.assertRaises(ValueError) as context:
			facade.get_accounts('query')

		# Assert:
		self.assertEqual('Symbol account refresh max age is required', str(context.exception))

	def test_get_accounts_requires_configured_harvesting_window(self):
		# Arrange:
		facade = SymbolRestFacade(
			RecordingAccountDatabase(),
			SymbolNodeConfiguration.from_url('http://127.0.0.1:3000', allow_loopback=True),
			NativeMosaicInfo('72C0212E67A08BCE', 6), Network.TESTNET, 7200)

		# Act:
		with self.assertRaises(ValueError) as context:
			facade.get_accounts('query')

		# Assert:
		self.assertEqual('Symbol harvesting active window is required', str(context.exception))


class SymbolRestFacadeAccountStatisticsConfigurationTest(TestCase):
	def test_get_account_statistics_requires_configured_refresh_age(self):
		# Arrange:
		database = RecordingAccountDatabase()
		facade = SymbolRestFacade(
			database,
			SymbolNodeConfiguration.from_url('http://127.0.0.1:3000', allow_loopback=True),
			NativeMosaicInfo('72C0212E67A08BCE', 6), Network.TESTNET,
			harvesting_active_window_days=7)

		# Act:
		with self.assertRaises(ValueError) as context:
			facade.get_account_statistics()

		# Assert:
		self.assertEqual('Symbol account refresh max age is required', str(context.exception))
		self.assertIsNone(database.account_statistics_query)

	def test_get_account_statistics_requires_configured_harvesting_window(self):
		# Arrange:
		database = RecordingAccountDatabase()
		facade = SymbolRestFacade(
			database,
			SymbolNodeConfiguration.from_url('http://127.0.0.1:3000', allow_loopback=True),
			NativeMosaicInfo('72C0212E67A08BCE', 6), Network.TESTNET, account_refresh_max_age_seconds=7200)

		# Act:
		with self.assertRaises(ValueError) as context:
			facade.get_account_statistics()

		# Assert:
		self.assertEqual('Symbol harvesting active window is required', str(context.exception))
		self.assertIsNone(database.account_statistics_query)
