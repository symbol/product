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

	@property
	def tokens(self):
		return [('ca common name', self.ca_common_name), ('node common name', self.node_common_name)]


def create(screens):
	# needs new certificates?

	peer_cert_name_ca = ValidatingTextBox(
		_('wizard-certificates-ca-cert-label'),
		is_not_empty,
		_('wizard-certificates-ca-cert-error-text'))
	peer_cert_name_node = ValidatingTextBox(
		_('wizard-certificates-peer-cert-label'),
		is_not_empty,
		_('wizard-certificates-peer-cert-error-text'))

	# TODO: probably need to add peer_cert_name_ca and peer_cert_name_node somewhere,
	# as I'm not sure if we can easily access values there...

	def reset():
		node_settings = screens.get('node-settings')
		if not peer_cert_name_ca.input.text:
			peer_cert_name_ca.input.text = f'CA {node_settings.friendly_name}'

		if not peer_cert_name_node.input.text:
			peer_cert_name_node.input.text = f'{node_settings.friendly_name} {node_settings.domain_name}'

	dialog = ScreenDialog(
		screen_id='certificates',
		title=_('wizard-certificates-title'),
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

	dialog.reset = reset
	return dialog
