import logging
from collections import namedtuple
from enum import Enum
from typing import Iterator, Optional

from symbolchain.CryptoTypes import Hash256

from ..models.WrapRequest import WrapRequest, make_next_retry_wrap_request, make_wrap_error_result
from .MaxProcessedHeightMixin import MaxProcessedHeightMixin

PayoutDetails = namedtuple("PayoutDetails", ["transaction_hash", "net_amount", "total_fee", "conversion_rate"])
WrapRequestErrorView = namedtuple(
    "WrapErrorView",
    [
        "request_transaction_height",
        "request_transaction_hash",
        "request_transaction_subindex",
        "sender_address",
        "error_message",
        "request_timestamp",
    ],
)
WrapRequestView = namedtuple(
    "WrapRequestView",
    [
        "request_transaction_height",
        "request_transaction_hash",
        "request_transaction_subindex",
        "sender_address",
        "request_amount",
        "destination_address",
        "payout_status",
        "payout_transaction_hash",
        "request_timestamp",
        "payout_transaction_height",
        "payout_net_amount",
        "payout_total_fee",
        "payout_conversion_rate",
        "payout_timestamp",
        "error_message",
    ],
)


class WrapRequestStatus(Enum):
	"""Status of a wrap request."""

	UNPROCESSED = 0
	SENT = 1
	COMPLETED = 2
	FAILED = 3


