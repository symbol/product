import * as WalletContext from '../context/store';
import { render } from '@testing-library/react';

const testHelper = {
	customRender: (ui, context) => {
		return render(<WalletContext.default value={context}>
			{ui}
		</WalletContext.default>);
	}
};

export default testHelper;
