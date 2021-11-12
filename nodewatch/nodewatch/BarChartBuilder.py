import json
from collections import namedtuple

import pandas as pd
import plotly
import plotly.express as px

BarSection = namedtuple('BarSection', ['version', 'percentage', 'label', 'group'])


class DataPoint:
    def __init__(self):
        self.voting_power = 0
        self.harvesting_power = 0
        self.harvesting_count = 0
        self.node_count = 0


class BarChartBuilder:
    def __init__(self, version_customizations):
        self.all = {}
        self.allnodes = {}
        self.ex_allnodes = {}
        self.version_customizations = version_customizations

    def add(self, descriptors, balance_field=None, count_field=None):
        def _is_all_nodes(descriptor):
            return '.allnodes.me:' in descriptor.endpoint

        def _is_not_all_nodes(descriptor):
            return not _is_all_nodes(descriptor)

        self._process(self.all, descriptors, balance_field, count_field)
        self._process(self.allnodes, filter(_is_all_nodes, descriptors), balance_field, count_field)
        self._process(self.ex_allnodes, filter(_is_not_all_nodes, descriptors), balance_field, count_field)

    @staticmethod
    def _process(version_data_point_map, descriptors, balance_field, count_field):
        for descriptor in descriptors:
            if descriptor.version not in version_data_point_map:
                version_data_point_map[descriptor.version] = DataPoint()

            data_point = version_data_point_map[descriptor.version]
            if balance_field:
                setattr(data_point, balance_field, getattr(data_point, balance_field) + descriptor.balance)

            if count_field:
                setattr(data_point, count_field, getattr(data_point, count_field) + 1)

    def create_chart(self, measure, threshold=None):
        sections = []
        self._append_bar_sections(sections, self.all, measure, 'All')
        self._append_bar_sections(sections, self.allnodes, measure, 'All Nodes')
        self._append_bar_sections(sections, self.ex_allnodes, measure, 'Ex All Nodes')
        sections.sort(key=lambda section: self.version_customizations.get(section.version, (None, 1000))[1])

        data_vectors = {'version': [], 'group': [], 'percentage': [], 'label': []}
        for section in sections:
            data_vectors['version'].append(section.version)
            data_vectors['group'].append(section.group)
            data_vectors['percentage'].append(section.percentage)
            data_vectors['label'].append(section.label)

        data_frame = pd.DataFrame(data_vectors)
        figure = px.bar(
            data_frame,
            y='group',
            x='percentage',
            color='version',
            text='label',
            color_discrete_map={version: tuple[0] for version, tuple in self.version_customizations.items()},
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
            percentage = value / total_value
            label = '{:.2f}%<br>({:,.0f})'.format(percentage * 100, value)
            sections.append(BarSection(friendly_version_name, percentage, label, group))
