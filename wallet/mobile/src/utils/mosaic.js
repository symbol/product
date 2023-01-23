export const getNativeMosaicAmount = (mosaicList, nativeMosaicId) => {
    if (!mosaicList || !nativeMosaicId) {
        return null;
    }
    const nativeMosaic = mosaicList.find(mosaic => mosaic.id === nativeMosaicId);

    return nativeMosaic ? nativeMosaic.amount : 0;
};

export const getMosaicRelativeAmount = (absoluteAmount, divisibility) => {
    return absoluteAmount / Math.pow(10, divisibility);
};

export const getMosaicAbsoluteAmount = (relativeAmount, divisibility) => {
    return relativeAmount * Math.pow(10, divisibility);
};

export const getMosaicsWithRelativeAmounts = (mosaics, mosaicInfos) => {
    if (!mosaics || !mosaicInfos) {
        return null;
    }
    
    return mosaics.map(mosaic => getMosaicWithRelativeAmount(mosaic, mosaicInfos[mosaic.id]));
};

export const getMosaicWithRelativeAmount = (mosaic, mosaicInfo) => {
    return {
        ...mosaicInfo,
        amount: mosaic.amount / Math.pow(10, mosaicInfo.divisibility),
        name: mosaicInfo.names?.[0] || mosaic.id,
        divisibility: mosaicInfo.divisibility,
        id: mosaic.id,
    }
};

export const filterCustomMosaics = (mosaicList, nativeMosaicId) => {
    return mosaicList.filter(mosaic => mosaic.id !== nativeMosaicId);
};
