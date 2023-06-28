export const getSearchCriteria = (req) => {
    const { searchParams } = new URL(req.url);
    const pageNumber = searchParams.get('pageNumber');
    const pageSize = searchParams.get('pageSize');

    return {
        pageNumber: pageNumber || 1,
        pageSize: pageSize || 50
    }
}

export const createSearchCriteria = (searchCriteria = {}) => {
    const pageNumber = parseInt(searchCriteria.pageNumber);
    const pageSize = parseInt(searchCriteria.pageSize);

    return {
        pageNumber: isNaN(pageNumber) ? 1 : pageNumber,
        pageSize: isNaN(pageSize) ? 50 : pageSize,
    }
}

export const createPage = (data, pageNumber) => ({data, pageNumber});
