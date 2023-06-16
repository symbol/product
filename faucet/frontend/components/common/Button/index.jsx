import React from 'react';

const Button = function (props) {
	const { children, onClick, isLoading } = props;

	return (
		<button className="button" onClick={onClick} disabled={isLoading}>
			{children}
		</button>
	);
};

export default Button;
