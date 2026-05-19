import { api } from '@/variants';

export const fetchAccountStats = (...args) => api.fetchAccountStats(...args);
export const fetchTransactionChart = (...args) => api.fetchTransactionChart(...args);
export const fetchTransactionStats = (...args) => api.fetchTransactionStats(...args);
export const fetchBlockStats = (...args) => api.fetchBlockStats(...args);
export const fetchNodeStats = (...args) => api.fetchNodeStats(...args);
export const fetchMarketData = (...args) => api.fetchMarketData(...args);
export const fetchPriceByDate = (...args) => api.fetchPriceByDate(...args);
