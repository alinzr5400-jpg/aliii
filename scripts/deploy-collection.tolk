import "utils/common"

fun main() {
    val deployer = promptNftWallet("NFT_DEPLOYER", "Select NFT Deployer");
    val info: NftCollectionInfo = {
    name: "Alamdar",
    description: "114 Resistance Martyrs",
    image: "https://api.xxx.ir/collection.png",
};

    val collection = deployNftCollection(deployer, info);

    printNftCollectionInfo(collection, "ALAMDAR");
}
