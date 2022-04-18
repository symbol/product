import './Home.scss';
import Completed from '../Completed';
import Requests from '../Requests';
import { TabView, TabPanel } from 'primereact/tabview';
import React from 'react';
import 'react-tabs/style/react-tabs.css';

const tabConfig = {
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
				<TabPanel header={tabConfig[key].label} key={key}>
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
				<div className='tableContainer'>
					<TabView>
						{ renderTabList() }
					</TabView>
				</div>
			</div>
		</div>
	);
};

export default Home;
