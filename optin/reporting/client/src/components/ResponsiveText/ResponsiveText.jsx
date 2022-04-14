import React from 'react';
import './ResponsiveText.scss';

const ResponsiveText = ({value, lastPartLength = 8}) => {

	return (
		<React.Fragment>
			<div class="container-responsive-text">
				<span class="firstPart">{value.substring(0, value.length - lastPartLength)}</span>
				<span class="lastPart">{value.substring(value.length - lastPartLength)}</span>
			</div>
			<div class="container-full-text">
				{value}
			</div>
		</React.Fragment>
	);
};

export default ResponsiveText;