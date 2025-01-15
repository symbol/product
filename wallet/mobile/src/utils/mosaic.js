import { MosaicFlags } from 'src/constants';

export const getNativeMosaicAmount = (mosaicList, nativeMosaicId) => {
    if (!mosaicList || !nativeMosaicId) {
        return null;
    }
    const nativeMosaic = mosaicList.find((mosaic) => mosaic.id === nativeMosaicId);

    return nativeMosaic ? nativeMosaic.amount : 0;
};

export const getMosaicRelativeAmountString = (absoluteAmount, divisibility) => {
    if (divisibility === 0) {
        return absoluteAmount;
    }

    const absoluteAmountString = '' + absoluteAmount;
    const array = absoluteAmountString.split('');
    array.splice(absoluteAmountString.length - divisibility, 0, '.');

    return array.join('');
};

export const getMosaicRelativeAmount = (absoluteAmount, divisibility) => {
    return absoluteAmount / Math.pow(10, divisibility);
};

export const getMosaicAbsoluteAmount = (relativeAmount, divisibility) => {
    return relativeAmount * Math.pow(10, divisibility);
};

export const getMosaicsWithRelativeAmounts = (mosaics, mosaicInfos) => {
    if (!mosaics || !mosaicInfos) {
        return [];
    }

    return mosaics.map((mosaic) => getMosaicWithRelativeAmount(mosaic, mosaicInfos[mosaic.id]));
};

export const getMosaicWithRelativeAmount = (mosaic, mosaicInfo) => {
    if (!mosaicInfo) {
        return {
            ...mosaicInfo,
            amount: null,
            name: mosaic.id,
            id: mosaic.id,
        };
    }
    return {
        ...mosaicInfo,
        amount: mosaic.amount / Math.pow(10, mosaicInfo.divisibility),
        name: mosaicInfo.names?.[0] || mosaic.id,
        divisibility: mosaicInfo.divisibility,
        id: mosaic.id,
    };
};

export const filterCustomMosaics = (mosaicList, nativeMosaicId) => {
    return mosaicList.filter((mosaic) => mosaic.id !== nativeMosaicId);
};

export const isMosaicRevokable = (mosaic, chainHeight, currentAddress, sourceAddress) => {
    const hasRevokableFlag = mosaic.isRevokable;
    const isCreatorCurrentAccount = mosaic.creator === currentAddress;
    const isSelfRevocation = sourceAddress === currentAddress;
    const isMosaicExpired = mosaic.endHeight - chainHeight <= 0;
    const isMosaicActive = !isMosaicExpired || mosaic.isUnlimitedDuration;

    return hasRevokableFlag && isCreatorCurrentAccount && !isSelfRevocation && isMosaicActive;
};

export const generateNonce = () => {
    const bytes = Crypto.randomBytes(4);
    const nonce = new Uint8Array(bytes);

    return new Uint32Array(nonce.buffer)[0];
};

// export const generateMosaicId = (nonce, ownerAddress) => {
//     return MosaicId.createFromNonce(MosaicNonce.createFromHex(nonce), Address.createFromRawAddress(ownerAddress)).toHex();
// };

export const isSupplyMutableFlag = flags => (flags & MosaicFlags.SUPPLY_MUTABLE) !== 0;
export const isTransferableFlag = flags => (flags & MosaicFlags.TRANSFERABLE) !== 0;
export const isRestrictableFlag = flags => (flags & MosaicFlags.RESTRICTABLE) !== 0;
export const isRevokableFlag = flags => (flags & MosaicFlags.REVOKABLE) !== 0;