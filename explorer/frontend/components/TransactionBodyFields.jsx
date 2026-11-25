import Field from '@/app/components/Field';
import ValueAccount from '@/app/components/ValueAccount';
import ValueCopy from '@/app/components/ValueCopy';
import ValueList from '@/app/components/ValueList';
import ValueMessage from '@/app/components/ValueMessage';
import ValueMosaic from '@/app/components/ValueMosaic';
import ValueNamespace from '@/app/components/ValueNamespace';
import ValueTransactionType from '@/app/components/ValueTransactionType';
import styles from '@/app/styles/components/TransactionBodyFields.module.scss';
import { useTranslation } from 'next-i18next';

const MAX_LIST_ITEM_COUNT = 5;
const EMPTY_LIST_TEXT = '-';

const getDeltaLocaleKey = delta => {
	if (0 < delta)
		return 'value_deltaIncrease';

	if (0 > delta)
		return 'value_deltaDecrease';

	return 'value_deltaUnchanged';
};

const valueRenderers = {
	account: value => <ValueAccount address={value} size="sm" />,
	boolean: (value, t) => t(`value_${value}`),
	copy: value => <ValueCopy value={value} />,
	delta: (value, t) => t(getDeltaLocaleKey(value), { delta: Math.abs(value) }),
	fee: value => <ValueMosaic isNative amount={value} />,
	message: value => <ValueMessage message={value} />,
	mosaic: value => <ValueMosaic mosaicId={value} mosaicName={value} size="md" />,
	mosaicAmount: value => <ValueMosaic mosaicId={value.id} mosaicName={value.name} amount={value.amount} isTickerShown />,
	namespace: value => <ValueNamespace namespaceId={value} namespaceName={value} size="md" />,
	text: value => value,
	transactionType: value => <ValueTransactionType value={value} />,
	translate: (value, t) => t(`value_${value}`)
};

const isValueSet = value => value !== null && value !== undefined;

const TransactionBodyFields = ({ transaction, fields }) => {
	const { t } = useTranslation();
	const visibleFields = fields.filter(field => isValueSet(transaction[field.name]));

	const renderValue = (field, title) => {
		const value = transaction[field.name];
		const renderItem = item => valueRenderers[field.renderer](item, t);

		if (!Array.isArray(value))
			return renderItem(value);

		if (!value.length)
			return EMPTY_LIST_TEXT;

		return <ValueList data={value} max={MAX_LIST_ITEM_COUNT} direction="column" title={title} renderItem={renderItem} />;
	};

	return (
		<div className={`layout-flex-col-fields ${styles.transactionBodyFields}`}>
			{visibleFields.map(field => {
				const title = t(`field_${field.name}`);

				return (
					<Field title={title} key={field.name}>
						{renderValue(field, title)}
					</Field>
				);
			})}
		</div>
	);
};

export default TransactionBodyFields;
