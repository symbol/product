// Symbol variant — nodes API (returns static stub fixtures, no data layer / node calls yet).
import { stubNodes } from './fixtures';
import { stubValue } from './stub';

export const fetchNodeList = stubValue(stubNodes);
