const MIN_TONS_FOR_STORAGE = ton("0.05")

/// Maximum NFTs per batch deploy — bounded by the 255-action TVM limit.
const BATCH_SIZE_LIMIT = 250

/// Primary sale price per NFT (nanoton via ton()).
const MINT_PRICE = ton("0.5")

/// Gas reserved per NFT item deploy during public mint.
const PUBLIC_MINT_ITEM_GAS = ton("0.05")

/// Max NFTs a single PublicMint message can buy.
const PUBLIC_MINT_MAX_COUNT = 88
