import React, { useEffect, useRef } from 'react';

const ModalBox = ({ children, isOpen, onRequestClose }) => {
	const modalRef = useRef(null);

	useEffect(() => {
		const handleClickOutside = event => {
			if (modalRef.current && !modalRef.current.contains(event.target))
				onRequestClose();
		};

		const handleEscPress = event => {
			if ('Escape' === event.key)
				onRequestClose();

		};

		document.addEventListener('mousedown', handleClickOutside);
		document.addEventListener('keydown', handleEscPress);

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleEscPress);
		};
	}, [onRequestClose]);

	if (!isOpen)
		return null;

	return (
		<>
			<div role='overlay' className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
				<div role='modal' className="bg-[#232329] p-6 rounded-lg shadow-lg max-w-[400px]" ref={modalRef}>
					{children}
				</div>
			</div>
		</>
	);
};

export default ModalBox;
