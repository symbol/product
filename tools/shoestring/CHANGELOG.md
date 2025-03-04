# Changelog
All notable changes to this project will be documented in this file.

The changelog format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## next

## [0.2.0] - 25 Feb-2025

### Added
- add `docker-compose-recovery.yaml` which allows recovery from lock files in the data folder.
- add setup which allows deployment of a light node.
- add support for advanced customization of `rest.json`.

### Changed
- upgrade Symbol nodes to MongoDB 7.
- allow the user to retain their node's key when migrating from Bootstrap or on cert renewal.

### Fixed
- renew certs generates a new CA cert by default.

## [0.1.3] - 20 June-2024

### Added
- add 'import-harvesters' command for inspecting and importing harvester.dat files when the node key changed.

### Fixed
- fix openssl generating x509 v3 certificates by explicitly specify x509_extensions
- health check was failing nodes with https REST due to accessing wrong property from context.  the health agent node using domain name when available.

[0.2.0]: https://github.com/symbol/product/releases/tag/tools%2Fshoestring%2Fv0.1.3...tools%2Fshoestring%2Fv0.2.0
[0.1.3]: https://github.com/symbol/product/releases/tag/tools%2Fshoestring%2Fv0.1.3
