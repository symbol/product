import './Home.scss';
import Completed from '../Completed';
import Balances from '../Balances';
import React from 'react';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
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
    table: 'In Progress'
  }
}

const Home = function () {
  const renderTabListItem = () => {
    return Object.keys(tabConfig).map((key) => {
      return (
          <Tab>{tabConfig[key].label}</Tab>
      )
    })
  }

  const renderTabContent = () => {
    return Object.keys(tabConfig).map((key) => {
      return (
        <TabPanel key={key}>
          {tabConfig[key].table}
        </TabPanel>
      )
    })
  }

  return (
    <div className='App'>
      <div className='bgContainer' />
      <div className='mainContainerWrapper'>
        <div className='mainContainer'>
          <h2>Opt-in Summary</h2>
        </div>
        <Tabs>
            <TabList>
              { renderTabListItem() }
            </TabList>

            { renderTabContent() }
          </Tabs>
      </div>
    </div>
  );
};

export default Home;
