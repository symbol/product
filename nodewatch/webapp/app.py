import argparse
from collections import namedtuple
from pathlib import Path

import dash
import pandas as pd
import plotly.express as px
from dash import dash_table, dcc, html

from .NemLoader import NemLoader
from .SymbolLoader import SymbolLoader
from .VersionSummary import VersionSummary, group_version_summaries_by_tag

COLORS = namedtuple('Colors', ['success', 'neutral', 'failure'])('lightgreen', 'lightyellow', 'pink')


class WebApp:
    def __init__(self, resources_path):
        self.resources_path = Path(resources_path)

        self.nem_loader = None
        self.symbol_loader = None

        self.app = dash.Dash(__name__)
        self.app.title = 'Pirate Fork Progress'

    def reload(self):
        self.nem_loader = NemLoader(self.resources_path / 'nem_harvesters.csv')
        self.nem_loader.load()

        self.symbol_loader = SymbolLoader(self.resources_path / 'symbol_richlist.csv', {
            'AllNodes': self.resources_path / 'symbol_allnodes_addresses.txt',
            'NGL': self.resources_path / 'symbol_ngl_addresses.txt',
        })
        self.symbol_loader.load()

    def make_symbol_figure(self):
        version_summaries = self.symbol_loader.aggregate(lambda descriptor: descriptor.is_voting and 'NGL' not in descriptor.categories)
        return self._make_bar_graph(version_summaries, 'Cyprus Hardfork Progress', 0.67, {
            'for': COLORS.success, 'against': COLORS.failure
        })

    def make_symbol_allnodes_figure(self):
        version_summaries = self.symbol_loader.aggregate(lambda descriptor: descriptor.is_voting and 'AllNodes' in descriptor.categories)
        return self._make_bar_graph(version_summaries, 'Cyprus Hardfork Progress (AllNodes)', 0.67, {
            'for': COLORS.success, 'against': COLORS.failure
        })

    def make_nem_figure(self):
        version_summaries = self.nem_loader.aggregate()
        return self._make_bar_graph(version_summaries, 'Harlock Hardfork Progress', 0.5, {
            'for': COLORS.success, 'delegating / updating': COLORS.neutral, 'against': COLORS.failure
        })

    @staticmethod
    def _make_bar_graph(version_summaries, title, threshold, key_color_map):
        grouped_version_summaries = group_version_summaries_by_tag(version_summaries.values())
        aggregate_version_summary = VersionSummary.aggregate_all(grouped_version_summaries.values())

        data_vectors = {'key': [], 'measure': [], 'percentage': [], 'label': []}
        for key in key_color_map:
            for measure in ['count', 'power']:
                data_vectors['key'].append(key)
                data_vectors['measure'].append(measure)

                value = getattr(grouped_version_summaries[key], measure)
                percentage = value / getattr(aggregate_version_summary, measure)
                data_vectors['percentage'].append(percentage)

                data_vectors['label'].append('{:.2f}%<br>({:,.0f})'.format(percentage * 100, value))

        data_frame = pd.DataFrame(data_vectors)
        figure = px.bar(
            data_frame,
            y='measure',
            x='percentage',
            color='key',
            text='label',
            title=title,
            color_discrete_map=key_color_map,
            orientation='h')
        figure.add_vline(x=threshold, line_dash='dot', line_color='#B429F9', annotation_text='TARGET')
        return figure

    def make_symbol_table(self):
        return self._make_table(
            [descriptor for descriptor in self.symbol_loader.descriptors if descriptor.is_voting and 'NGL' not in descriptor.categories],
            ['address', 'name', 'host', 'balance', 'version', 'voting_end_epoch'],
            SymbolLoader.version_to_tag)

    def make_nem_table(self):
        return self._make_table(
            [descriptor for descriptor in self.nem_loader.descriptors if descriptor.version],
            ['main_address', 'name', 'host', 'balance', 'version'],
            NemLoader.version_to_tag)

    @staticmethod
    def _make_table(descriptors, column_names, version_to_tag):
        return dash_table.DataTable(
            data=[
                {
                    'tag': version_to_tag(descriptor.version),
                    **{name: str(getattr(descriptor, name)) for name in column_names}
                } for descriptor in descriptors
            ],
            columns=[{'id': name, 'name': name} for name in column_names],
            style_data_conditional=[
                {
                    'if': {'filter_query': '{tag} eq "for"'},
                    'backgroundColor': COLORS.success
                },
                {
                    'if': {'filter_query': '{tag} eq "against"'},
                    'backgroundColor': COLORS.failure
                },
            ])

    def layout(self):
        self.app.layout = html.Div(children=[
            html.H1(children='Cyprus Hardfork Progress'),
            dcc.Graph(id='cyprus-graph', figure=self.make_symbol_figure()),
            dcc.Graph(id='cyprus-allnodes-graph', figure=self.make_symbol_allnodes_figure()),

            html.H1(children='Harlock Hardfork Progress'),
            dcc.Graph(id='harlock-graph', figure=self.make_nem_figure()),

            html.H1(children='Cyprus Hardfork Table'),
            self.make_symbol_table(),

            html.H1(children='Harlock Hardfork Table'),
            self.make_nem_table()
        ])

    def run(self):
        self.app.run_server(debug=True)


def main():
    parser = argparse.ArgumentParser(description='webapp that processes data files and renders fork information')
    parser.add_argument('--resources', help='directory containing resources', required=True)
    args = parser.parse_args()

    app = WebApp(args.resources)
    app.reload()
    app.layout()
    app.run()


if '__main__' == __name__:
    main()
