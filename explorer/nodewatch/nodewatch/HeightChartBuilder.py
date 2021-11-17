import json

import pandas as pd
import plotly
import plotly.express as px


class DataPoint:
    def __init__(self):
        self.height_count = 0
        self.height_power = 0
        self.finalized_height_count = 0
        self.finalized_height_power = 0


class HeightChartBuilder:
    def __init__(self):
        self.all = {}
        self.height_fields = []

    def add(self, descriptors, height_field, label):
        self._process(self.all, descriptors, height_field)
        self.height_fields.append((height_field, label))

    @staticmethod
    def _process(height_data_point_map, descriptors, height_field):
        count_field = '{}_count'.format(height_field)
        power_field = '{}_power'.format(height_field)

        for descriptor in descriptors:
            height = getattr(descriptor, height_field)
            power = descriptor.balance
            if height not in height_data_point_map:
                height_data_point_map[height] = DataPoint()

            data_point = height_data_point_map[height]
            setattr(data_point, count_field, getattr(data_point, count_field) + 1)
            setattr(data_point, power_field, getattr(data_point, power_field) + power)

    def create_chart(self):
        data_vectors = {'height': [], 'count': [], 'power': [], 'label': []}
        for (height_field, label) in self.height_fields:
            count_field = '{}_count'.format(height_field)
            power_field = '{}_power'.format(height_field)

            for height, data_point in self.all.items():
                if not height:
                    continue

                count = getattr(data_point, count_field)
                power = getattr(data_point, power_field)
                if not count:
                    continue

                data_vectors['height'].append(height)
                data_vectors['count'].append(count)
                data_vectors['power'].append(power)
                data_vectors['label'].append(label)

        data_frame = pd.DataFrame(data_vectors)
        figure = px.scatter(
            data_frame,
            y='count',
            x='height',
            color='label',
            size='power',
            size_max=75)
        figure.update_xaxes(tickformat='d')

        return json.dumps(figure, cls=plotly.utils.PlotlyJSONEncoder)
