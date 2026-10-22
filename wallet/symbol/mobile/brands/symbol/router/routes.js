import { SymbolRouteName } from './config';
import { Harvesting } from '../screens/harvesting/Harvesting';
import { CreateMosaic } from '../screens/mosaic/CreateMosaic';
import { CreatedMosaicList } from '../screens/mosaic/CreatedMosaicList';
import { ModifyMosaic } from '../screens/mosaic/ModifyMosaic';
import { RevokeMosaic } from '../screens/mosaic/RevokeMosaic';
import { CreateMultisigAccount } from '../screens/multisig/CreateMultisigAccount';
import { ModifyMultisigAccount } from '../screens/multisig/ModifyMultisigAccount';
import { MultisigAccountDetails } from '../screens/multisig/MultisigAccountDetails';
import { MultisigAccountList } from '../screens/multisig/MultisigAccountList';

/** @typedef {import('@/app/types/Route').RouteItem} RouteItem */

/** @type {RouteItem[]} */
export const routes = [
	{ name: SymbolRouteName.MultisigAccountList, component: MultisigAccountList },
	{ name: SymbolRouteName.MultisigAccountDetails, component: MultisigAccountDetails },
	{ name: SymbolRouteName.CreateMultisigAccount, component: CreateMultisigAccount },
	{ name: SymbolRouteName.ModifyMultisigAccount, component: ModifyMultisigAccount },
	{ name: SymbolRouteName.Harvesting, component: Harvesting },
	{ name: SymbolRouteName.CreateMosaic, component: CreateMosaic },
	{ name: SymbolRouteName.ModifyMosaic, component: ModifyMosaic },
	{ name: SymbolRouteName.RevokeMosaic, component: RevokeMosaic },
	{ name: SymbolRouteName.CreatedMosaicList, component: CreatedMosaicList }
];
