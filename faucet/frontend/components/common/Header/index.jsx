import React from 'react';

const Header = function (props) {
	const { logoImageSrc, logoWordmarkSrc, faucetAddressLink } = props;

	return (
		<div className="header">
			<div className="logo">
				<img src={logoImageSrc.src} alt="Logo" className="logo-image" />
				<a className="faucet-address-link" target="_blank" href={faucetAddressLink} rel="noreferrer">
					<img src={logoWordmarkSrc.src} alt="Faucet" className="logo-wordmark" />
				</a>
			</div>
		</div>
	);
};

export default Header;
