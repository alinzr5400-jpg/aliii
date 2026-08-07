import "@stdlib/strings"
import "errors"
import "fees-management"
import "messages"
import "types"

const MAX_SUPPLY: int = 12652;
const PROJECT_NAME: string = "Alamdar";

contract AlamdarCollection {
   author: "Ali"
version: "1.0.0"
description: "Alamdar NFT Collection"

storage: NftCollectionStorage
incomingMessages: AllowedMessageToNftCollection


}

fun deployNftItem(
    itemIndex: int,
    nftItemCode: cell,
    attachTonAmount: coins,
    initParams: Cell<NftItemInitAtDeployment>,
) {
    val deployMsg = createMessage({
        bounce: BounceMode.Only256BitsOfBody,
        dest: calcDeployedNftItem(itemIndex, contract.getAddress(), nftItemCode),
        value: attachTonAmount,
        body: initParams,
    });
    deployMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun buildItemContent(itemIndex: int): string {
    return itemIndex.toDecimalString();
}

type AllowedMessageToNftCollection =
    | RequestRoyaltyParams
    | DeployNft
    | BatchDeployNfts
    | ChangeCollectionAdmin
    | EnableReveal
    | DisableReveal
    | PublicMint

fun onInternalMessage(in: InMessage) {
    val msg = lazy AllowedMessageToNftCollection.fromSlice(in.body);

    match (msg) {
        DeployNft => {
            var storage = lazy NftCollectionStorage.load();
            assert (in.senderAddress == storage.adminAddress) throw Errors.NotFromAdmin;
            assert (storage.nextItemIndex < MAX_SUPPLY) throw Errors.InvalidItemIndex;
            assert (msg.itemIndex <= storage.nextItemIndex) throw Errors.InvalidItemIndex;

            val isLast = msg.itemIndex == storage.nextItemIndex;

            assert (storage.nextItemIndex < MAX_SUPPLY) throw Errors.InvalidItemIndex;

            deployNftItem(
                msg.itemIndex,
                storage.nftItemCode,
                msg.attachTonAmount,
                msg.initParams,
            );

            if (isLast) {
                storage.nextItemIndex += 1;
                storage.save();
            }
        }

        RequestRoyaltyParams => {
            val storage = lazy NftCollectionStorage.load();
            val respondMsg = createMessage({
                bounce: BounceMode.NoBounce,
                dest: in.senderAddress,
                value: 0,
                body: ResponseRoyaltyParams {
                    queryId: msg.queryId,
                    royaltyParams: storage.royaltyParams.load(),
                },
            });
            respondMsg.send(SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE);
        }

        BatchDeployNfts => {
            var storage = lazy NftCollectionStorage.load();
            assert (in.senderAddress == storage.adminAddress) throw Errors.NotFromAdmin;

            var counter = 0;
            var r = msg.deployList.findFirst();
            while (r.isFound) {
                counter += 1;
                assert (counter < BATCH_SIZE_LIMIT) throw Errors.BatchLimitExceeded;

                // Error cast is used to replicate exit codes from FunC version
                val itemIndex = r.getKey();
                assert (
                    itemIndex <= storage.nextItemIndex
                ) throw (Errors.NotFromAdmin as int) + counter;

                val dictItem = r.loadValue();
                deployNftItem(
                    itemIndex,
                    storage.nftItemCode,
                    dictItem.attachTonAmount,
                    dictItem.initParams,
                );
                assert (storage.nextItemIndex < MAX_SUPPLY) throw Errors.InvalidItemIndex;

                if (itemIndex == storage.nextItemIndex) {
                    storage.nextItemIndex += 1;
                }

                r = msg.deployList.iterateNext(r);
            }
            storage.save();
        }

        ChangeCollectionAdmin => {
            var storage = lazy NftCollectionStorage.load();
            assert (in.senderAddress == storage.adminAddress) throw Errors.NotFromAdmin;
            storage.adminAddress = msg.newAdminAddress;
            storage.save();
        }

        EnableReveal => {
            var storage = lazy NftCollectionStorage.load();
            assert (in.senderAddress == storage.adminAddress) throw Errors.NotFromAdmin;

            storage.revealEnabled = true;
            storage.save();
        }

        DisableReveal => {
            var storage = lazy NftCollectionStorage.load();
            assert (in.senderAddress == storage.adminAddress) throw Errors.NotFromAdmin;

            storage.revealEnabled = false;
            storage.save();
        }

        PublicMint => {
            var storage = lazy NftCollectionStorage.load();
            val count = msg.count;

            assert (count >= 1) throw Errors.InvalidMintCount;
            assert (count <= PUBLIC_MINT_MAX_COUNT) throw Errors.InvalidMintCount;
            assert (storage.nextItemIndex + count <= MAX_SUPPLY) throw Errors.SoldOut;

            val required = (MINT_PRICE + PUBLIC_MINT_ITEM_GAS) * count;
            assert (in.value >= required) throw Errors.InsufficientPayment;

            var i = 0;
            while (i < count) {
                val itemIndex = storage.nextItemIndex;
                deployNftItem(
                    itemIndex,
                    storage.nftItemCode,
                    PUBLIC_MINT_ITEM_GAS,
                    NftItemInitAtDeployment {
                        ownerAddress: in.senderAddress,
                        content: buildItemContent(itemIndex),
                    }.toCell(),
                );
                storage.nextItemIndex += 1;
                i += 1;
            }
            storage.save();
        }

        else => {
            // ignore empty messages, "wrong opcode" for others
            assert (in.body.isEmpty()) throw 0xFFFF;
        }
    }
}

fun onBouncedMessage(_in: InMessageBounced) {
    // For receiving funds from possibly bounced deployment of NFT
}

get fun get_collection_data(): CollectionDataReply {
    val storage = lazy NftCollectionStorage.load();
    val content = lazy storage.content.load();

    return {
        nextItemIndex: storage.nextItemIndex,
        maxSupply: storage.maxSupply,
        revealEnabled: storage.revealEnabled,
        baseUri: storage.baseUri,
        collectionMetadata: content.collectionMetadata,
        adminAddress: storage.adminAddress,
    };
}

get fun get_nft_address_by_index(itemIndex: int): address {
    val storage = lazy NftCollectionStorage.load();
    val nftDeployed = calcDeployedNftItem(itemIndex, contract.getAddress(), storage.nftItemCode);
    return nftDeployed.calculateAddress();
}

get fun royalty_params(): RoyaltyParams {
    val storage = lazy NftCollectionStorage.load();
    return storage.royaltyParams.load();
}

get fun get_nft_content(
    itemIndex: int,
    _individualNftContent: string,
): Cell<OffchainMetadataReply> {
    val storage = lazy NftCollectionStorage.load();
    var b = StringBuilder.create();

    if (!storage.revealEnabled) {
        b.append("hidden.json");
    } else {
        b.append(itemIndex.toDecimalString());
        b.append(".json");
    }

    return OffchainMetadataReply {
        string: b.build()
    }.toCell();
}

get fun get_max_supply(): int {
    return MAX_SUPPLY;
}

get fun get_project_name(): string {
    return PROJECT_NAME;
}

get fun get_reveal_status(): bool {
    val storage = lazy NftCollectionStorage.load();
    return storage.revealEnabled;
}

get fun get_base_uri(): string {
    val storage = lazy NftCollectionStorage.load();
    return storage.baseUri;
}

get fun get_mint_price(): coins {
    return MINT_PRICE;
}
