export const getNativeMosaicAmount = (mosaicList, nativeMosaicId) => {
    const nativeMosaic = mosaicList.find(mosaic => mosaic.id === nativeMosaicId);

    return nativeMosaic.amount;
};

export const getMosaicRelativeAmount = (absoluteAmount, divisibility) => {
    return absoluteAmount / Math.pow(10, divisibility);
};

export const getMosaicAbsoluteAmount = (relativeAmount, divisibility) => {
    return relativeAmount * Math.pow(10, divisibility);
};
