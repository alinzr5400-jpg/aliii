const { client, COLLECTION_ADDRESS } = require("./ton");

async function getCollectionState() {

    if (!COLLECTION_ADDRESS) {
        return {
            connected: false
        };
    }

    return {
        connected: true,
        address: COLLECTION_ADDRESS.toString()
    };

}

module.exports = {
    getCollectionState
};