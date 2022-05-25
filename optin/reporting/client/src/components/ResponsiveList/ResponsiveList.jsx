import PopUpDialog from '../PopUpDialog';
import React from 'react';
import './ResponsiveList.scss';

const ResponsiveList = props => {

	return (
		<React.Fragment>
			<div className="container-full-list" data-testid="full-list">
				{React.Children.toArray(props.children)}
			</div>
			<div className="container-responsive-list">
				<div className="container-responsive-list-visible" data-testid="visible-text">
					{props?.visible ?? ((props.children && props.children[0]) || '')}
				</div>
				{
					1 < ((props.children && props.children.length) || 0) &&
					<div className="container-responsive-list-more">
						<PopUpDialog content={props.children} buttonText={props.showMoreText ?? 'more'} title={props.title ?? 'more'}/>
					</div>
				}
			</div>
		</React.Fragment>
	);
};

export default ResponsiveList;
