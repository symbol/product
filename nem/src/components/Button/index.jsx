import React from 'react';
import './Button.scss';

const Button = function (props) {
	const { children, onClick, isLoading } = props;

	return (
		<button className="button" onClick={onClick} disabled={isLoading}>
			{children}
		</button>
	);
};

export default Button;
