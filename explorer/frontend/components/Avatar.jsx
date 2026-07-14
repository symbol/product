import CustomImage from './CustomImage';
import IconTransactionType from './IconTransactionType';
import config from '@/app/config';
import { useConfig } from '@/app/contexts/ConfigContext';
import styles from '@/app/styles/components/Avatar.module.scss';
import { createAssetURL } from '@/app/utils';
import makeBlockie from 'ethereum-blockies-base64';
import { useEffect, useState } from 'react';

const AccountAvatar = ({ address }) => {
	const [image, setImage] = useState('');
	const [isKnownAccount, setIsKnownAccount] = useState(false);
	const [description, setDescription] = useState('');
	const { knownAccounts } = useConfig();

	const setKnownAccountInfo = address => {
		setImage(knownAccounts[address].image);
		setDescription(knownAccounts[address].description);
		setIsKnownAccount(true);
	};
	const generateImage = address => {
		const image = makeBlockie(address);
		setImage(image);
		setDescription(address);
	};

	useEffect(() => {
		// Known account: use its stored avatar and description
		if (knownAccounts && knownAccounts[address]) 
			setKnownAccountInfo(address);
		
		// Otherwise generate an identicon from the address
		else if (knownAccounts) 
			generateImage(address);
		
	}, [address, knownAccounts]);

	return (
		<div className={styles.accountImageContainer} title={description}>
			{!!image && <img src={image} className={styles.accountIdenticon} style={image.style} alt="Account icon background" />}
			{!isKnownAccount && (
				<CustomImage className={styles.accountIcon} src={createAssetURL('/images/icon-account.svg')} alt="Account icon" />
			)}
		</div>
	);
};

const MosaicAvatar = ({ mosaicId }) => {
	const mosaicIdSrcMap = {
		[config.PUBLIC_NATIVE_MOSAIC_ID]: createAssetURL('/images/mosaics/currency.png')
	};
	const customMosaicSrc = createAssetURL('/images/mosaics/custom.png');
	const imageSrc = mosaicIdSrcMap[mosaicId] ? mosaicIdSrcMap[mosaicId] : customMosaicSrc;

	return <CustomImage src={imageSrc} className={styles.image} alt="Mosaic" />;
};

const NamespaceAvatar = () => {
	return <CustomImage src={createAssetURL('/images/namespaces/namespace.svg')} className={styles.image} alt="Namespace" />;
};

const BlockAvatar = () => {
	return <CustomImage src={createAssetURL('/images/blocks/block.svg')} className={styles.image} alt="Block" />;
};

const NodeAvatar = () => {
	return <CustomImage src={createAssetURL('/images/nodes/node.svg')} className={styles.image} alt="Node" />;
};

const TransactionAvatar = ({ type }) => {
	return (
		<div className={styles.imageContainerTransactionType}>
			<IconTransactionType value={type} className={styles.imageTransactionType} />
		</div>
	);
};

const Avatar = ({ size, type, value, dot }) => {
	const sizeStyleMap = {
		sm: styles.containerSm,
		md: styles.containerMd,
		lg: styles.containerLg,
		xl: styles.containerXl
	};
	const dotStyleMap = {
		red: styles.dotRed,
		green: styles.dotGreen
	};

	const ChildComponent =
		type === 'account' ? (
			<AccountAvatar address={value} />
		) : type === 'mosaic' ? (
			<MosaicAvatar mosaicId={value} />
		) : type === 'transaction' ? (
			<TransactionAvatar type={value} />
		) : type === 'block' ? (
			<BlockAvatar />
		) : type === 'node' ? (
			<NodeAvatar />
		) : type === 'namespace' ? (
			<NamespaceAvatar namespaceId={value} />
		) : null;

	return (
		<div className={`${styles.container} ${sizeStyleMap[size]}`}>
			{ChildComponent}
			{!!dot && <div className={dotStyleMap[dot]} />}
		</div>
	);
};

export default Avatar;
