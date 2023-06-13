from prompt_toolkit.layout.containers import HSplit, VSplit
from prompt_toolkit.widgets import Label, TextArea

from shoestring.wizard.Screen import ScreenDialog


class CertSettings:
	def __init__(self, ca_common_name, node_common_name):
		self._ca_common_name = ca_common_name
		self._node_common_name = node_common_name

	@property
	def ca_common_name(self):
		return self._ca_common_name.text

	@property
	def node_common_name(self):
		return self._node_common_name.text

	def __repr__(self):
		return f'(ca_common_name=\'{self.ca_common_name}\', node_common_name=\'{self.node_common_name}\')'


def create(_screens):
	# needs new certificates?

	peer_cert_name_ca = TextArea(multiline=False, )
	peer_cert_name_node = TextArea(multiline=False)

	# TODO: probably need to add peer_cert_name_ca and peer_cert_name_node somewhere,
	# as I'm not sure if we can easily access values there...

	return ScreenDialog(
		screen_id='certificates',
		title=_('wizard-peer-cert-names-title'),
		body=VSplit([
			HSplit([
				Label('Cert CA name'),
				Label('Cert Peer name'),
			], width=30),
			HSplit([
				peer_cert_name_ca,
				peer_cert_name_node,
			]),
		]),

		accessor=CertSettings(peer_cert_name_ca, peer_cert_name_node)
	)
