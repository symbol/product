from collections import namedtuple

ExecutionContext = namedtuple('ExecutionContext', ['is_unwrap_mode', 'strategy_mode'])
PrintableMosaicId = namedtuple('PrintableMosaicId', ['id', 'formatted'])
