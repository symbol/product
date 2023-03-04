from client.NemClient import NemClient
from db.NemDatabase import NemDatabase
import configparser

class NemPullerFacade:
    """Facade for pulling data from NEM network."""

    def __init__(self, node_url, config_file):
        """Creates a facade object."""

        config = configparser.ConfigParser()
        config.read(config_file)

        db_config = config['nem_db']

        self._db = NemDatabase(db_config)
        self._client = NemClient(node_url)

    def db(self):
        """Gets database object."""

        return self._db

    def client(self):
        """Gets client object."""

        return self._client

