// Symbol variant — stats API (returns static stub fixtures, no data layer / node calls yet).
import { stubAccountStats, stubBlockStats, stubMarketData, stubNodes, stubTransactionChart, stubTransactionStats } from './fixtures';
import { stubValue } from './stub';

export const fetchAccountStats = stubValue(stubAccountStats);
export const fetchTransactionChart = stubValue(stubTransactionChart);
export const fetchTransactionStats = stubValue(stubTransactionStats);
export const fetchBlockStats = stubValue(stubBlockStats);
export const fetchNodeStats = () => Promise.resolve({ total: stubNodes.length, supernodes: 2 });
export const fetchMarketData = stubValue(stubMarketData);
export const fetchPriceByDate = () => Promise.resolve(0.031);
