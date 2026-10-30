import { SymbolRouteName } from './config';
import { Router } from '@/app/router/Router';

/**
 * Navigation for the Symbol app. Extends the shared app Router.
 * Note: do not reimplement existing routes from shared router here.
 */
export class SymbolRouter extends Router {
	static goToMultisigAccountList(params) {
		Router.navigate(SymbolRouteName.MultisigAccountList, params);
	}
	static goToMultisigAccountDetails(params) {
		Router.navigate(SymbolRouteName.MultisigAccountDetails, params);
	}
	static goToCreateMultisigAccount(params) {
		Router.navigate(SymbolRouteName.CreateMultisigAccount, params);
	}
	static goToModifyMultisigAccount(params) {
		Router.navigate(SymbolRouteName.ModifyMultisigAccount, params);
	}
	static goToHarvesting(params) {
		Router.navigate(SymbolRouteName.Harvesting, params);
	}
	static goToCreateMosaic(params) {
		Router.navigate(SymbolRouteName.CreateMosaic, params);
	}
	static goToModifyMosaic(params) {
		Router.navigate(SymbolRouteName.ModifyMosaic, params);
	}
	static goToRevokeMosaic(params) {
		Router.navigate(SymbolRouteName.RevokeMosaic, params);
	}
	static goToCreatedMosaicList(params) {
		Router.navigate(SymbolRouteName.CreatedMosaicList, params);
	}
}
