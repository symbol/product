# Changelog
All notable changes to this project will be documented in this file.

The changelog format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## next

## [0.1.3] - 20 June-2024

### Added
- add 'import-harvesters' command for inspecting and importing harvester.dat files when the node key changed.

### Fixed
- fix openssl generating x509 v3 certificates by explicitly specify x509_extensions
- health check was failing nodes with https REST due to accessing wrong property from context.  the health agent node using domain name when available.

[0.1.3]: https://github.com/symbol/product/releases/tag/tools%2Fshoestring%2Fv0.1.3
