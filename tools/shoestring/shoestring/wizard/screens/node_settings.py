from prompt_toolkit.filters import Condition
from prompt_toolkit.layout.containers import ConditionalContainer, HSplit, VSplit
from prompt_toolkit.widgets import CheckboxList, Label, TextArea

from shoestring.wizard.Screen import ScreenDialog
from shoestring.wizard.ValidatingTextBox import ValidatingTextBox, is_hostname, is_ip_address, is_json


def _to_enabled_string(value):
	return 'enabled' if value else 'disabled'


class NodeSettings:
	def __init__(self, https_flag, domain_name, friendly_name, metadata_info):
		self._https_flag = https_flag
		self._domain_name = domain_name
		self._friendly_name = friendly_name
		self._metadata_info = metadata_info

	@property
	def api_https(self):
		return bool(self._https_flag.current_values)

	@property
	def domain_name(self):
		return self._domain_name.input.text

	@property
	def friendly_name(self):
		return self._friendly_name.text

	@property
	def metadata_info(self):
		return self._metadata_info.input.text

	@property
	def tokens(self):
		return [
			('https', _to_enabled_string(self.api_https)),
			('domain name', self.domain_name),
			('friendly name', self.friendly_name),
			('metadata', self.metadata_info),
		]

	def __repr__(self):
		return (
			f'(https={self.api_https}, '
			f'domain_name=\'{self.domain_name}\', '
			f'friendly_name=\'{self.friendly_name}\', '
			f'metadata_info=\'{self.metadata_info}\')'
		)


def create(screens):
	https_flag = CheckboxList(values=[
		('node-https-bool', 'enable https for API (using https-portal), requires registered domain name')
	])

	friendly_name = TextArea(multiline=False)

	def is_valid_ip_or_domain_name(value):
		if is_ip_address(value):
			return not https_flag.current_values

		return is_hostname(value)

	ip_or_domain_name = ValidatingTextBox(
		'IP or domain name',
		is_valid_ip_or_domain_name,
		'valid hostname is required when https is selected, otherwise valid IP address or hostname is required')

	metadata_info = ValidatingTextBox(
		'Node metadata information (description)',
		is_json,
		'metadata must be specified as valid JSON',
		multiline=True)

	return ScreenDialog(
		screen_id='node-settings',
		title=_('wizard-node-https-title'),  # TODO: change title
		body=HSplit([
			# only show https option if it's a dual node
			ConditionalContainer(
				HSplit([
					https_flag,
				]),
				filter=Condition(lambda: 'dual' == screens.get('node-type').current_value)
			),
			VSplit([
				HSplit([
					ip_or_domain_name.label,
					Label('Friendly node name'),
					metadata_info.label
				], width=30),
				HSplit([
					ip_or_domain_name.input,
					friendly_name,
					metadata_info.input
				])
			])
		]),
		accessor=NodeSettings(https_flag, ip_or_domain_name, friendly_name, metadata_info),
		is_valid=lambda: ip_or_domain_name.is_valid and metadata_info.is_valid
	)
