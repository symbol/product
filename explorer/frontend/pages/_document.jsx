import config from '@/config';
import nemDocument from '@/pages/_app/nem/_document';
import symbolDocument from '@/pages/_app/symbol/_document';

const listOfDocuments = {
	nem: nemDocument,
	symbol: symbolDocument
};
const DocumentComponent = listOfDocuments[config.PLATFORM];

export default DocumentComponent;
