import LogoWordmarkSrc from '../../assets/images/logo-wordmark.svg';
import LogoImageSrc from '../../assets/images/nem-logo-2.png';
import React from 'react';
import './Header.scss';

const Header = function () {
	return (
		<div className="header">
			<div className="logo">
				<img src={LogoImageSrc} alt="Logo" className="logo-image" />
				<img src={LogoWordmarkSrc} alt="Faucet" className="logo-wordmark" />
			</div>
		</div>
	);
};

export default Header;
