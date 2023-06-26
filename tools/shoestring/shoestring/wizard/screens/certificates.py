from prompt_toolkit.layout.containers import HSplit, VSplit

from shoestring.wizard.Screen import ScreenDialog
from shoestring.wizard.ValidatingTextBox import ValidatingTextBox, is_not_empty


class CertSettings:
	def __init__(self, ca_common_name, node_common_name):
		self._ca_common_name = ca_common_name
		self._node_common_name = node_common_name

	@property
	def ca_common_name(self):
		return self._ca_common_name.input.text

	@property
	def node_common_name(self):
		return self._node_common_name.input.text

	def __repr__(self):
		return f'(ca_common_name=\'{self.ca_common_name}\', node_common_name=\'{self.node_common_name}\')'


def create(_screens):
	# needs new certificates?

	peer_cert_name_ca = ValidatingTextBox('Cert CA name', is_not_empty, 'CA name must not be empty')
	peer_cert_name_node = ValidatingTextBox('Cert Peer name', is_not_empty, 'Peer name must not be empty')

	# TODO: probably need to add peer_cert_name_ca and peer_cert_name_node somewhere,
	# as I'm not sure if we can easily access values there...

	return ScreenDialog(
		screen_id='certificates',
		title=_('wizard-peer-cert-names-title'),
		body=VSplit([
			HSplit([
				peer_cert_name_ca.label,
				peer_cert_name_node.label
			], width=30),
			HSplit([
				peer_cert_name_ca.input,
				peer_cert_name_node.input
			]),
		]),

		accessor=CertSettings(peer_cert_name_ca, peer_cert_name_node),
		is_valid=lambda: peer_cert_name_ca.is_valid and peer_cert_name_node.is_valid
	)
