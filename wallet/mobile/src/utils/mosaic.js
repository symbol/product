export const getNativeMosaicAmount = (mosaicList, nativeMosaicId) => {
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
    console.log(mosaics, mosaicInfos)
    return mosaics.map(mosaic => getMosaicWithRelativeAmount(mosaic, mosaicInfos[mosaic.id]));
};

export const getMosaicWithRelativeAmount = (mosaic, mosaicInfo) => {
    return {
        amount: mosaic.amount / Math.pow(10, mosaicInfo.divisibility),
        name: mosaicInfo.names?.[0] || mosaic.id,
        id: mosaic.id,
    }
};
