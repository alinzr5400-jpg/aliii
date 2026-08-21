/**
 * Proxy IPFS media through our API host so Tonkeeper/TonAPI imgproxy
 * can fetch images (public Pinata often fails from their network).
 */
import type { Request, Response } from "express";
import { IPFS_FETCH_GATEWAYS } from "./media";

function safeCid(cid: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(cid) && cid.length >= 10 && cid.length <= 128;
}

function safeFile(file: string): boolean {
  return /^[0-9A-Za-z._-]+$/.test(file) && file.length <= 120;
}

export async function proxyIpfsMedia(req: Request, res: Response) {
  const cid = String(req.params.cid || "");
  const file = req.params.file ? String(req.params.file) : "";

  if (!safeCid(cid)) {
    return res.status(400).json({ error: "Invalid CID" });
  }
  if (file && !safeFile(file)) {
    return res.status(400).json({ error: "Invalid file" });
  }

  const rel = file ? `${cid}/${file}` : cid;
  let lastStatus = 0;

  for (const gateway of IPFS_FETCH_GATEWAYS) {
    const url = `${gateway.replace(/\/$/, "")}/${rel}`;
    try {
      const upstream = await fetch(url, {
        signal: AbortSignal.timeout(20_000),
        headers: { Accept: "image/*,*/*" },
      });
      lastStatus = upstream.status;
      if (!upstream.ok) continue;

      const contentType =
        upstream.headers.get("content-type") || "image/jpeg";
      const buf = Buffer.from(await upstream.arrayBuffer());
      if (buf.length < 100) continue;

      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Cache-Control",
        "public, max-age=86400, s-maxage=86400, immutable"
      );
      res.setHeader("X-Alamdar-Media-Source", gateway);
      return res.status(200).send(buf);
    } catch {
      // try next gateway
    }
  }

  return res.status(502).json({
    error: "Media unavailable from IPFS gateways",
    path: rel,
    lastStatus: lastStatus || null,
  });
}
