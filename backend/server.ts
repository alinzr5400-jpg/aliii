import dotenv from "dotenv";
dotenv.config({ path: "./backend/.env" });

import express from "express";
import cors from "cors";
import { Address } from "@ton/ton";
import { readCollectionState } from "./collection";
import { buildSaleConfig, getStaticSaleSettings } from "./sale";
import {
  buildPublicMintPayload,
  buildTextCommentPayload,
  mintPaymentNano,
} from "./mintPayload";
import {
  createOrder,
  ensureOrdersTable,
  getOrder,
  updateOrderStatus,
} from "./orders";
import { adminMintToBuyer } from "./adminMint";
import { isRateLimitError } from "./ton";
import { getHiddenImageUrl, LEGENDARY_FILES } from "./media";
import {
  assignCardsForTokens,
  ensureAssignmentTables,
  getAssignment,
  listAssignments,
  seedLegendaryInventory,
} from "./assignments";
import { setRevealEnabled } from "./reveal";

// Keep the existing SQLite file for now.
const db = require("./database");

ensureOrdersTable(db);
ensureAssignmentTables(db);
seedLegendaryInventory(db);

const app = express();
const PORT = Number(process.env.PORT ?? 3000);
const corsOrigin = process.env.CORS_ORIGIN ?? "*";

app.use(cors({ origin: corsOrigin === "*" ? true : corsOrigin }));
app.use(express.json());

function getNftRow(id: number) {
  return db
    .prepare("SELECT id, name, rarity, image FROM martyrs WHERE id = ?")
    .get(id);
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    project: "Alamdar",
    media: {
      hiddenConfigured: true,
      legendaryCards: LEGENDARY_FILES.length,
    },
  });
});

app.get("/collection", async (_req, res) => {
  try {
    const state = await readCollectionState();
    const sale = getStaticSaleSettings();

    res.json({
      project: "Alamdar",
      payment: "TON",
      contractConnected: true,
      contractAddress: process.env.TON_COLLECTION_ADDRESS ?? null,
      maxSupply: state.maxSupply,
      reveal: state.revealEnabled,
      minted: state.nextItemIndex,
      remaining: Math.max(Number(state.maxSupply) - Number(state.nextItemIndex), 0),
      baseUri: state.baseUri,
      adminAddress: state.adminAddress,
      mintPrice: sale.mintPrice,
      network: sale.network,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to read contract state",
    });
  }
});

app.get("/sale", async (_req, res) => {
  try {
    const config = await buildSaleConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load sale config",
    });
  }
});

app.get("/config", async (_req, res) => {
  try {
    const config = await buildSaleConfig();
    res.json(config);
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Unknown error",
    });
  }
});

app.get("/nft/:id", async (req, res) => {
  const rawId = String(req.params.id ?? "").replace(/\.json$/i, "");
  const id = Number(rawId);

  if (!Number.isInteger(id) || id < 0 || id >= 12652) {
    return res.status(404).json({ error: "NFT not found" });
  }

  try {
    const state = await readCollectionState();
    const hiddenImage = getHiddenImageUrl();

    if (!state.revealEnabled) {
      return res.json({
        name: "Alamdar",
        description: "Reveal has not started yet.",
        image: hiddenImage,
        attributes: [{ trait_type: "Status", value: "Hidden" }],
      });
    }

    const assigned = getAssignment(db, id);
    if (assigned) {
      return res.json({
        name: assigned.name,
        description: "Alamdar NFT Collection",
        image: assigned.image,
        attributes: [
          { trait_type: "Rarity", value: assigned.rarity },
          { trait_type: "Token ID", value: id },
          { trait_type: "Card", value: assigned.cardKey },
        ],
      });
    }

    const nft = getNftRow(id);
    if (!nft) {
      return res.status(404).json({ error: "NFT metadata not found" });
    }

    return res.json({
      name: nft.name,
      description: "Alamdar NFT Collection",
      image: nft.image,
      attributes: [
        { trait_type: "Rarity", value: nft.rarity },
        { trait_type: "ID", value: nft.id },
      ],
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to read NFT metadata",
    });
  }
});

app.get("/gallery", async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 6), 24);
  try {
    const state = await readCollectionState();
    const hiddenImage = getHiddenImageUrl();

    if (!state.revealEnabled) {
      const cards = Array.from({ length: limit }, (_, i) => ({
        id: i,
        name: "Alamdar",
        role: "Hidden",
        rarity: "Hidden",
        image: hiddenImage,
      }));
      return res.json({ reveal: false, items: cards });
    }

    const assigned = listAssignments(db, limit);
    if (assigned.length > 0) {
      return res.json({
        reveal: true,
        items: assigned.map((row) => ({
          id: row.tokenId,
          name: row.name,
          role: row.rarity,
          rarity: row.rarity,
          image: row.image,
        })),
      });
    }

    const rows = db
      .prepare(
        "SELECT id, name, rarity, image FROM martyrs ORDER BY id ASC LIMIT ?"
      )
      .all(limit) as Array<{
      id: number;
      name: string;
      rarity: string;
      image: string;
    }>;

    return res.json({
      reveal: true,
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        role: row.rarity,
        rarity: row.rarity,
        image: row.image,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load gallery",
    });
  }
});

/**
 * Prepare a TonConnect transaction for buying NFTs.
 * - admin mode: pay treasury/admin, backend mints after confirm
 * - public mode: PublicMint payload to collection (requires redeployed contract)
 */
