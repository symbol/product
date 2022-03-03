import argparse
import asyncio
import sqlite3
from pathlib import Path

from symbolchain.CryptoTypes import Hash256
from symbolchain.nem.Network import Network

from puller.db.CompletedOptinDatabase import CompletedOptinDatabase
from puller.db.InProgressOptinDatabase import InProgressOptinDatabase, OptinRequestStatus
from puller.db.MultisigDatabase import MultisigDatabase
from puller.processors.RequestGrouper import group_requests

# example for processing and paying out post optins

# TODO_:
# 1. add check_cosigners to MultisigDatabase
# 2. implement send_funds
# 3. check finalized and update completed db


def send_funds(_):
	# TODO_: implement this
	return Hash256('')


async def main():
	# pylint: disable=too-many-locals
	parser = argparse.ArgumentParser(description='process post opt in requests')
	parser.add_argument('--database-directory', help='output database directory', default='_temp')
	args = parser.parse_args()

	network = Network.MAINNET

	with sqlite3.connect(Path(args.database_directory) / 'completed.db') as completed_connection:
		with sqlite3.connect(Path(args.database_directory) / 'in_progress.db') as inprogress_connection:
			with sqlite3.connect(Path(args.database_directory) / 'multisig.db') as multisig_connection:
				completed_database = CompletedOptinDatabase(completed_connection)
				inprogress_database = InProgressOptinDatabase(inprogress_connection)
				multisig_database = MultisigDatabase(multisig_connection)

				sent_requests = group_requests(network, inprogress_database.get_requests_by_status(OptinRequestStatus.SENT))

				# TODO_: process sent first!

				unprocessed_requests = group_requests(network, inprogress_database.get_requests_by_status(OptinRequestStatus.UNPROCESSED))
				for address, request_group in unprocessed_requests.items():
					if request_group.is_error:
						# inconsistent error detection - what to do?
						continue

					if address in sent_requests or completed_database.is_opted_in(address):
						inprogress_database.set_request_status(address, OptinRequestStatus.DUPLICATE, None)
					else:
						if multisig_database.check_cosigners(address, [request.address for request in request_group.requests]):
							sent_transaction_hash = send_funds(request_group.requests[0].destination_public_key)
							for request in request_group.requests:
								inprogress_database.set_request_status(request, OptinRequestStatus.SENT, sent_transaction_hash)


if '__main__' == __name__:
	asyncio.run(main())
