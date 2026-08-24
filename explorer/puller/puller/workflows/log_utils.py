import logging

from zenlog import log

LOG_FORMAT = '  %(asctime)s | %(styledname)-8s | %(message)s'
LOG_DATE_FORMAT = '%Y-%m-%d %H:%M:%S'


def configure_logging():
	"""Replaces the colorized zenlog output format with a timestamped plain text one."""

	log.stream.setFormatter(logging.Formatter(LOG_FORMAT, LOG_DATE_FORMAT))
