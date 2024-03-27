import Image from 'next/image';

const Button = ({ children, className, icon, ...props }) => {
	const combinedClassName = `bg-[#333333] justify-center
		border-2 border-white p-2 inline-flex items-center rounded-xl ${className || ''}`;

	return (
		<button className={combinedClassName} {...props}>
			{icon && <Image width={24} height={24} src={icon} className="mr-2" alt='' />}
			{children}
		</button>
	);
};

export default Button;
