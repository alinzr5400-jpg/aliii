"use strict";
// AUTO-GENERATED, do not edit
// It's a TypeScript wrapper for a AlamdarCollection contract in Tolk.
/* eslint-disable */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlamdarCollection = exports.OffchainMetadataReply = exports.CollectionDataReply = exports.CollectionContent = exports.NftCollectionStorage = exports.RoyaltyParams = exports.DisableReveal = exports.EnableReveal = exports.ChangeCollectionAdmin = exports.BatchDeployDictItem = exports.BatchDeployNfts = exports.DeployNft = exports.ResponseRoyaltyParams = exports.RequestRoyaltyParams = exports.NftItemInitAtDeployment = void 0;
const c = __importStar(require("@ton/core"));
const core_1 = require("@ton/core");
function makeCellFrom(self, storeFn_T) {
    let b = (0, core_1.beginCell)();
    storeFn_T(self, b);
    return b.endCell();
}
function loadAndCheckPrefix32(s, expected, structName) {
    let prefix = s.loadUint(32);
    if (prefix !== expected) {
        throw new Error(`Incorrect prefix for '${structName}': expected 0x${expected.toString(16).padStart(8, '0')}, got 0x${prefix.toString(16).padStart(8, '0')}`);
    }
}
function formatPrefix(prefixNum, prefixLen) {
    return prefixLen % 4 ? `0b${prefixNum.toString(2).padStart(prefixLen, '0')}` : `0x${prefixNum.toString(16).padStart(prefixLen / 4, '0')}`;
}
function loadAndCheckPrefix(s, expected, prefixLen, structName) {
    let prefix = s.loadUint(prefixLen);
    if (prefix !== expected) {
        throw new Error(`Incorrect prefix for '${structName}': expected ${formatPrefix(expected, prefixLen)}, got ${formatPrefix(prefix, prefixLen)}`);
    }
}
function lookupPrefix(s, expected, prefixLen) {
    return s.remainingBits >= prefixLen && s.preloadUint(prefixLen) === expected;
}
function throwNonePrefixMatch(fieldPath) {
    throw new Error(`Incorrect prefix for '${fieldPath}': none of variants matched`);
}
function storeCellRef(cell, b, storeFn_T) {
    let b_ref = c.beginCell();
    storeFn_T(cell.ref, b_ref);
    b.storeRef(b_ref.endCell());
}
function loadCellRef(s, loadFn_T) {
    let s_ref = s.loadRef().beginParse();
    return { ref: loadFn_T(s_ref) };
}
function storeTolkNullable(v, b, storeFn_T) {
    if (v === null) {
        b.storeUint(0, 1);
    }
    else {
        b.storeUint(1, 1);
        storeFn_T(v, b);
    }
}
function createDictionaryValue(loadFn_V, storeFn_V) {
    return {
        serialize(self, b) {
            storeFn_V(self, b);
        },
        parse(s) {
            const value = loadFn_V(s);
            s.endParse();
            return value;
        }
    };
}
// ————————————————————————————————————————————
//   parse get methods result from a TVM stack
//
class StackReader {
    tuple;
    constructor(tuple) {
        this.tuple = tuple;
    }
    static fromGetMethod(expectedN, getMethodResult) {
        let tuple = [];
        while (getMethodResult.stack.remaining) {
            tuple.push(getMethodResult.stack.pop());
        }
        if (tuple.length !== expectedN) {
            throw new Error(`expected ${expectedN} stack width, got ${tuple.length}`);
        }
        return new StackReader(tuple);
    }
    popExpecting(itemType) {
        const item = this.tuple.shift();
        if (item?.type === itemType) {
            return item;
        }
        throw new Error(`not '${itemType}' on a stack`);
    }
    popCellLike() {
        const item = this.tuple.shift();
        if (item && (item.type === 'cell' || item.type === 'slice' || item.type === 'builder')) {
            return item.cell;
        }
        throw new Error(`not cell/slice on a stack`);
    }
    readBigInt() {
        return this.popExpecting('int').value;
    }
    readBoolean() {
        return this.popExpecting('int').value !== 0n;
    }
    readCell() {
        return this.popCellLike();
    }
    readSlice() {
        return this.popCellLike().beginParse();
    }
    readSnakeString() {
        return this.readCell().beginParse().loadStringTail();
    }
    readCellRef(loadFn_T) {
        return { ref: loadFn_T(this.readCell().beginParse()) };
    }
}
exports.NftItemInitAtDeployment = {
    create(args) {
        return {
            $: 'NftItemInitAtDeployment',
            ...args
        };
    },
    fromSlice(s) {
        return {
            $: 'NftItemInitAtDeployment',
            ownerAddress: s.loadAddress(),
            content: s.loadStringRefTail(),
        };
    },
    store(self, b) {
        b.storeAddress(self.ownerAddress);
        b.storeStringRefTail(self.content);
    },
    toCell(self) {
        return makeCellFrom(self, exports.NftItemInitAtDeployment.store);
    }
};
exports.RequestRoyaltyParams = {
    PREFIX: 0x693d3950,
    create(args) {
        return {
            $: 'RequestRoyaltyParams',
            ...args
        };
    },
    fromSlice(s) {
        loadAndCheckPrefix32(s, 0x693d3950, 'RequestRoyaltyParams');
        return {
            $: 'RequestRoyaltyParams',
            queryId: s.loadUintBig(64),
        };
    },
    store(self, b) {
        b.storeUint(0x693d3950, 32);
        b.storeUint(self.queryId, 64);
    },
    toCell(self) {
        return makeCellFrom(self, exports.RequestRoyaltyParams.store);
    }
};
exports.ResponseRoyaltyParams = {
    PREFIX: 0xa8cb00ad,
    create(args) {
        return {
            $: 'ResponseRoyaltyParams',
            ...args
        };
    },
    fromSlice(s) {
        loadAndCheckPrefix32(s, 0xa8cb00ad, 'ResponseRoyaltyParams');
        return {
            $: 'ResponseRoyaltyParams',
            queryId: s.loadUintBig(64),
            royaltyParams: exports.RoyaltyParams.fromSlice(s),
        };
    },
    store(self, b) {
        b.storeUint(0xa8cb00ad, 32);
        b.storeUint(self.queryId, 64);
        exports.RoyaltyParams.store(self.royaltyParams, b);
    },
    toCell(self) {
        return makeCellFrom(self, exports.ResponseRoyaltyParams.store);
    }
};
exports.DeployNft = {
    PREFIX: 0x00000001,
    create(args) {
        return {
            $: 'DeployNft',
            ...args
        };
    },
    fromSlice(s) {
        loadAndCheckPrefix32(s, 0x00000001, 'DeployNft');
        return {
            $: 'DeployNft',
            queryId: s.loadUintBig(64),
            itemIndex: s.loadUintBig(64),
            attachTonAmount: s.loadCoins(),
            initParams: loadCellRef(s, exports.NftItemInitAtDeployment.fromSlice),
        };
    },
    store(self, b) {
        b.storeUint(0x00000001, 32);
        b.storeUint(self.queryId, 64);
        b.storeUint(self.itemIndex, 64);
        b.storeCoins(self.attachTonAmount);
        storeCellRef(self.initParams, b, exports.NftItemInitAtDeployment.store);
    },
    toCell(self) {
        return makeCellFrom(self, exports.DeployNft.store);
    }
};
exports.BatchDeployNfts = {
    PREFIX: 0x00000002,
    create(args) {
        return {
            $: 'BatchDeployNfts',
            ...args
        };
    },
    fromSlice(s) {
        loadAndCheckPrefix32(s, 0x00000002, 'BatchDeployNfts');
        return {
            $: 'BatchDeployNfts',
            queryId: s.loadUintBig(64),
            deployList: c.Dictionary.load(c.Dictionary.Keys.BigUint(64), createDictionaryValue(exports.BatchDeployDictItem.fromSlice, exports.BatchDeployDictItem.store), s),
        };
    },
    store(self, b) {
        b.storeUint(0x00000002, 32);
        b.storeUint(self.queryId, 64);
        b.storeDict(self.deployList, c.Dictionary.Keys.BigUint(64), createDictionaryValue(exports.BatchDeployDictItem.fromSlice, exports.BatchDeployDictItem.store));
    },
    toCell(self) {
        return makeCellFrom(self, exports.BatchDeployNfts.store);
    }
};
exports.BatchDeployDictItem = {
    create(args) {
        return {
            $: 'BatchDeployDictItem',
            ...args
        };
    },
    fromSlice(s) {
        return {
            $: 'BatchDeployDictItem',
            attachTonAmount: s.loadCoins(),
            initParams: loadCellRef(s, exports.NftItemInitAtDeployment.fromSlice),
        };
    },
    store(self, b) {
        b.storeCoins(self.attachTonAmount);
        storeCellRef(self.initParams, b, exports.NftItemInitAtDeployment.store);
    },
    toCell(self) {
        return makeCellFrom(self, exports.BatchDeployDictItem.store);
    }
};
exports.ChangeCollectionAdmin = {
    PREFIX: 0x00000003,
    create(args) {
        return {
            $: 'ChangeCollectionAdmin',
            ...args
        };
    },
    fromSlice(s) {
        loadAndCheckPrefix32(s, 0x00000003, 'ChangeCollectionAdmin');
        return {
            $: 'ChangeCollectionAdmin',
            queryId: s.loadUintBig(64),
            newAdminAddress: s.loadAddress(),
        };
    },
    store(self, b) {
        b.storeUint(0x00000003, 32);
        b.storeUint(self.queryId, 64);
        b.storeAddress(self.newAdminAddress);
    },
    toCell(self) {
        return makeCellFrom(self, exports.ChangeCollectionAdmin.store);
    }
};
exports.EnableReveal = {
    PREFIX: 0x10000001,
    create(args) {
        return {
            $: 'EnableReveal',
            ...args
        };
    },
    fromSlice(s) {
        loadAndCheckPrefix32(s, 0x10000001, 'EnableReveal');
        return {
            $: 'EnableReveal',
            queryId: s.loadUintBig(64),
        };
    },
    store(self, b) {
        b.storeUint(0x10000001, 32);
        b.storeUint(self.queryId, 64);
    },
    toCell(self) {
        return makeCellFrom(self, exports.EnableReveal.store);
    }
};
exports.DisableReveal = {
    PREFIX: 0x10000002,
    create(args) {
        return {
            $: 'DisableReveal',
            ...args
        };
    },
    fromSlice(s) {
        loadAndCheckPrefix32(s, 0x10000002, 'DisableReveal');
        return {
            $: 'DisableReveal',
            queryId: s.loadUintBig(64),
        };
    },
    store(self, b) {
        b.storeUint(0x10000002, 32);
        b.storeUint(self.queryId, 64);
    },
    toCell(self) {
        return makeCellFrom(self, exports.DisableReveal.store);
    }
};
exports.RoyaltyParams = {
    create(args) {
        return {
            $: 'RoyaltyParams',
            ...args
        };
    },
    fromSlice(s) {
        return {
            $: 'RoyaltyParams',
            numerator: s.loadUintBig(16),
            denominator: s.loadUintBig(16),
            royaltyAddress: s.loadAddress(),
        };
    },
    store(self, b) {
        b.storeUint(self.numerator, 16);
        b.storeUint(self.denominator, 16);
        b.storeAddress(self.royaltyAddress);
    },
    toCell(self) {
        return makeCellFrom(self, exports.RoyaltyParams.store);
    }
};
exports.NftCollectionStorage = {
    create(args) {
        return {
            $: 'NftCollectionStorage',
            ...args
        };
    },
    fromSlice(s) {
        return {
            $: 'NftCollectionStorage',
            adminAddress: s.loadAddress(),
            nextItemIndex: s.loadUintBig(64),
            maxSupply: s.loadUintBig(64),
            revealEnabled: s.loadBoolean(),
            baseUri: s.loadStringRefTail(),
            content: loadCellRef(s, exports.CollectionContent.fromSlice),
            nftItemCode: s.loadRef(),
            royaltyParams: loadCellRef(s, exports.RoyaltyParams.fromSlice),
        };
    },
    store(self, b) {
        b.storeAddress(self.adminAddress);
        b.storeUint(self.nextItemIndex, 64);
        b.storeUint(self.maxSupply, 64);
        b.storeBit(self.revealEnabled);
        b.storeStringRefTail(self.baseUri);
        storeCellRef(self.content, b, exports.CollectionContent.store);
        b.storeRef(self.nftItemCode);
        storeCellRef(self.royaltyParams, b, exports.RoyaltyParams.store);
    },
    toCell(self) {
        return makeCellFrom(self, exports.NftCollectionStorage.store);
    }
};
exports.CollectionContent = {
    create(args) {
        return {
            $: 'CollectionContent',
            ...args
        };
    },
    fromSlice(s) {
        return {
            $: 'CollectionContent',
            collectionMetadata: s.loadRef(),
            commonContent: s.loadStringRefTail(),
        };
    },
    store(self, b) {
        b.storeRef(self.collectionMetadata);
        b.storeStringRefTail(self.commonContent);
    },
    toCell(self) {
        return makeCellFrom(self, exports.CollectionContent.store);
    }
};
exports.CollectionDataReply = {
    create(args) {
        return {
            $: 'CollectionDataReply',
            ...args
        };
    },
    fromSlice(s) {
        throw new Error(`Can't unpack 'CollectionDataReply' from cell, because 'CollectionDataReply.nextItemIndex' is 'int' (not int32/uint64/etc.)`);
    },
    store(self, b) {
        throw new Error(`Can't pack 'CollectionDataReply' to cell, because 'self.nextItemIndex' is 'int' (not int32/uint64/etc.)`);
    },
    toCell(self) {
        return makeCellFrom(self, exports.CollectionDataReply.store);
    }
};
exports.OffchainMetadataReply = {
    PREFIX: 0x01,
    create(args) {
        return {
            $: 'OffchainMetadataReply',
            ...args
        };
    },
    fromSlice(s) {
        loadAndCheckPrefix(s, 0x01, 8, 'OffchainMetadataReply');
        return {
            $: 'OffchainMetadataReply',
            string: s.loadStringRefTail(),
        };
    },
    store(self, b) {
        b.storeUint(0x01, 8);
        b.storeStringRefTail(self.string);
    },
    toCell(self) {
        return makeCellFrom(self, exports.OffchainMetadataReply.store);
    }
};
function calculateDeployedAddress(code, data, options) {
    const stateInitCell = (0, core_1.beginCell)().store(c.storeStateInit({
        code,
        data,
        splitDepth: options.toShard?.fixedPrefixLength,
        special: null,
        libraries: null,
    })).endCell();
    let addrHash = stateInitCell.hash();
    if (options.toShard) {
        const shardDepth = options.toShard.fixedPrefixLength;
        addrHash = (0, core_1.beginCell)()
            .storeBits(new c.BitString(options.toShard.closeTo.hash, 0, shardDepth))
            .storeBits(new c.BitString(stateInitCell.hash(), shardDepth, 256 - shardDepth))
            .endCell()
            .beginParse().loadBuffer(32);
    }
    return new c.Address(options.workchain ?? 0, addrHash);
}
class AlamdarCollection {
    static CodeCell = c.Cell.fromBase64('te6ccgECGwEAA5UAART/APSkE/S88sgLAQIBYgIDBNzQ+JGRMOAg1ywgAAAADOMC1ywjSenKhI47Me1E0AHXCz8B1DHUMdQx10z4kgHQ0w/TD/pI0cjPhQgU+lKCEKjLAK3PC44Uyz/LDxLLD/pSyYBA+wDg1ywgAAAAFOMC1ywgAAAAHOMC1ywggAAADAQFBgcCASAJCgD0Me1E0PpI0z8g1DHUMddM+JIkxwXy4ZEigTFsufLhkgTTPzHTP/oA10xTJLvy4ZJTJLolgTFsufLhkvgoBMjLPxT6UsnIz4mIAVMYyM+E0MzM+RbPC/9QA/oCgQCNzwtwF8zMFczJcfsAA5ukAcj6Uss/zsntVJJfA+IBajHtRND6SNM/INQx1DHXTPiSJMcF8uGRcAXTPzH0BSCAQPSGb6WQiuhfBDMByPpSyz/Oye1UCAA4Me1E0PpI+JJYxwXy4ZEB0z8x+kgwyPpSzsntVACijh5b7UTQ+kjWf9IAMfiSI8cF8uGRAsj6Us7Pg87J7VTg1ywggAAAFDGOHjDtRND6SNZ/0gAx+JIjxwXy4ZECyPpSzs+BzsntVOCEDwHHAPL0AMwHpCCBAPq58uGPVHd1u5oXXweBAZEyoPLw4QL6ANTR+CgkyMs/+lLJJsjPiYgBUyHIz4TQzMz5Fs8L/1AE+gKBAI3PC3ATzBLMzMlx+wAlgTFsufLhklEVupMEpATeUWGAQPR8b6UCASALDAIBYhkaAgEgDQ4CASAVFgPltWumHaiaDeAEWQAkGCASwDnwlsA0e84AM49VIZTGCGJ0iiIYABzGEllg/Jkt8YA/SQY6b+Y64UAR1SA5ACQYIBLAOfCWwDR7zgAzj1UhlMYIYnSKIhgAHMYSWWD8mS3xkQ3xkdCGMQ3xnFtnmRnwgNmZMA8QEQIBWBITAAouanNvbgAWaGlkZGVuLmpzb24AiCBviyFviKUgjjelUyBvgdAg12SOJW8AIddklwHUAdBZb4zkAW+MIG+IpSCaXG+ByM4UzMkDpeQwbxDeyM4SzMkB5DAxAB2vyvaiaH0kGOm/mOuFAEABB69QREAUAA5BbGFtZGFyACu12v2omhqGOoY6hjrpmhph+mH/SRowAgEgFxgAT7Ho+1E0NQx1DHXTPgoAsjLPxL6UskByM+E0MzM+RbIz4oAQMv/z1CAAC7CFIExbIAAPsPG7UTQ10yAAK7AW+1E0PpI0z/TP9IA1NdM0NdMVQSA=');
    static Errors = {
        'Errors.BatchLimitExceeded': 399,
        'Errors.NotFromAdmin': 401,
        'Errors.InvalidItemIndex': 402,
    };
    address;
    init;
    constructor(address, init) {
        this.address = address;
        this.init = init;
    }
    static fromAddress(address) {
        return new AlamdarCollection(address);
    }
    static fromStorage(emptyStorage, deployedOptions) {
        const initialState = {
            code: deployedOptions?.overrideContractCode ?? AlamdarCollection.CodeCell,
            data: exports.NftCollectionStorage.toCell(exports.NftCollectionStorage.create(emptyStorage)),
        };
        const address = calculateDeployedAddress(initialState.code, initialState.data, deployedOptions ?? {});
        return new AlamdarCollection(address, initialState);
    }
    static createCellOfRequestRoyaltyParams(body) {
        return exports.RequestRoyaltyParams.toCell(exports.RequestRoyaltyParams.create(body));
    }
    static createCellOfDeployNft(body) {
        return exports.DeployNft.toCell(exports.DeployNft.create(body));
    }
    static createCellOfBatchDeployNfts(body) {
        return exports.BatchDeployNfts.toCell(exports.BatchDeployNfts.create(body));
    }
    static createCellOfChangeCollectionAdmin(body) {
        return exports.ChangeCollectionAdmin.toCell(exports.ChangeCollectionAdmin.create(body));
    }
    static createCellOfEnableReveal(body) {
        return exports.EnableReveal.toCell(exports.EnableReveal.create(body));
    }
    static createCellOfDisableReveal(body) {
        return exports.DisableReveal.toCell(exports.DisableReveal.create(body));
    }
    async sendDeploy(provider, via, msgValue, extraOptions) {
        return provider.internal(via, {
            value: msgValue,
            body: c.Cell.EMPTY,
            ...extraOptions
        });
    }
    async sendRequestRoyaltyParams(provider, via, msgValue, body, extraOptions) {
        return provider.internal(via, {
            value: msgValue,
            body: exports.RequestRoyaltyParams.toCell(exports.RequestRoyaltyParams.create(body)),
            ...extraOptions
        });
    }
    async sendDeployNft(provider, via, msgValue, body, extraOptions) {
        return provider.internal(via, {
            value: msgValue,
            body: exports.DeployNft.toCell(exports.DeployNft.create(body)),
            ...extraOptions
        });
    }
    async sendBatchDeployNfts(provider, via, msgValue, body, extraOptions) {
        return provider.internal(via, {
            value: msgValue,
            body: exports.BatchDeployNfts.toCell(exports.BatchDeployNfts.create(body)),
            ...extraOptions
        });
    }
    async sendChangeCollectionAdmin(provider, via, msgValue, body, extraOptions) {
        return provider.internal(via, {
            value: msgValue,
            body: exports.ChangeCollectionAdmin.toCell(exports.ChangeCollectionAdmin.create(body)),
            ...extraOptions
        });
    }
    async sendEnableReveal(provider, via, msgValue, body, extraOptions) {
        return provider.internal(via, {
            value: msgValue,
            body: exports.EnableReveal.toCell(exports.EnableReveal.create(body)),
            ...extraOptions
        });
    }
    async sendDisableReveal(provider, via, msgValue, body, extraOptions) {
        return provider.internal(via, {
            value: msgValue,
            body: exports.DisableReveal.toCell(exports.DisableReveal.create(body)),
            ...extraOptions
        });
    }
    async getCollectionData(provider) {
        const r = StackReader.fromGetMethod(6, await provider.get('get_collection_data', []));
        return ({
            $: 'CollectionDataReply',
            nextItemIndex: r.readBigInt(),
            maxSupply: r.readBigInt(),
            revealEnabled: r.readBoolean(),
            baseUri: r.readSnakeString(),
            collectionMetadata: r.readCell(),
            adminAddress: r.readSlice().loadAddress(),
        });
    }
    async getNftAddressByIndex(provider, itemIndex) {
        const r = StackReader.fromGetMethod(1, await provider.get('get_nft_address_by_index', [
            { type: 'int', value: itemIndex },
        ]));
        return r.readSlice().loadAddress();
    }
    async getRoyaltyParams(provider) {
        const r = StackReader.fromGetMethod(3, await provider.get('royalty_params', []));
        return ({
            $: 'RoyaltyParams',
            numerator: r.readBigInt(),
            denominator: r.readBigInt(),
            royaltyAddress: r.readSlice().loadAddress(),
        });
    }
    async getNftContent(provider, itemIndex, _individualNftContent) {
        const r = StackReader.fromGetMethod(1, await provider.get('get_nft_content', [
            { type: 'int', value: itemIndex },
            { type: 'cell', cell: (0, core_1.beginCell)().storeStringTail(_individualNftContent).endCell() },
        ]));
        return r.readCellRef(exports.OffchainMetadataReply.fromSlice);
    }
    async getMaxSupply(provider) {
        const r = StackReader.fromGetMethod(1, await provider.get('get_max_supply', []));
        return r.readBigInt();
    }
    async getProjectName(provider) {
        const r = StackReader.fromGetMethod(1, await provider.get('get_project_name', []));
        return r.readSnakeString();
    }
    async getRevealStatus(provider) {
        const r = StackReader.fromGetMethod(1, await provider.get('get_reveal_status', []));
        return r.readBoolean();
    }
    async getBaseUri(provider) {
        const r = StackReader.fromGetMethod(1, await provider.get('get_base_uri', []));
        return r.readSnakeString();
    }
}
exports.AlamdarCollection = AlamdarCollection;
