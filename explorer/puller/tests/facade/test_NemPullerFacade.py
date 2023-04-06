import unittest
from tempfile import NamedTemporaryFile

from client.NemClient import NemClient
from db.NemDatabase import NemDatabase
from facade.NemPullerFacade import NemPullerFacade


class NemPullerFacadeTest(unittest.TestCase):

	def test_initialization(self):
		# Arrange:
		node_url = 'http://localhost:7890'

		with NamedTemporaryFile(mode='w+t') as temp_config_file:
			temp_config_file.write('[nem_db]\ndatabase=nem_db\nuser=user\npassword=admin\nhost=localhost\nport=54320')
			temp_config_file.flush()
			config_file = temp_config_file.name

			# Act:
			facade = NemPullerFacade(node_url, config_file)

			# Assert:
			self.assertIsInstance(facade.database(), NemDatabase)
			self.assertIsInstance(facade.client(), NemClient)
			self.assertEqual(facade.client().endpoint, node_url)
