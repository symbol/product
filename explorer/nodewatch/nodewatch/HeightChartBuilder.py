import json
from collections import namedtuple

import plotly
import plotly.express as px

from .chart_utils import VersionAggregator, pods_to_dataframe

ScatterPoint = namedtuple('ScatterPoint', ['version', 'height', 'count', 'power', 'label', 'point_label'])
HeightDescriptor = namedtuple('HeightDescriptor', ['field_name', 'label', 'power_field', 'count_field'])

HEIGHT_DESCRIPTOR = HeightDescriptor('height', 'height', 'height_power', 'height_count')
FINALIZED_HEIGHT_DESCRIPTOR = HeightDescriptor('finalized_height', 'finalized height', 'finalized_height_power', 'finalized_height_count')


class DataPoint:
    def __init__(self):
        self.height_count = 0
        self.height_power = 0
        self.finalized_height_count = 0
        self.finalized_height_power = 0


class HeightChartBuilder:
    def __init__(self, version_customizations, min_cluster_size=1):
        self.version_customizations = version_customizations
        self.min_cluster_size = min_cluster_size

        self.heights = VersionAggregator(DataPoint, HEIGHT_DESCRIPTOR.field_name)
        self.finalized_heights = VersionAggregator(DataPoint, FINALIZED_HEIGHT_DESCRIPTOR.field_name)

    def add_heights(self, descriptors):
        self.heights.add(descriptors, HEIGHT_DESCRIPTOR.power_field, HEIGHT_DESCRIPTOR.count_field)

    def add_finalized_heights(self, descriptors):
        self.finalized_heights.add(descriptors, FINALIZED_HEIGHT_DESCRIPTOR.power_field, FINALIZED_HEIGHT_DESCRIPTOR.count_field)

    def create_chart(self):
        scatter_points = []
        self._append_scatter_points(scatter_points, self.heights.map, HEIGHT_DESCRIPTOR)
        self._append_scatter_points(scatter_points, self.finalized_heights.map, FINALIZED_HEIGHT_DESCRIPTOR)

        scatter_points.sort(key=lambda scatter_point: self.version_customizations.get_weight(scatter_point.version), reverse=True)
        data_frame = pods_to_dataframe(scatter_points)

        figure = px.scatter(
            data_frame,
            y='count',
            x='height',
            color='version',
            color_discrete_map=self.version_customizations.to_color_map(),
            symbol='label',
            symbol_map={HEIGHT_DESCRIPTOR.label: 'circle', FINALIZED_HEIGHT_DESCRIPTOR.label: 'diamond'},
            text='point_label',
            size='power',
            size_max=75)
        figure.update_xaxes(tickformat='d')

        return json.dumps(figure, cls=plotly.utils.PlotlyJSONEncoder)

    def _append_scatter_points(self, scatter_points, version_data_point_map, height_descriptor):
        for version_height_key, data_point in version_data_point_map.items():
            parts = version_height_key.split('@')
            version = parts[0]
            height = None if not parts[1] else int(parts[1])

            if not height:
                continue

            count = getattr(data_point, height_descriptor.count_field)
            power = getattr(data_point, height_descriptor.power_field)
            if count < self.min_cluster_size:
                continue

            point_label = '{}M'.format(round(power / 1000000))
            scatter_points.append(ScatterPoint(version, height, count, power, height_descriptor.label, point_label))
