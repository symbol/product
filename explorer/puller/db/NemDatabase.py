from .DatabaseConnection import DatabaseConnection

class NemDatabase(DatabaseConnection):
    """Database containing Nem blockchain data."""

    def create_tables(self):
        """Creates blocks database tables."""

        cursor = self.connection.cursor()
        cursor.execute('''CREATE TABLE IF NOT EXISTS blocks (
            height integer NOT NULL,
            timestamp integer NOT NULL
            )''')
        self.connection.commit()

    def add_block(self, height, timestamp):
        """Adds block height into table."""

        cursor = self.connection.cursor()
        cursor.execute('''INSERT INTO blocks VALUES (%s, %s)''', (height, timestamp))
        self.connection.commit()

    def get_current_height(self):
        """Gets current height from database"""

        cursor = self.connection.cursor()
        cursor.execute('''SELECT MAX(height) FROM blocks''')
        results = cursor.fetchone()
        return 0 if results[0] is None else results[0]
