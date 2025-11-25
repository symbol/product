# Changelog
All notable changes to this project will be documented in this file.

The changelog format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## next

## [0.0.8] - 26 Nov-2025

### Added
- Add new endpoints to the NemConnector
  - local/chain/blocks-after
  - local/block/at
- Add function, try_wait_for_announced_transaction, to announce a transaction.  The function will try to wait for the desired transaction state; otherwise, it will fail.
- Add function, mosaic_fee_information, to get mosaic fee information to NemConnector
- Add function, query_block_timestamps, to query block timestamps
- Add function, transaction_confirmed, to get confirmed transactions
- Add function, balance, to the connector class to retrieve the balance of an account
- Add the following functions to the connectors
  - finalized_chain_height (both)
  - block_headers (NEM)
  - transaction_statuses (Symbol)
  - incoming_transactions (both)
  - extract_transaction_id (both)
  - get_incoming_transactions_from (extension)
  - network_time
  - announce_transaction

### Changed
- NemConnector can only retrieve currency balance, add logic for querying arbitrary mosaic balance
- Change BasicConnector to allow 404 to be optionally treated as errors

### Fixed
- Raise InsufficientBalanceException if the transaction fails due to a low account balance.
- Upstream code can't differentiate transient and permanent HTTP errors. Add HttpException subclass with http_status_code.
## [0.0.7] - 03 Mar-2025

### Added
- added support for Python 3.13

### Fixed
- disable ssl.VERIFY_X509_STRICT validation since our certs are X509 compliant and RFC5280 is not needed.

## [0.0.6] - 20 June-2024

### Added
- added support for Python 3.12

### Fixed
- treat all HTTP statuses less than 400 as success instead of only HTTP statuses 200 and 404 codes
- OpenSSL libraries names are different on Windows which cause linking to fail; update to select the correct library name.

[0.0.8]: https://github.com/symbol/product/releases/tag/lightapi%2Fpython%2Fv0.0.7...lightapi%2Fpython%2Fv0.0.8
[0.0.7]: https://github.com/symbol/product/releases/tag/lightapi%2Fpython%2Fv0.0.6...lightapi%2Fpython%2Fv0.0.7
[0.0.6]: https://github.com/symbol/product/releases/tag/lightapi%2Fpython%2Fv0.0.6