class WrapRequestDatabase(MaxProcessedHeightMixin):  # pylint: disable=too-many-public-methods
	"""Database containing wrap requests and errors."""

	def __init__(self, connection, network_facade, payout_network_facade):
		"""Creates a wrap request database."""

		super().__init__(connection)

		self.network_facade = network_facade
		self.payout_network_facade = payout_network_facade

		self._logger = logging.getLogger(__name__)

	# region create_tables

	def create_tables(self):
		"""Creates wrap request database tables."""

		super().create_tables()
		self.execscript("""
CREATE TABLE IF NOT EXISTS wrap_request (
    request_transaction_height INTEGER NOT NULL,
	request_transaction_hash BLOB NOT NULL,
	request_transaction_subindex INTEGER NOT NULL,
	address BLOB,
	amount REAL NOT NULL,
	destination_address BLOB,
	payout_status INTEGER,
	payout_transaction_hash BLOB UNIQUE,
	is_retried INTEGER,
	PRIMARY KEY (request_transaction_hash, request_transaction_subindex)
);

CREATE INDEX IF NOT EXISTS wrap_request_request_transaction_height_idx ON wrap_request(request_transaction_height);
CREATE INDEX IF NOT EXISTS wrap_request_request_transaction_hash_idx ON wrap_request(request_transaction_hash)
CREATE INDEX IF NOT EXISTS wrap_request_destination_address_idx ON wrap_request(destination_address)
CREATE INDEX IF NOT EXISTS wrap_request_payout_status_idx ON wrap_request(payout_status)
CREATE INDEX IF NOT EXISTS wrap_request_payout_transaction_hash_idx ON wrap_request(payout_transaction_hash)

CREATE TABLE IF NOT EXISTS wrap_error (
	request_transaction_height INTEGER NOT NULL,
	request_transaction_hash BLOB NOT NULL,
	request_transaction_subindex INTEGER NOT NULL,
	address BLOB,
	message TEXT,
	PRIMARY KEY (request_transaction_hash, request_transaction_subindex)
    FOREIGN KEY (request_transaction_hash, request_transaction_subindex)
        REFERENCES wrap_request(request_transaction_hash, request_transaction_subindex
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS wrap_error_request_transaction_height_idx ON wrap_error(request_transaction_height);
CREATE INDEX IF NOT EXISTS wrap_error_request_transaction_hash_idx ON wrap_error(request_transaction_hash);
CREATE INDEX IF NOT EXISTS wrap_error_address_idx ON wrap_error(address);

CREATE TABLE IF NOT EXISTS payout_transaction (
	transaction_hash BLOB NOT NULL UNIQUE PRIMARY KEY,
	net_amount REAL,
	total_fee REAL,
	conversion_rate REAL,
	height INTEGER
);

CREATE TABLE IF NOT EXISTS block_metadata (
    height INTEGER NOT NULL UNIQUE PRIMARY KEY,
	timestamp TIMESTAMP
);
    
CREATE TABLE IF NOT EXISTS payout_block_metadata (
    height INTEGER NOT NULL UNIQUE PRIMARY KEY,
    timestamp TIMESTAMP
);
""")

	# endregion

	# region add_error, add_request

	def add_error(self, error) -> int:
		"""Adds an error to the error table."""

		res = self.exec(
		    """INSERT INTO wrap_error(
                request_transaction_height, request_transaction_hash, 
                request_transaction_subindex, address, message) 
                VALUES (?, ?, ?, ?, ?)""",
		    (
		        error.transaction_height,
		        error.transaction_hash.bytes,
		        error.transaction_subindex,
		        error.sender_address.bytes,
		        error.message,
		    ),
		)
		self.commit()
		return res

	def add_request(self, request) -> int:
		"""Adds a request to the request table."""

		res = self.exec(
		    """INSERT INTO wrap_request(
                request_transaction_height, request_transaction_hash, 
                request_transaction_subindex, address, amount, 
                destination_address, payout_status, 
                payout_transaction_hash, is_retried) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
		    (
		        request.transaction_height,
		        request.transaction_hash.bytes,
		        request.transaction_subindex,
		        request.sender_address.bytes,
		        float(request.amount),
		        request.destination_address,
		        WrapRequestStatus.UNPROCESSED.value,
		        None,
		        False,
		    ),
		)
		self.commit()
		return res

	# endregion

	# region requests

	def _to_request(self, request_tuple) -> WrapRequest:
		return WrapRequest(
		    request_tuple[0],
		    Hash256(request_tuple[1]),
		    request_tuple[2],
		    self.network_facade.make_address(request_tuple[3]),
		    request_tuple[4],
		    request_tuple[5],
		)

	def requests(self) -> Iterator[WrapRequest]:
		"""Returns requests."""

		rows = self.exec("""SELECT * FROM wrap_request ORDER BY request_transaction_height""")
		for row in rows:
			yield self._to_request(row)

	# endregion

	# region is_synced_at_timestamp

	def _max_processed_timestamp(self):
		max_processed_height = self.max_processed_height()
		return self._lookup_block_timestamp_closest(max_processed_height) or 0

	def is_synced_at_timestamp(self, timestamp) -> bool:
		"""Determines if the database is synced through a timestamp."""

		return timestamp <= self._max_processed_timestamp()

	# endregion

	# region cumulative_net_amount_at, cumulative_fees_paid_at, payout_transaction_hashes_at

	def cumulative_net_amount_at(self, timestamp):
		"""Gets cumulative amount of wrapped tokens issued at or before timestamp."""

		res = self.exec(
		    """
			SELECT SUM(payout_transaction.net_amount)
			FROM wrap_request
			LEFT JOIN block_metadata ON wrap_request.request_transaction_height = block_metadata.height
			LEFT JOIN payout_transaction ON wrap_request.payout_transaction_hash = payout_transaction.transaction_hash
			WHERE block_metadata.timestamp <= ? AND NOT wrap_request.is_retried
		""",
		    (timestamp, ),
		)
		return res[0] or 0

	def cumulative_fees_paid_at(self, timestamp):
		"""Gets cumulative amount of fees paid at or before timestamp."""

		res = self.exec(
		    """
			SELECT SUM(payout_transaction.total_fee)
			FROM wrap_request
			LEFT JOIN block_metadata ON wrap_request.request_transaction_height = block_metadata.height
			LEFT JOIN payout_transaction ON wrap_request.payout_transaction_hash = payout_transaction.transaction_hash
			WHERE block_metadata.timestamp <= ? AND NOT wrap_request.is_retried
		""",
		    (timestamp, ),
		)
		return res[0] or 0

	def payout_transaction_hashes_at(self, timestamp):
		"""Gets all payout transaction hashes at or before timestamp."""

		res = self.exec(
		    """
			SELECT payout_transaction.transaction_hash
			FROM wrap_request
			LEFT JOIN block_metadata ON wrap_request.request_transaction_height = block_metadata.height
			LEFT JOIN payout_transaction ON wrap_request.payout_transaction_hash = payout_transaction.transaction_hash
			WHERE block_metadata.timestamp <= ?
			AND wrap_request.payout_transaction_hash IS NOT NULL AND NOT wrap_request.is_retried
		""",
		    (timestamp, ),
		)
		for row in res:
			yield Hash256(row[0])

	# endregion

	# region sum_payout_transaction_amounts

	def sum_payout_transaction_amounts(self, payout_transaction_hashes, batch_size=100):
		"""Sums the wrapped tokens affected by the specified payout transactions."""

		balance = 0
		start_index = 0
		while start_index < len(payout_transaction_hashes):
			transaction_hashes_batch = payout_transaction_hashes[start_index:start_index + batch_size]

			in_query = ",".join(["?"] * len(transaction_hashes_batch))
			res = self.exec(
			    f"""
					SELECT SUM(amount)
					FROM wrap_request
					WHERE payout_transaction_hash IN ({in_query})
				""",
			    tuple(transaction_hash.bytes for transaction_hash in transaction_hashes_batch),
			)

			balance += res[0] if res else 0
			start_index += batch_size

		return balance

	# endregion

	# region mark_payout_*

	def mark_payout_sent(self, request, payout_details) -> int:
		"""Marks a payout as sent with the transaction hash of the payout."""
		count = 0
		count += self.exec(
		    """
				UPDATE wrap_request
				SET payout_status = ?, payout_transaction_hash = ?
				WHERE request_transaction_hash IS ? AND request_transaction_subindex IS ?
			""",
		    (
		        WrapRequestStatus.SENT.value,
		        payout_details.transaction_hash.bytes,
		        request.transaction_hash.bytes,
		        request.transaction_subindex,
		    ),
		)

		count += self.exec(
		    """INSERT INTO payout_transaction(
                transaction_hash, net_amount, total_fee,
                conversion_rate, height
                ) 
                VALUES (?, ?, ?, ?, ?)""",
		    (
		        payout_details.transaction_hash.bytes,
		        float(payout_details.net_amount),
		        float(payout_details.total_fee),
		        float(payout_details.conversion_rate),
		        0,
		    ),
		)

		self.commit()

		self._logger.info(
		    "R[%s:%s] sent payout transaction with hash %s; %s amount (%s fee deducted) at conversion rate %s",
		    request.transaction_hash,
		    request.transaction_subindex,
		    payout_details.transaction_hash,
		    payout_details.net_amount,
		    payout_details.total_fee,
		    payout_details.conversion_rate,
		)
		return count

	def _mark_payout_failed(self, request, message, is_retried) -> int:
		payout_transaction_hash = self.payout_transaction_hash_for_request(request)

		count = 0
		count += self.exec(
		    """
				UPDATE wrap_request
				SET payout_status = ?, is_retried = ?
				WHERE request_transaction_hash IS ? AND request_transaction_subindex IS ?
			""",
		    (
		        WrapRequestStatus.FAILED.value,
		        is_retried,
		        request.transaction_hash.bytes,
		        request.transaction_subindex,
		    ),
		)

		if payout_transaction_hash:
			count += self.exec(
			    """UPDATE payout_transaction SET height = ? WHERE transaction_hash IS ?""",
			    (-1, payout_transaction_hash.bytes),
			)

		count += self.add_error(make_wrap_error_result(request, message).error)
		self.commit()

		self._logger.info(
		    "R[%s:%s] marking payout failed with error: %s",
		    request.transaction_hash,
		    request.transaction_subindex,
		    message,
		)
		return count

	def mark_payout_failed(self, request, message) -> int:
		"""Marks a payout as failed with a message."""

		return self._mark_payout_failed(request, message, False)

	def mark_payout_failed_transient(self, request, message) -> int:
		"""Marks a payout as a transient failure and resets it to unprocessed state."""

		count = 0
		count += self._mark_payout_failed(request, message, True)
		count += self.add_request(make_next_retry_wrap_request(request))
		return count

	def mark_payout_completed(self, payout_transaction_hash, height) -> int:
		"""Marks a payout complete at a height."""

		count = 0
		count += self.exec(
		    """UPDATE wrap_request SET payout_status = ? WHERE payout_transaction_hash IS ?""",
		    (WrapRequestStatus.COMPLETED.value, payout_transaction_hash.bytes),
		)

		count += self.exec(
		    """UPDATE payout_transaction SET height = ? WHERE transaction_hash IS ?""",
		    (height, payout_transaction_hash.bytes),
		)

		count += self.exec("""INSERT OR IGNORE INTO payout_block_metadata VALUES (?, ?)""", (height, 0))

		self.commit()

		self._logger.info(
		    "marking payout transaction %s complete at height %s",
		    payout_transaction_hash,
		    height,
		)
		return count

	# endregion

	# region reset

	def reset(self) -> int:
		"""Deletes all request and error entries with request transaction heights above the max processed height."""

		res = self.exec("""
				DELETE FROM wrap_request
				WHERE request_transaction_height > (
                    SELECT height FROM max_processed_height WHERE marker = 1
                )
			""")
		self.commit()
		return res

	# endregion

	# region set_block_timestamp, set_payout_block_timestamp

	def _set_block_timestamp(self, height, raw_timestamp, network_facade, table_name) -> int:
		unix_timestamp = network_facade.network.to_datetime(network_facade.network.network_timestamp_class(raw_timestamp)).timestamp()

		res = self.exec(
		    f"""
				INSERT INTO {table_name} (height, timestamp) VALUES (?, ?)
				ON CONFLICT(height)
				DO UPDATE SET timestamp=excluded.timestamp
			""",
		    (height, unix_timestamp),
		)
		self.commit()
		return res

	def set_block_timestamp(self, height, raw_timestamp) -> int:
		"""Sets a block timestamp."""

		res = self._set_block_timestamp(height, raw_timestamp, self.network_facade, "block_metadata")

		self._logger.info("saving block %s with timestamp %s", height, raw_timestamp)
		return res

	def set_payout_block_timestamp(self, height, raw_timestamp) -> int:
		"""Sets a payout block timestamp."""

		res = self._set_block_timestamp(height, raw_timestamp, self.payout_network_facade, "payout_block_metadata")

		self._logger.info("saving payout block %s with timestamp %s", height, raw_timestamp)
		return res

	# endregion

	# region lookup_block_timestamp, lookup_block_height

	def lookup_block_timestamp(self, height):
		"""Looks up the timestamp of a block height."""

		result = self.exec("""SELECT timestamp FROM block_metadata WHERE height = ?""", (height, ))
		return result[0][0] if result else None

	def _lookup_block_timestamp_closest(self, height):
		"""Looks up the timestamp of the closest block height no greater than provided."""
		result = self.exec("""SELECT MAX(timestamp) FROM block_metadata WHERE height <= ?""", (height, ))
		return result[0][0] if result else None

	def lookup_block_height(self, timestamp):
		"""Looks up the height of the last block with a timestamp no greater than provided."""
		result = self.exec(
		    """SELECT max(height) FROM block_metadata WHERE timestamp <= ?""",
		    (timestamp, ),
		)
		return result[0][0] if result else 0

	# endregion

	# region requests_by_status, unconfirmed_payout_transaction_hashes, payout_transaction_hash_for_request

	def requests_by_status(self, status) -> list[WrapRequest]:
		"""Gets all requests with the desired status."""

		result = self.exec(
		    """SELECT * FROM wrap_request WHERE payout_status = ? ORDER BY request_transaction_height ASC""",
		    (status.value, ),
		)
		return list(map(self._to_request, result))

	def unconfirmed_payout_transaction_hashes(self) -> list[Hash256]:
		"""Gets hashes of all unconfirmed payout transactions."""

		result = self.exec(
		    """SELECT transaction_hash FROM payout_transaction WHERE height = ? ORDER BY transaction_hash""",
		    (0, ),
		)
		return [Hash256(row[0]) for row in result]

	def payout_transaction_hash_for_request(self, request) -> Optional[Hash256]:
		"""Gets the payout transaction hash associated with a request."""

		result = self.exec(
		    """
				SELECT payout_transaction_hash
				FROM wrap_request
				WHERE request_transaction_hash IS ? AND request_transaction_subindex IS ?
			""",
		    (request.transaction_hash.bytes, request.transaction_subindex),
		)
		return Hash256(result[0][0]) if result else None

	# endregion

	# region find_errors, find_requests

	@staticmethod
	def _unwrap_search_parameter(value):
		return value.bytes if hasattr(value, "bytes") else value

	def find_errors(
	    self,
	    address=None,
	    transaction_hash=None,
	    offset=0,
	    limit=25,
	    sort_ascending=True,
	) -> Iterator[WrapRequestErrorView]:
		# pylint: disable=too-many-arguments,too-many-positional-arguments
		"""Finds all errors for an address, optionally filtered by hash."""

		result = self.exec(
		    f"""
				SELECT
					wrap_error.request_transaction_height,
					wrap_error.request_transaction_hash,
					wrap_error.request_transaction_subindex,
					wrap_error.address,
					wrap_error.message,
					block_metadata.timestamp
				FROM wrap_error
				LEFT JOIN block_metadata ON wrap_error.request_transaction_height = block_metadata.height
				WHERE (?1 IS NULL OR wrap_error.address = ?1) AND (?2 IS NULL OR wrap_error.request_transaction_hash = ?2)
				ORDER BY wrap_error.request_transaction_height {"ASC" if sort_ascending else "DESC"}
				LIMIT ? OFFSET ?
			""",
		    (
		        self._unwrap_search_parameter(address),
		        self._unwrap_search_parameter(transaction_hash),
		        limit,
		        offset,
		    ),
		)

		for row in result:
			yield WrapRequestErrorView(
			    row[0],
			    Hash256(row[1]),
			    row[2],
			    self.network_facade.make_address(row[3]),
			    row[4],
			    row[5],
			)

	def find_requests(
	    self,
	    address=None,
	    transaction_hash=None,
	    offset=0,
	    limit=25,
	    sort_ascending=True,
	    payout_status=None,
	) -> Iterator[WrapRequestView]:
		# pylint: disable=too-many-arguments,too-many-positional-arguments
		"""Finds all requests for an address, optionally filtered by hash."""

		result = self.exec(
		    f"""
				SELECT
					wrap_request.request_transaction_height,
					wrap_request.request_transaction_hash,
					wrap_request.request_transaction_subindex,
					wrap_request.address,
					wrap_request.amount,
					wrap_request.destination_address,
					wrap_request.payout_status,
					wrap_request.payout_transaction_hash,
					block_metadata.timestamp,
					payout_transaction.height,
					payout_transaction.net_amount,
					payout_transaction.total_fee,
					payout_transaction.conversion_rate,
					payout_block_metadata.timestamp,
					wrap_error.message
				FROM wrap_request
				LEFT JOIN block_metadata ON wrap_request.request_transaction_height = block_metadata.height
				LEFT JOIN payout_transaction ON wrap_request.payout_transaction_hash = payout_transaction.transaction_hash
				LEFT JOIN payout_block_metadata ON payout_transaction.height = payout_block_metadata.height
				LEFT JOIN wrap_error ON wrap_request.request_transaction_hash = wrap_error.request_transaction_hash
					AND wrap_request.request_transaction_subindex = wrap_error.request_transaction_subindex
				WHERE (?1 IS NULL OR wrap_request.address = ?1 OR wrap_request.destination_address = ?1)
					AND (?2 IS NULL OR wrap_request.request_transaction_hash = ?2 OR wrap_request.payout_transaction_hash = ?2)
					AND (?3 IS NULL OR wrap_request.payout_status = ?3)
				ORDER BY wrap_request.request_transaction_height {"ASC" if sort_ascending else "DESC"}
				LIMIT ? OFFSET ?
			""",
		    (
		        self._unwrap_search_parameter(address),
		        self._unwrap_search_parameter(transaction_hash),
		        payout_status,
		        limit,
		        offset,
		    ),
		)

		for row in result:
			yield WrapRequestView(
			    row[0],
			    Hash256(row[1]),
			    row[2],
			    self.network_facade.make_address(row[3]),
			    row[4],
			    self.payout_network_facade.make_address(row[5]),
			    row[6],
			    Hash256(row[7]) if row[7] else None,
			    *row[8:],
			)

	# endregion
