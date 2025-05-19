import nemVariables from './app/nem/variables.json';
import symbolVariables from './app/symbol/variables.json';
import config from '@/config';

const listOfVariables = {
	nem: nemVariables,
	symbol: symbolVariables
};

export const getStyleVariables = () => listOfVariables[config.PLATFORM];
