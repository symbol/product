
import React from 'react';
import { View } from 'react-native';

const MockReorderableList = ({ data, renderItem, keyExtractor }) => (
	<View testID="reorderable-list">
		{data.map((item, index) => (
			<View key={keyExtractor(item)} testID={`list-item-${index}`}>
				{renderItem({ item, index })}
			</View>
		))}
	</View>
);

export const useReorderableDrag = () => jest.fn();

export default MockReorderableList;
