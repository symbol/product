import React from 'react';
import './ResponsiveText.scss';

const ResponsiveText = ({value, lastPartLength = 8}) => {

	return (
		<React.Fragment>
			<div className="container-responsive-text">
				<span className="firstPart" data-testid="first-part">{value.substring(0, value.length - lastPartLength)}</span>
				<span className="lastPart" data-testid="last-part">{value.substring(value.length - lastPartLength)}</span>
			</div>
			<div className="container-full-text">
				{value}
			</div>
		</React.Fragment>
	);
};

export default ResponsiveText;
