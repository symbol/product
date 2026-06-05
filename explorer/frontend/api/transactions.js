import { api } from '@/variants';

export const fetchTransactionPage = (...args) => api.fetchTransactionPage(...args);
export const fetchTransactionInfo = (...args) => api.fetchTransactionInfo(...args);
export const resolveTransactionBlockSearch = (...args) => api.resolveTransactionBlockSearch(...args);
export const resolveTransactionMosaicSearch = (...args) => api.resolveTransactionMosaicSearch(...args);
export const resolveTransactionRecipientSearch = (...args) => api.resolveTransactionRecipientSearch(...args);
export const resolveTransactionSignerSearch = (...args) => api.resolveTransactionSignerSearch(...args);
