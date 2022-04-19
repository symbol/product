import Home from './pages/Home';
import reportWebVitals from './reportWebVitals';
import React from 'react';
import ReactDOM from 'react-dom';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import 'primeflex/primeflex.css';
import 'primereact/resources/themes/lara-light-purple/theme.css';
import './styles/globals.scss';
//import 'primereact/resources/themes/bootstrap4-light-blue/theme.css';
//import 'primereact/resources/themes/bootstrap4-light-purple/theme.css';
//import 'primereact/resources/themes/bootstrap4-dark-blue/theme.css';

ReactDOM.render(
	<React.StrictMode>
		<Home />
	</React.StrictMode>,
	document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
