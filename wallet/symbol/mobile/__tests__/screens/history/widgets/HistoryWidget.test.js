import { HistoryWidget } from '@/app/screens/history/widgets/HistoryWidget';
import { runRenderTextTest } from '__tests__/component-tests';
import { mockLocalization } from '__tests__/mock-helpers';

const NETWORK_IDENTIFIER = 'testnet';
const CHAIN_NAME = 'symbol';
const TICKER = 'XYM'; 

const createProps = () => {
	return {
		unconfirmed: [],
		partial: [],
		networkIdentifier: NETWORK_IDENTIFIER,
		chainName: CHAIN_NAME,
		ticker: TICKER
	};
};

describe('widgets/HistoryWidget', () => {
	beforeEach(() => {
		mockLocalization();
	});

	runRenderTextTest(HistoryWidget, {
		props: createProps(),
		textToRender: [
			{ type: 'text', value: 's_history_widget_name' }
		]
	});
});