app.post("/mint/prepare", async (req, res) => {
  try {
    const count = Number(req.body?.count);
    const buyerAddress = String(req.body?.buyerAddress ?? "").trim();
    const config = await buildSaleConfig();

    if (!config.saleOpen) {
      return res.status(403).json({ error: "Sale has not started yet" });
    }

    if (!Number.isInteger(count) || count < config.minBuy || count > config.maxBuy) {
      return res.status(400).json({
        error: `Count must be between ${config.minBuy} and ${config.maxBuy}`,
      });
    }

    if (!buyerAddress) {
      return res.status(400).json({ error: "buyerAddress is required" });
    }

    try {
      Address.parse(buyerAddress);
    } catch {
      return res.status(400).json({ error: "Invalid buyerAddress" });
    }

    if (config.remaining < count) {
      return res.status(400).json({ error: "Not enough NFTs remaining" });
    }

    const amountNano = mintPaymentNano(
      config.mintPrice,
      count,
      config.saleMode
    ).toString();

    const order = createOrder(db, {
      buyer: buyerAddress,
      count,
      amountNano,
      mode: config.saleMode,
    });

    const validUntil = Math.floor(Date.now() / 1000) + 600;

    if (config.saleMode === "public") {
      if (!config.collectionAddress) {
        return res.status(500).json({ error: "Collection address not configured" });
      }

      return res.json({
        orderId: order.id,
        mode: "public",
        validUntil,
        amount: amountNano,
        mintPrice: config.mintPrice,
        count,
        transaction: {
          validUntil,
          messages: [
            {
              address: config.collectionAddress,
              amount: amountNano,
              payload: buildPublicMintPayload(count),
            },
          ],
        },
      });
    }

    if (!config.paymentAddress) {
      return res.status(500).json({ error: "Payment address not configured" });
    }

    return res.json({
      orderId: order.id,
      mode: "admin",
      validUntil,
      amount: amountNano,
      mintPrice: config.mintPrice,
      count,
      transaction: {
        validUntil,
        messages: [
          {
            address: config.paymentAddress,
            amount: amountNano,
            payload: buildTextCommentPayload(`alamdar:${order.id}`),
          },
        ],
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to prepare mint",
    });
  }
});

/**
 * After TonConnect payment succeeds:
 * - public mode: mark order paid (on-chain mint already happened)
 * - admin mode: mint NFTs to buyer with admin wallet
 */
app.post("/mint/confirm", async (req, res) => {
  try {
    const orderId = String(req.body?.orderId ?? "").trim();
    const boc = req.body?.boc ? String(req.body.boc) : null;

    if (!orderId) {
      return res.status(400).json({ error: "orderId is required" });
    }

    const order = getOrder(db, orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.status === "minted") {
      return res.json({
        ok: true,
        status: "minted",
        orderId,
        mintIndices: order.mint_indices
          ? JSON.parse(order.mint_indices)
          : [],
      });
    }

    if (order.mode === "public") {
      updateOrderStatus(db, orderId, "paid", { txHash: boc ?? undefined });
      return res.json({
        ok: true,
        status: "paid",
        orderId,
        mode: "public",
        message: "Payment sent. NFTs mint on-chain via PublicMint.",
      });
    }

    updateOrderStatus(db, orderId, "minting", { txHash: boc ?? undefined });

    const mintIndices = await adminMintToBuyer(order.buyer, order.count);
    const assignments = assignCardsForTokens(db, mintIndices);
    updateOrderStatus(db, orderId, "minted", { mintIndices });

    return res.json({
      ok: true,
      status: "minted",
      orderId,
      mode: "admin",
      mintIndices,
      count: order.count,
      // Card identities are assigned now; images stay hidden until revealEnabled
      assignments: assignments.map((a) => ({
        tokenId: a.tokenId,
        rarity: a.rarity,
        cardKey: a.cardKey,
      })),
    });
  } catch (error) {
    const orderId = String(req.body?.orderId ?? "").trim();
    if (orderId) {
      updateOrderStatus(db, orderId, "failed");
    }
    if (isRateLimitError(error)) {
      return res.status(429).json({
        error:
          "Toncenter rate limit (429). Wait ~1 minute, set TON_API_KEY on Render, then retry confirm.",
      });
    }
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Mint confirm failed",
    });
  }
});

app.get("/mint/order/:id", (req, res) => {
  const order = getOrder(db, req.params.id);
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }
  return res.json({
    id: order.id,
    buyer: order.buyer,
    count: order.count,
    amountNano: order.amount_nano,
    mode: order.mode,
    status: order.status,
    mintIndices: order.mint_indices ? JSON.parse(order.mint_indices) : null,
    createdAt: order.created_at,
  });
});

function requireAdminSecret(req: express.Request, res: express.Response): boolean {
  const secret = process.env.ADMIN_API_SECRET?.trim();
  if (!secret) {
    res.status(503).json({
      error: "ADMIN_API_SECRET is not configured on the backend",
    });
    return false;
  }
  const provided =
    String(req.header("x-admin-secret") ?? "") ||
    String(req.body?.secret ?? "");
  if (provided !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

/**
 * On-chain reveal toggle (admin only).
 * Header: x-admin-secret: <ADMIN_API_SECRET>
 * Body: { "enabled": true | false }
 */
app.post("/admin/reveal", async (req, res) => {
  if (!requireAdminSecret(req, res)) return;

  const enabled = Boolean(req.body?.enabled);
  try {
    const state = await setRevealEnabled(enabled);
    return res.json({
      success: true,
      revealEnabled: state.revealEnabled,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Reveal update failed",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Alamdar backend started on port ${PORT}`);
});
