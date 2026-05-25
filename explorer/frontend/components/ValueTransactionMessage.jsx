import CustomImage from './CustomImage';
import styles from '@/styles/components/ValueTransactionMessage.module.scss';
import { useTranslation } from 'next-i18next';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const messageTypeLabelKeyMap = {
	plain: {
		key: 'transactionMessageType_plain',
		defaultValue: 'Plain message'
	},
	encrypted: {
		key: 'transactionMessageType_encrypted',
		defaultValue: 'Encrypted message'
	},
	delegatedHarvestingPersistent: {
		key: 'transactionMessageType_delegatedHarvestingPersistent',
		defaultValue: 'Delegated Harvesting Persistent message'
	},
	raw: {
		key: 'transactionMessageType_raw',
		defaultValue: 'Raw message'
	}
};

const ValueTransactionMessage = ({ message, isFocusable = true }) => {
	const { t } = useTranslation();
	const ref = useRef();
	const [tooltipPosition, setTooltipPosition] = useState(null);

	if (!message)
		return null;

	const translate = (key, defaultValue) => {
		const translated = t(key, { defaultValue });

		return translated === key ? defaultValue : translated;
	};
	const messageTypeLabel = messageTypeLabelKeyMap[message.type] || messageTypeLabelKeyMap.raw;
	const isContentShown = message.type !== 'encrypted' && !!message.text;
	const showTooltip = () => {
		const rect = ref.current?.getBoundingClientRect();

		if (rect)
			setTooltipPosition({
				top: rect.bottom + 6,
				left: rect.left
			});
	};
	const hideTooltip = () => setTooltipPosition(null);
	const tooltip = (
		<span
			className={styles.tooltip}
			role="tooltip"
			style={{
				top: tooltipPosition?.top,
				left: tooltipPosition?.left
			}}
		>
			<span className={styles.row}>
				<span className={styles.label}>{translate('field_messageType', 'Message Type')}</span>
				<span>{translate(messageTypeLabel.key, messageTypeLabel.defaultValue)}</span>
			</span>
			{isContentShown && (
				<span className={styles.row}>
					<span className={styles.label}>{translate('field_messageContent', 'Content')}</span>
					<span className={styles.content}>{message.text}</span>
				</span>
			)}
		</span>
	);

	return (
		<span
			ref={ref}
			className={styles.valueTransactionMessage}
			tabIndex={isFocusable ? 0 : undefined}
			aria-label={translate('field_message', 'Message')}
			onMouseEnter={showTooltip}
			onMouseLeave={hideTooltip}
			onFocus={showTooltip}
			onBlur={hideTooltip}
		>
			<CustomImage src="/images/transaction/message.svg" className={styles.icon} alt={translate('field_message', 'Message')} />
			{!!tooltipPosition && createPortal(tooltip, document.body)}
		</span>
	);
};

export default ValueTransactionMessage;
