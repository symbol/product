# Changelog
All notable changes to this project will be documented in this file.

The changelog format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## next

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

[0.0.7]: https://github.com/symbol/product/releases/tag/lightapi%2Fpython%2Fv0.0.6...lightapi%2Fpython%2Fv0.0.7
[0.0.6]: https://github.com/symbol/product/releases/tag/lightapi%2Fpython%2Fv0.0.6
