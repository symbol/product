import socket
from contextlib import contextmanager


@contextmanager
def unresponsive_node_url():
	"""Yields the url of a node that completes the TCP handshake but never answers a request."""

	with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
		listener.bind(('127.0.0.1', 0))
		listener.listen(8)  # the kernel completes handshakes into the backlog; nothing ever accepts or replies
		port = listener.getsockname()[1]
		yield f'http://127.0.0.1:{port}'
