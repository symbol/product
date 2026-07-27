import {
	AmountValue,
	ExternalValue,
	RateValue,
	StatusBadge,
	TransactionValue
} from '@/components/ReportTableFields';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

const SYMBOL_NETWORK = {
	blockchain: 'symbol',
	explorerUrl: 'https://symbol.example'
};

describe('StatusBadge', () => {
	it('renders the configured payout status', () => {
		// Act:
		render(<StatusBadge errorMessage={null} status={2} />);

		// Assert:
		expect(screen.getByText('Completed')).toBeInTheDocument();
	});

	it('renders error details through an accessible tooltip', () => {
		// Act:
		render(<StatusBadge errorMessage="Payout rejected" status={3} />);
		const failedStatus = screen.getByLabelText('Failed: Payout rejected');

		// Assert:
		expect(failedStatus).toHaveTextContent('Failed');
		expect(failedStatus).toHaveAttribute('data-tooltip', 'Payout rejected');
		expect(failedStatus).toHaveAttribute('tabindex', '0');
	});

	it('renders an unknown label for an unconfigured payout status', () => {
		// Act:
		render(<StatusBadge errorMessage={null} status={99} />);

		// Assert:
		expect(screen.getByText('Unknown')).toBeInTheDocument();
	});
});

describe('ExternalValue', () => {
	it('renders a truncated value linked to the configured explorer', () => {
		// Arrange:
		const value = 'TCONKG47FW2ZEZBPV6G7F422LXBDSMVT3JMYM4I';

		// Act:
		render(<ExternalValue network={SYMBOL_NETWORK} type="address" value={value} />);
		const link = screen.getByRole('link');

		// Assert:
		expect(link).toHaveTextContent('TCONKG47F…JMYM4I');
		expect(link).toHaveAttribute('href', `https://symbol.example/accounts/${value}`);
		expect(link).toHaveAttribute('title', value);
		expect(link).toHaveAttribute('rel', 'noreferrer');
		expect(link).toHaveAttribute('target', '_blank');
	});

	it('renders a value without a link when an explorer URL is unavailable', () => {
		// Arrange:
		const value = 'TCONKG47FW2ZEZBPV6G7F422LXBDSMVT3JMYM4I';

		// Act:
		render(<ExternalValue network={{ blockchain: 'symbol' }} type="address" value={value} />);
		const externalValue = screen.getByTitle(value);

		// Assert:
		expect(externalValue).toHaveTextContent('TCONKG47F…JMYM4I');
		expect(externalValue).not.toHaveAttribute('href');
	});

	it('renders a placeholder and empty title when the value is unavailable', () => {
		// Act:
		render(<ExternalValue network={SYMBOL_NETWORK} type="address" value={null} />);
		const placeholder = screen.getByText('—');

		// Assert:
		expect(placeholder).toHaveAttribute('title', '');
		expect(screen.queryByRole('link')).not.toBeInTheDocument();
	});
});

describe('TransactionValue', () => {
	it('renders the formatted timestamp and linked transaction hash', () => {
		// Arrange:
		const hash = 'A'.repeat(64);

		// Act:
		render(<TransactionValue hash={hash} network={SYMBOL_NETWORK} timestamp={2} />);
		const link = screen.getByRole('link');

		// Assert:
		expect(screen.getByText('1970-01-01 00:00:02 UTC')).toBeInTheDocument();
		expect(link).toHaveTextContent('AAAAAAAA…AAAAAA');
		expect(link).toHaveAttribute('href', `https://symbol.example/transactions/${hash}`);
		expect(link).toHaveAttribute('title', hash);
	});
});

describe('AmountValue', () => {
	const asset = { ticker: 'XYM', divisibility: 6 };

	it('renders a formatted amount with its asset ticker and raw value', () => {
		// Act:
		render(<AmountValue asset={asset} value="300000000000" />);
		const amount = screen.getByTitle('300000000000');

		// Assert:
		expect(amount).toHaveTextContent('300000');
		expect(amount).toHaveTextContent('XYM');
	});

	it.each([null, undefined])('renders a placeholder and empty title when the value is %s', value => {
		// Act:
		render(<AmountValue asset={asset} value={value} />);
		const placeholder = screen.getByText('—');

		// Assert:
		expect(placeholder.parentElement).toHaveAttribute('title', '');
		expect(screen.queryByText('XYM')).not.toBeInTheDocument();
	});
});

describe('RateValue', () => {
	it('renders a formatted rate with its raw PPM value', () => {
		// Act:
		render(<RateValue value="1000000" />);

		// Assert:
		expect(screen.getByText('1')).toHaveAttribute('title', '1000000 PPM');
	});

	it.each([null, undefined])('renders a placeholder and empty title when the value is %s', value => {
		// Act:
		render(<RateValue value={value} />);

		// Assert:
		expect(screen.getByText('—')).toHaveAttribute('title', '');
	});
});
