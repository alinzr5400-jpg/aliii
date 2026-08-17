import "@stdlib/strings"
import "@acton/build"
import "@acton/env"
import "@acton/io"
import "@acton/prompts"
import "@acton/emulation/network"
import "@acton/emulation/scripts"
import "@contracts/messages"
import "@contracts/types"
import "@wrappers/NftCollection.gen"
import "@wrappers/NftItem.gen"

const ONCHAIN_CONTENT_PREFIX = 0x00

const NFT_DEFAULT_COLLECTION_NAME = "Alamdar"
const NFT_DEFAULT_COLLECTION_DESCRIPTION = "114 Martyrs Collection"
const NFT_DEFAULT_COLLECTION_IMAGE = "https://xxx.ir/collection.png"
const NFT_DEFAULT_COMMON_CONTENT = "https://api.xxx.ir/nft/"
const NFT_DEFAULT_ITEM_CONTENT = "1"
const NFT_DEFAULT_BATCH_CONTENT_PREFIX = "batch-"
const NFT_DEFAULT_BATCH_COUNT = "3"

struct NftCollectionInfo {
    name: string
    description: string
    image: string
}

fun buildOnchainMetadata(info: NftCollectionInfo): cell {
    var dict: map<uint256, string_prefixed0x> = [];
    dict.set("name".sha256(), info.name.prefixWith00());
    dict.set("description".sha256(), info.description.prefixWith00());
    dict.set("image".sha256(), info.image.prefixWith00());
    return beginCell()
        .storeUint(ONCHAIN_CONTENT_PREFIX, 8)
        .storeDict(dict.toLowLevelDict())
        .endCell();
}

fun promptNftWallet(envName: string, message: string): ActonWallet {
    return scripts.wallet(env<string>(envName) ?? promptWallet(message));
}

fun promptNftAddress(message: string, default: address? = null): address {
    return promptAddress(message, default);
}

fun promptNftCollectionInfo(): NftCollectionInfo {
    return {
        name: prompt("Enter collection name", "", NFT_DEFAULT_COLLECTION_NAME),
        description: prompt("Enter collection description", "", NFT_DEFAULT_COLLECTION_DESCRIPTION),
        image: prompt("Enter collection image URL", "", NFT_DEFAULT_COLLECTION_IMAGE),
    };
}

fun promptNftCollection(message: string): NftCollection {
    return NftCollection.fromAddress(promptAddress(message));
}

fun promptNftItem(message: string): NftItem {
    return NftItem.fromAddress(promptAddress(message));
}

fun makeNftCollectionStorage(admin: address, info: NftCollectionInfo): NftCollectionStorage {
    return {
        adminAddress: admin,
        nextItemIndex: 0,
        maxSupply: 16120,
        revealEnabled: false,
        baseUri: "https://alamdar-backend1.onrender.com/nft/",

        content: CollectionContent {
            collectionMetadata: buildOnchainMetadata(info),
            commonContent: "https://alamdar-backend1.onrender.com/nft/",
        }.toCell(),

        nftItemCode: build("AlamdarItem"),

        royaltyParams: RoyaltyParams {
            numerator: 5,
            denominator: 100,
            royaltyAddress: admin,
        }.toCell(),
    };
}

fun deployNftCollection(
    deployer: ActonWallet,
    info: NftCollectionInfo,
): NftCollection {

    val collection = NftCollection.fromStorage(
        makeNftCollectionStorage(deployer.address, info),
    );

    val res = collection.deploy(
        deployer.address,
        {
            value: ton("0.05"),
            bounce: false,
        },
    );

    res.waitForFirstTransaction();

    return collection;
}

fun deployNftItem(
    collection: NftCollection,
    deployer: ActonWallet,
    owner: address,
    itemContent: string,
): NftItem {
    val itemIndex = collection.getCollectionData().nextItemIndex;
    val res = collection.sendDeployNft(
        deployer.address,
        0,
        itemIndex,
        ton("0.03"),
        { ownerAddress: owner, content: itemContent },
        { value: ton("0.05"), bounce: true },
    );
    res.waitForFirstTransaction();
    return NftItem.fromAddress(collection.getNftAddressByIndex(itemIndex));
}

fun deployNftBatch(
    collection: NftCollection,
    deployer: ActonWallet,
    owner: address,
    count: int,
): SendResultList {
    var deployList: map<uint64, BatchDeployDictItem> = [];
    var i = 0;
    val nextItemIndex = collection.getCollectionData().nextItemIndex;
    val perItemAmount = ton("0.03");

    while (i < count) {
        val index = (nextItemIndex + i);
        val content = StringBuilder
            .create()
            .append(NFT_DEFAULT_BATCH_CONTENT_PREFIX)
            .append(index.toDecimalString())
            .append(".json")
            .build();

        deployList.set(
            index,
            BatchDeployDictItem {
                attachTonAmount: perItemAmount,
                initParams: NftItemInitAtDeployment {
                    ownerAddress: owner,
                    content,
                }.toCell(),
            },
        );
        i += 1;
    }

    val messageValue = perItemAmount * count + ton("0.1");
    return collection.sendBatchDeployNfts(
        deployer.address,
        0,
        deployList,
        { value: messageValue, bounce: true },
    );
}

fun printNftCollectionInfo(collection: NftCollection, label: string) {
    val data = collection.getCollectionData();
    val royalty = collection.royaltyParams();

    println("{} COLLECTION_ADDRESS={}", label, collection.address);
    println("{} ADMIN_ADDRESS={}", label, data.adminAddress);
    println("{} NEXT_ITEM_INDEX={}", label, data.nextItemIndex);

    println("{} MAX_SUPPLY={}", label, data.maxSupply);
    println("{} REVEAL={}", label, data.revealEnabled);
    println("{} BASE_URI={}", label, data.baseUri);

    println("{} COLLECTION_METADATA_HASH={}", label, data.collectionMetadata.hash());
    println("{} ROYALTY_ADDRESS={}", label, royalty.royaltyAddress);
    println("{} ROYALTY_NUMERATOR={}", label, royalty.numerator);
    println("{} ROYALTY_DENOMINATOR={}", label, royalty.denominator);

    println(
        "{} NFT_CONTENT_HASH={}",
        label,
        collection.getNftContent(0, NFT_DEFAULT_ITEM_CONTENT).hash(),
    );
}

fun printNftItemInfo(item: NftItem, label: string) {
    val data = item.getNftData();
    println("{} ITEM_ADDRESS={}", label, item.address);
    println("{} INITIALIZED={}", label, data.isInitialized);
    println("{} INDEX={}", label, data.itemIndex);
    println("{} COLLECTION_ADDRESS={}", label, data.collectionAddress);
    println("{} OWNER_ADDRESS={}", label, data.ownerAddress);
    println("{} CONTENT={}", label, data.content);
}
