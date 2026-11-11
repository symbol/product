MESSAGE_TYPE_LABELS = {
	0: 'plain',
	1: 'encrypted',
	254: 'persistentDelegationHarvesting'
}
DELEGATION_MARKER = 'FE2A8061577301E2'


def parse_message(message):
	"""Splits a Symbol message marker from its payload, preserving the supplied hex text."""

	if not message:
		return None, None

	if message.startswith(DELEGATION_MARKER):
		return MESSAGE_TYPE_LABELS[254], message[len(DELEGATION_MARKER):]

	if '01' == message[:2]:
		return MESSAGE_TYPE_LABELS[1], message[2:]

	if '00' == message[:2]:
		return MESSAGE_TYPE_LABELS[0], message[2:]

	return None, message
