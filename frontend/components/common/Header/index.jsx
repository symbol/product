import React from 'react';

const Header = function (props) {
	const { logoImageSrc, logoWordmarkSrc } = props;

	return (
		<div className="header">
			<div className="logo">
				<img src={logoImageSrc} alt="Logo" className="logo-image" />
				<img src={logoWordmarkSrc} alt="Faucet" className="logo-wordmark" />
			</div>
		</div>
	);
};

export default Header;
