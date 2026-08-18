import dotenv from "dotenv";
dotenv.config({ path: "./backend/.env" });

import { Address, TonClient } from "@ton/ton";
import { AlamdarCollection } from "../wrappers-ts/AlamdarCollection.gen";

async function main() {
  const client = new TonClient({
    endpoint:
      process.env.TON_RPC || "https://testnet.toncenter.com/api/v2/jsonRPC",
    apiKey: process.env.TON_API_KEY || process.env.TONCENTER_API_KEY,
  });
  const addr = Address.parse(
    "kQCYO_-zBxh_cVji9k8YUAEb4aFh73t2iIwvdzqpF04HQdQh"
  );
  const col = client.open(AlamdarCollection.fromAddress(addr));
  const data = await col.getCollectionData();
  console.log(
    JSON.stringify(
      {
        reveal: data.revealEnabled,
        baseUri: data.baseUri,
        next: Number(data.nextItemIndex),
        admin: data.adminAddress.toString(),
      },
      null,
      2
    )
  );

  const reply = await col.getNftContent(0n, "0");
  const uri =
    (reply as { ref?: { string?: string } }).ref?.string ??
    (reply as { string?: string }).string ??
    String(reply);
  console.log("URI=" + uri);
}

main().catch((e) => {
  console.error("ERR", e instanceof Error ? e.message : e);
  process.exit(1);
});
