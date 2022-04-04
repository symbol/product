import './Home.scss';
import Balances from '../Balances';
import Completed from '../Completed';
import Requests from '../Requests';
import { TabView, TabPanel } from 'primereact/tabview';
import React from 'react';
import 'react-tabs/style/react-tabs.css';

const tabConfig = {
	balance: {
		label: 'Balances',
		table: <Balances />
	},
	completed: {
		label: 'Completed',
		table: <Completed />
	},
	inProgress : {
		label: 'In Progress',
		table: <Requests />
	}
};

const Home = function () {
	const renderTabList = () => {
		return Object.keys(tabConfig).map(key => {
			return (
				<TabPanel header={tabConfig[key].label}>
					{tabConfig[key].table}
				</TabPanel>
			);
		});
	};

	return (
		<div className='App'>
			<div className='bgContainer' />
			<div className='mainContainerWrapper'>
				<div className='mainContainer'>
					<h2>Opt-in Summary</h2>
				</div>
				<TabView>
					{ renderTabList() }
				</TabView>
			</div>
		</div>
	);
};

export default Home;
