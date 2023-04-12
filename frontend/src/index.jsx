import reportWebVitals from './reportWebVitals';
import React from 'react';
import ReactDOM from 'react-dom';

const registerRootComponent = Component => {
	ReactDOM.render(
		<React.StrictMode>
			<Component />
		</React.StrictMode>,
		document.getElementById('root')
	);
};

switch (process.env.REACT_APP_BUILD_TARGET) {
case 'nem':
	import('./nem/pages/Home').then(NEMHome => registerRootComponent(NEMHome.default));
	break;
case 'symbol':
	import('./symbol/pages/Home').then(SymbolHome => registerRootComponent(SymbolHome.default));
	break;
default:
	throw Error('The build target is not specified');
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
