const db = require("./database");
const martyrs = require("./martyrs.json");

db.prepare("DELETE FROM martyrs").run();

const insert = db.prepare(`
INSERT INTO martyrs(id,name,rarity,image)
VALUES(?,?,?,?)
`);

const tx = db.transaction(() => {

    let nftId = 0;

    while (nftId < 12652) {

        const martyr = martyrs[nftId % martyrs.length];

        insert.run(
            nftId,
            martyr.name,
            martyr.rarity,
            martyr.image
        );

        nftId++;
    }

});

tx();

console.log("Seed completed.");