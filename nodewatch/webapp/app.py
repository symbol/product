import argparse
import asyncio
import os
from collections import namedtuple
from pathlib import Path

import aiohttp
import dash
import pandas as pd
import plotly.express as px
from dash import dash_table, dcc, html
from dash.dependencies import Input, Output
from dash.exceptions import PreventUpdate
from zenlog import log

from .NemLoader import NemLoader
from .SymbolLoader import SymbolLoader
from .VersionSummary import VersionSummary, group_version_summaries_by_tag

NUM_HEIGHT_SAMPLES = 5

COLORS = namedtuple('Colors', ['success', 'neutral', 'failure'])('lightgreen', 'lightyellow', 'pink')


class WebApp:
    def __init__(self, resources_path, host, port, proxy, base_path, serve):  # pylint: disable=too-many-arguments
        self.resources_path = Path(resources_path)

        self.nem_loader = None
        self.symbol_loader = None
        self.mtime = os.path.getmtime(self.resources_path / 'nem_harvesters.csv')  # last file to be pulled

        self.host = host
        self.port = port
        self.proxy = proxy

        self.app = dash.Dash(__name__, serve_locally=serve, url_base_pathname=base_path)
        self.app.title = 'Pirate Fork Progress'

    def reload(self):
        self.nem_loader = NemLoader(self.resources_path / 'nem_nodes.json', self.resources_path / 'nem_harvesters.csv')
        self.nem_loader.load()

        self.symbol_loader = SymbolLoader(self.resources_path / 'symbol_nodes.json', self.resources_path / 'symbol_richlist.csv', {
            'AllNodes': self.resources_path / 'symbol_allnodes_addresses.txt',
            'NGL': self.resources_path / 'symbol_ngl_addresses.txt',
        })
        self.symbol_loader.load()

    def make_symbol_title(self):
        height_future = self._get_height_estimate('{}/chain/info', [
            descriptor for descriptor in self.symbol_loader.descriptors if descriptor.host.endswith(':3000')
        ])
        height = asyncio.run(height_future)

        blocks_remaining = 689761 - height
        hours_remaining = blocks_remaining // (2 * 60)
        return 'Cyprus Hardfork Progress ({} blocks, {} days and {} hours to go!)'.format(
            blocks_remaining,
            hours_remaining // 24,
            hours_remaining % 24)

    def make_nem_title(self):
        height_future = self._get_height_estimate('{}/chain/height', self.nem_loader.descriptors)
        height = asyncio.run(height_future)

        blocks_remaining = 3464800 - height
        hours_remaining = blocks_remaining // 60
        return 'Harlock Hardfork Progress ({} blocks, {} days and {} hours to go!)'.format(
            blocks_remaining,
            hours_remaining // 24,
            hours_remaining % 24)

    @staticmethod
    async def _get_height_estimate(url_pattern, descriptors):
        hosts = []
        for descriptor in descriptors:
            if not descriptor.host:
                continue

            hosts.append(descriptor.host)

            if NUM_HEIGHT_SAMPLES == len(hosts):
                break

        log.debug('querying height from hosts {{{}}}'.format(', '.join(hosts)))

        async with aiohttp.ClientSession() as session:
            tasks = [asyncio.ensure_future(WebApp.get_height(session, url_pattern.format(host))) for host in hosts]
            heights = await asyncio.gather(*tasks)

        # calculate median
        heights.sort()
        log.debug('retrieved heights {{{}}}'.format(', '.join(str(height) for height in heights)))

        return heights[len(heights) // 2]

    @staticmethod
    async def get_height(session, url):
        async with session.get(url) as resp:
            response_json = await resp.json()
            return int(response_json['height'])

    def make_symbol_figure(self):
        version_summaries = self.symbol_loader.aggregate(
            lambda descriptor: descriptor.is_voting and 'NGL' not in descriptor.categories,
            lambda descriptor: not descriptor.host.endswith('.symbolblockchain.io'))
        return self._make_bar_graph(version_summaries, 'Cyprus Hardfork Progress (Excluding NGL)', 0.67, {
            'for': COLORS.success, 'against': COLORS.failure
        })

    def make_symbol_allnodes_figure(self):
        version_summaries = self.symbol_loader.aggregate(
            lambda descriptor: descriptor.is_voting and 'AllNodes' in descriptor.categories,
            lambda descriptor: descriptor.host.endswith('.allnodes.me'))
        return self._make_bar_graph(version_summaries, 'Cyprus Hardfork Progress (Only AllNodes)', 0.67, {
            'for': COLORS.success, 'against': COLORS.failure
        })

    def make_nem_figure(self):
        version_summaries = self.nem_loader.aggregate()
        return self._make_bar_graph(version_summaries, 'Harlock Hardfork Progress', 0.5, {
            'for': COLORS.success, 'delegating / updating': COLORS.neutral, 'against': COLORS.failure
        })

    def make_nem_allnodes_figure(self):
        version_summaries = self.nem_loader.aggregate(
            lambda descriptor: '.allnodes.me:' in descriptor.host,
            lambda descriptor: descriptor.host.endswith('.allnodes.me'))
        return self._make_bar_graph(version_summaries, 'Harlock Hardfork Progress (Only AllNodes)', 0.5, {
            'for': COLORS.success, 'against': COLORS.failure
        })

    @staticmethod
    def _make_bar_graph(version_summaries, title, threshold, key_color_map):
        grouped_version_summaries = group_version_summaries_by_tag(version_summaries.values())
        aggregate_version_summary = VersionSummary.aggregate_all(grouped_version_summaries.values())

        data_vectors = {'key': [], 'measure': [], 'percentage': [], 'label': []}
        for key in key_color_map:
            for measure in ['count', 'node_count', 'power']:
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
            SymbolLoader.version_to_tag,
            'symbol-table')

    def make_nem_table(self):
        return self._make_table(
            [descriptor for descriptor in self.nem_loader.descriptors if descriptor.version],
            ['main_address', 'name', 'host', 'balance', 'version'],
            NemLoader.version_to_tag,
            'nem-table')

    @staticmethod
    def _make_table(descriptors, column_names, version_to_tag, identifier):
        return dash_table.DataTable(
            id=identifier,
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
            html.H1(id='cyprus-title', children=self.make_symbol_title()),
            dcc.Graph(id='cyprus-graph', figure=self.make_symbol_figure()),
            dcc.Graph(id='cyprus-allnodes-graph', figure=self.make_symbol_allnodes_figure()),

            html.H1(id='harlock-title', children=self.make_nem_title()),
            dcc.Graph(id='harlock-graph', figure=self.make_nem_figure()),
            dcc.Graph(id='harlock-allnodes-graph', figure=self.make_nem_allnodes_figure()),

            html.H1(children='Cyprus Hardfork Table'),
            self.make_symbol_table(),

            html.H1(children='Harlock Hardfork Table'),
            self.make_nem_table(),

            dcc.Interval(
                id='load-interval',
                interval=60000,  # in milliseconds
                n_intervals=0
            )
        ])

        def update_graphs(n_intervals):
            mtime = os.path.getmtime(self.resources_path / 'nem_harvesters.csv')
            if mtime > self.mtime:
                self.mtime = mtime
                log.debug(f'Updating at check {n_intervals}, modified time: {mtime}')
                self.reload()

                return (
                    self.make_symbol_title(),
                    self.make_symbol_figure(),
                    self.make_symbol_allnodes_figure(),
                    self.make_nem_title(),
                    self.make_nem_figure(),
                    self.make_nem_allnodes_figure(),
                    self.make_symbol_table().data,  # pylint: disable=no-member
                    self.make_nem_table().data  # pylint: disable=no-member
                )

            raise PreventUpdate()

        self.app.callback([
            Output('cyprus-title', 'children'),
            Output('cyprus-graph', 'figure'),
            Output('cyprus-allnodes-graph', 'figure'),
            Output('harlock-title', 'children'),
            Output('harlock-graph', 'figure'),
            Output('harlock-allnodes-graph', 'figure'),
            Output('symbol-table', 'data'),
            Output('nem-table', 'data'),
            Input('load-interval', 'n_intervals')])(update_graphs)

    def run(self):
        self.app.run_server(host=self.host, port=self.port, threaded=True, proxy=self.proxy, debug=True)


def main():
    parser = argparse.ArgumentParser(description='webapp that processes data files and renders fork information')
    parser.add_argument('--resources', help='directory containing resources', required=True)
    parser.add_argument('--host', help='host ip, defaults to localhost', default='127.0.0.1')
    parser.add_argument('--port', type=int, help='port for webserver', default=8080)
    parser.add_argument('--proxy', help='proxy spec of the form ip:port::gateway to render urls', default=None)
    parser.add_argument('--base_path', help='extension if server is not at root of url', default=None)
    parser.add_argument('--serve', action='store_true', help='flag to indicate whether server will recieve external requests')
    args = parser.parse_args()

    app = WebApp(args.resources, args.host, args.port, args.proxy, args.base_path, args.serve)
    app.reload()
    app.layout()
    app.run()


if '__main__' == __name__:
    main()
