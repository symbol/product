# Changelog
All notable changes to this project will be documented in this file.

The changelog format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## next

## [0.2.3] - 26 Nov-2025

### Added
- add Japanese Language support.

### Fixed
- Shoestring command would fail with the incorrect error message when config file was not found.  It now reports file not found.
- Shoestring fails to connect to HTTPS node when renew voting keys.
- Docker 29 reduce open file soft limit to 1024.  Increase it back to the original value.

## [0.2.2] - 23 Sept-2025

### Added
- add support for Catapult v1.0.3.9 release.
- add support for REST v2.5.1 release.
- add support for Aggregate transaction V3.

## [0.2.1] - 08 Apr-2025

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

[0.2.3]: https://github.com/symbol/product/releases/tag/tools%2Fshoestring%2Fv0.2.2...tools%2Fshoestring%2Fv0.2.3
[0.2.2]: https://github.com/symbol/product/releases/tag/tools%2Fshoestring%2Fv0.2.1...tools%2Fshoestring%2Fv0.2.2
[0.2.1]: https://github.com/symbol/product/releases/tag/tools%2Fshoestring%2Fv0.1.3...tools%2Fshoestring%2Fv0.2.1
[0.1.3]: https://github.com/symbol/product/releases/tag/tools%2Fshoestring%2Fv0.1.3
