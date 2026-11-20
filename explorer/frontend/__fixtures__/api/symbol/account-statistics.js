// Contract-based REST data, not a captured response. One of three eligible accounts is active;
// harvesting includes three additional active accounts outside the eligible population.
export const accountStatisticsResponse = {
	total: 11,
	harvesting: 4,
	eligibleForHarvesting: 3,
	top10AccountsImportance: 26.3242,
	harvestingAccountsPercentage: 33.33,
	importanceBreakdown: [
		[21.0754, 'TACCOUNT01'],
		[3.4318, 'TACCOUNT02'],
		[0.577, 'TACCOUNT03'],
		[0.4, 'TACCOUNT04'],
		[0.3, 'TACCOUNT05'],
		[0.2, 'TACCOUNT06'],
		[0.1, 'TACCOUNT07'],
		[0.09, 'TACCOUNT08'],
		[0.08, 'TACCOUNT09'],
		[0.07, 'TACCOUNT10'],
		[0.0058, 'Rest']
	],
	harvestingAccountsChart: [[33.33, 'Harvesting'], [66.67, 'Not harvesting']],
	pendingVerification: []
};

export const emptyAccountStatisticsResponse = {
	total: 0,
	harvesting: 0,
	eligibleForHarvesting: 0,
	top10AccountsImportance: 0,
	harvestingAccountsPercentage: 0,
	importanceBreakdown: [],
	harvestingAccountsChart: [],
	pendingVerification: []
};
