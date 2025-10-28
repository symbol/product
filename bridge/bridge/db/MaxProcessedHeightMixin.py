class MaxProcessedHeightMixin:
    """Mixin that adds a max processed height table."""

    def __init__(self, connection):
        """Creates a max processed height mixin."""

        self.connection = connection
        self.connection.execute("PRAGMA foreign_keys = ON")

    def exec(self, sql: str, params=()):
        """Executes any SQL statements eventually returning the cursor."""
        sql_type = sql.strip().split(" ")[0].upper()
        res = self.connection.execute(sql, params)
        if sql_type == "SELECT":
            return res.fetchall()
        elif sql_type in ("INSERT", "UPDATE", "DELETE"):
            return res.rowcount
        elif sql_type in ("CREATE", "DROP", "ALTER"):
            self.connection.commit()
            return None
        else:
            return res

    def commit(self):
        """Commits the current transaction."""
        self.connection.commit()

    def execscript(self, sql_script: str):
        """Executes multiple SQL statements at once."""
        self.connection.executescript(sql_script)
        self.connection.commit()

    def create_tables(self):
        """Creates max processed height database tables."""

        self.exec(
            """CREATE TABLE IF NOT EXISTS max_processed_height (
			height integer,
			marker integer UNIQUE
		)"""
        )

    def set_max_processed_height(self, height):
        """Sets max processed height."""

        self.exec(
            """
				INSERT INTO max_processed_height VALUES (?, 1)
				ON CONFLICT(marker)
				DO UPDATE SET height=excluded.height
			""",
            (height,),
        )
        self.commit()

    def max_processed_height(self):
        """Gets max processed height."""

        rows = self.exec("""SELECT height FROM max_processed_height WHERE marker = 1""")
        return rows[0][0] if rows else 0
