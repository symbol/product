import React, { useEffect, useRef, useState } from 'react';

const Dropdown = ({ label, options, onSelect }) => {
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef(null);

	const handleClickOutside = event => {
		if (dropdownRef.current && !dropdownRef.current.contains(event.target))
			setIsOpen(false);
	};

	useEffect(() => {
		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, []);

	return (
		<div className="relative" ref={dropdownRef}>
			<button
				className="px-4 py-2 mx-1 bg-[#333333] rounded-xl flex items-center"
				onClick={() => setIsOpen(!isOpen)}
			>
				{label}
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 7.5L10 12.5L15 7.5H5Z" fill="white"/>
                </svg>
			</button>
			{isOpen && (
				<div className="absolute right-0 mt-2 py-2 w-48 bg-[#232329] rounded-xl">
					{options.map(({label, value}, index) => (
						<a
							key={index}
							href="#"
							className="block px-4 py-2 text-sm text-gray-700 hover:bg-[#333333] hover:text-white"
							onClick={e => {
								e.preventDefault();
								onSelect({label, value});
								setIsOpen(false);
							}}
						>
							{label}
						</a>
					))}
				</div>
			)}
		</div>
	);
};

export default Dropdown;
