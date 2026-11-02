from rest.model.format import format_timestamp


class SymbolNamespaceView:  # pylint: disable=too-many-instance-attributes
	"""Persisted Symbol namespace list view."""

	def __init__(self, **kwargs):
		self.namespace_id = kwargs['namespace_id'].upper()
		self.full_name = kwargs['full_name']
		self.levels = kwargs['levels']
		self.alias_type = kwargs['alias_type']
		self.alias_mosaic_id = kwargs['alias_mosaic_id']
		self.alias_address = kwargs['alias_address']
		self.owner_address = kwargs['owner_address']
		self.start_height = kwargs['start_height']
		self.start_timestamp = kwargs['start_timestamp']
		self.registration_type = kwargs['registration_type']
		self.end_height = kwargs['end_height']
		self.sub_namespace_count = kwargs['sub_namespace_count']

	def to_dict(self):
		"""Formats the namespace as the public list JSON object."""

		return {
			'id': self.namespace_id,
			'name': self.namespace_id,
			'namespaceName': self.full_name if self.full_name is not None else self.namespace_id,
			'namespaceLevels': self.levels,
			'aliasType': self.alias_type,
			'aliasMosaicId': self.alias_mosaic_id.upper() if self.alias_mosaic_id is not None else None,
			'aliasAddress': self.alias_address,
			'creator': self.owner_address,
			'registrationHeight': self.start_height,
			'startTimestamp': format_timestamp(self.start_timestamp),
			'registrationType': self.registration_type,
			'expirationHeight': self.end_height,
			'isUnlimitedDuration': self.end_height is None,
			'subNamespaceCount': self.sub_namespace_count
		}
