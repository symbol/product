import React from 'react';

const Input = ({ label, placeholder, value, onChange, type = 'text', className, disabled = false, ...props }) => {
	const combinedClassName = `flex flex-col ${className || ''}`;

	return (
		<div className={combinedClassName} {...props}>
			{label && <label className="mb-2 text-sm font-medium">{label}</label>}
			<input
				type={type}
				value={value}
				placeholder={placeholder}
				onChange={e => onChange(e.target.value)}
				className="w-full px-4 py-2 text-black bg-[#D9D9D9] rounded-xl"
				disabled={disabled}
			/>
		</div>
	);
};

export default Input;
