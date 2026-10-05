import { useTranslation } from 'next-i18next';

const ValueRewardType = ({ value, className }) => {
	const { t } = useTranslation();

	return <div className={className}>{t(`rewardType_${value}`)}</div>;
};

export default ValueRewardType;
