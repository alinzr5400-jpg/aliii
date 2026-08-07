import "@acton/io"
import "@acton/emulation/network"
import "@contracts/messages"
import "@wrappers/NftCollection.gen"
import "utils/common"

fun main() {
    val deployer = promptNftWallet("NFT_DEPLOYER", "Select NFT Deployer");
    val collection = promptNftCollection("Enter NFT Collection address");

    val res = collection.sendAny(
        deployer.address,
        EnableReveal { queryId: 0 }.toCell(),
        { value: ton("0.05"), bounce: true },
    );
    println(res.waitForTrace());

    printNftCollectionInfo(collection, "NFT");
}
