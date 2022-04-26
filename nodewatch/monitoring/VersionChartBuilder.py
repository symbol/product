import json
from collections import namedtuple

import plotly
import plotly.express as px

from .chart_utils import VersionAggregator, pods_to_dataframe

BarSection = namedtuple('BarSection', ['version', 'percentage', 'label', 'group'])


class DataPoint:
    def __init__(self):
        self.voting_power = 0
        self.harvesting_power = 0
        self.harvesting_count = 0
        self.node_count = 0


class VersionChartBuilder:
    def __init__(self, version_customizations):
        self.all = VersionAggregator(DataPoint)
        self.allnodes = VersionAggregator(DataPoint)
        self.ex_allnodes = VersionAggregator(DataPoint)
        self.version_customizations = version_customizations

    def add(self, descriptors, balance_field=None, count_field=None):
        def _is_all_nodes(descriptor):
            return '.allnodes.me:' in descriptor.endpoint

        def _is_not_all_nodes(descriptor):
            return not _is_all_nodes(descriptor)

        self.all.add(descriptors, balance_field, count_field)
        self.allnodes.add(filter(_is_all_nodes, descriptors), balance_field, count_field)
        self.ex_allnodes.add(filter(_is_not_all_nodes, descriptors), balance_field, count_field)

    def create_chart(self, measure, threshold=None):
        sections = []
        self._append_bar_sections(sections, self.all.map, measure, 'All')
        self._append_bar_sections(sections, self.allnodes.map, measure, 'All Nodes')
        self._append_bar_sections(sections, self.ex_allnodes.map, measure, 'Ex All Nodes')

        sections.sort(key=lambda section: self.version_customizations.get_weight(section.version), reverse=True)
        data_frame = pods_to_dataframe(sections)

        figure = px.bar(
            data_frame,
            y='group',
            x='percentage',
            color='version',
            text='label',
            color_discrete_map=self.version_customizations.to_color_map(),
            orientation='h')

        figure.update_layout(yaxis={'categoryorder': 'array', 'categoryarray': ['Ex All Nodes', 'All Nodes', 'All']})

        if threshold:
            figure.add_vline(x=threshold, line_dash='dot', line_color='#B429F9', annotation_text='TARGET')

        return json.dumps(figure, cls=plotly.utils.PlotlyJSONEncoder)

    @staticmethod
    def _append_bar_sections(sections, version_data_point_map, measure, group):
        total_value = sum([getattr(data_point, measure) for _, data_point in version_data_point_map.items()])

        for version in version_data_point_map:
            friendly_version_name = version if version else 'delegating / updating'

            value = getattr(version_data_point_map[version], measure)
            percentage = 100 * value / total_value
            label = f'{percentage:.2f}%<br>({value:,.0f})'
            sections.append(BarSection(friendly_version_name, percentage, label, group))
