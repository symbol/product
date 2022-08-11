from collections import namedtuple

import pandas as pd

VersionCustomization = namedtuple('VersionCustomization', ['color', 'weight'])


def pods_to_dataframe(pods):
	"""Maps an array of plain old data objects to a data frame, such that each field corresponds to a column."""

	field_names = pods[0]._fields
	data_vectors = {field_name: [getattr(pod, field_name) for pod in pods] for field_name in field_names}
	return pd.DataFrame(data_vectors)


class VersionCustomizations:
	"""Configures version-based customizations."""

	def __init__(self, customizations):
		"""Creates version customizations."""

		self.customizations = {version: VersionCustomization(*tuple) for version, tuple in customizations.items()}

	def to_color_map(self):
		"""Creates a version to color map."""

		return {version: customization.color for version, customization in self.customizations.items()}

	def get_weight(self, version):
		"""Gets the weight (priority) of the specified version."""

		return self.customizations.get(version, VersionCustomization(None, 0)).weight


class VersionAggregator:
	"""Aggregates descriptor information by version."""

	def __init__(self, data_point_class, secondary_key=None):
		"""Creates an aggregator."""

		self.data_point_class = data_point_class
		self.secondary_key = secondary_key

		self.map = {}

	def add(self, descriptors, balance_field, count_field):
		"""Adds descriptors to the aggregation."""

		for descriptor in descriptors:
			key = self._get_key(descriptor)
			if key not in self.map:
				self.map[key] = self.data_point_class()

			data_point = self.map[key]
			if balance_field:
				setattr(data_point, balance_field, getattr(data_point, balance_field) + descriptor.balance)

			if count_field:
				setattr(data_point, count_field, getattr(data_point, count_field) + 1)

	def _get_key(self, descriptor):
		if not self.secondary_key:
			return descriptor.version

		return f'{descriptor.version}@{getattr(descriptor, self.secondary_key)}'
