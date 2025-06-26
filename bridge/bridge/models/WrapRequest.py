from collections import namedtuple

_TRANSACTION_IDENTIFIER_PROPERTY_NAMES = ['transaction_height', 'transaction_hash', 'sender_address']

TransactionIdentifier = namedtuple('TransactionIdentifier', _TRANSACTION_IDENTIFIER_PROPERTY_NAMES)
WrapRequest = namedtuple('WrapRequest', _TRANSACTION_IDENTIFIER_PROPERTY_NAMES + ['amount', 'target_address_eth'])
WrapError = namedtuple('WrapError', _TRANSACTION_IDENTIFIER_PROPERTY_NAMES + ['message'])
WrapRequestResult = namedtuple('WrapRequestResult', ['is_error', 'request', 'error'])
