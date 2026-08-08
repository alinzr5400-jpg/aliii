const express = require("express");
const db = require("./database");
const { getCollectionState } = require("./collection");
require("dotenv").config();

const app = express();

const PORT = 3000;

// بعداً از Smart Contract خوانده می‌شود
let revealEnabled = false;

// مقداردهی اولیه دیتابیس
const count = db.prepare("SELECT COUNT(*) AS total FROM martyrs").get();

if (count.total === 0) {
    const insert = db.prepare(`
        INSERT INTO martyrs(id, name, rarity, image)
        VALUES(?, ?, ?, ?)
    `);

    const tx = db.transaction(() => {
        for (let i = 0; i < 12652; i++) {
            insert.run(
                i,
                `NFT #${i}`,
                "Unknown",
                `https://xxx.ir/images/${i}.png`
            );
        }
    });

    tx();
}

app.get("/nft/:id", (req, res) => {
    const id = Number(req.params.id);

    if (id < 0 || id >= 12652) {
        return res.status(404).json({
            error: "NFT not found"
        });
    }

    if (!revealEnabled) {
        return res.json({
            name: "Alamdar",
            description: "Reveal has not started yet.",
            image: "https://xxx.ir/hidden.png"
        });
    }

    const nft = db.prepare(
        "SELECT * FROM martyrs WHERE id = ?"
    ).get(id);

    res.json({
        name: nft.name,
        description: "114 Martyrs Collection",
        image: nft.image,
        attributes: [
            {
                trait_type: "Rarity",
                value: nft.rarity
            },
            {
                trait_type: "ID",
                value: nft.id
            }
        ]
    });
});

app.post("/admin/reveal", (req, res) => {
    revealEnabled = true;
    res.json({ success: true });
});

app.post("/admin/hide", (req, res) => {
    revealEnabled = false;
    res.json({ success: true });
});

app.get("/collection", async (req, res) => {

    const state = await getCollectionState();

    const total = db.prepare(
        "SELECT COUNT(*) AS total FROM martyrs"
    ).get();

    res.json({
        project: "Alamdar",
        payment: "TON",
        contractConnected: state.connected,
        contractAddress: state.address ?? null,
        maxSupply: 12652,
        reveal: revealEnabled,
        minted: total.total
    });

});

app.listen(PORT, () => {
    console.log(`Backend started on port ${PORT}`);
});