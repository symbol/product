import PropTypes from 'prop-types';
import React from 'react';
import './TextBox.scss';

const TextBox = function (props) {
	const {
		min, max, placeholder, type, value, onChange
	} = props;

	const handleChange = e => {
		onChange(e.target.value);
	};

	return <input className="text-box" value={value} placeholder={placeholder} type={type} min={min} max={max} onChange={handleChange} />;
};

TextBox.propTypes = {
	min: PropTypes.number,
	max: PropTypes.number,
	placeholder: PropTypes.string,
	type: PropTypes.string,
	value: PropTypes.oneOfType([
		PropTypes.string,
		PropTypes.number
	]),
	onChange: PropTypes.func
};

export default TextBox;
