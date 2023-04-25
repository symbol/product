import { loadHome } from './loadHome';
import { registerRoot } from './registerRoot';
import reportWebVitals from './reportWebVitals';

const main = async () => {
	const HomeComponent = await loadHome(process.env.REACT_APP_BUILD_TARGET);
	registerRoot(HomeComponent);
};

main();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
