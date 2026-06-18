// Symbol variant — namespaces API (returns static stub fixtures, no data layer / node calls yet).
import { stubNamespaces } from './fixtures';
import { stubPage, stubValue } from './stub';

export const fetchNamespacePage = stubPage(stubNamespaces);
export const fetchNamespaceInfo = stubValue(stubNamespaces[0]);
