from enum import Enum


class LogLevel(Enum):
	"""Possible python log levels."""

	INFO = 20
	WARNING = 30
	ERROR = 40


def assert_message_is_logged(message, caplog):
	"""Asserts that the specified message has been logged."""

	actual_messages = [record.message for record in caplog.records]
	assert message in actual_messages, actual_messages


def assert_all_messages_are_logged(expected_messages, caplog):
	"""Asserts that the specified messages have been exactly logged."""

	actual_messages = [record.message for record in caplog.records if 'pythonConfig' == record.name]
	assert expected_messages == actual_messages, actual_messages


def assert_max_log_level(level, caplog):
	"""Asserts that the specified log level is the most severe level logged."""

	max_log_level = max(record.levelno for record in caplog.records)
	assert level.value == max_log_level, f'expected {level} but was {max_log_level}'
