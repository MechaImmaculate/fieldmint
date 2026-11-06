import os
import time

import httpx

RPC = os.getenv("SOLANA_RPC", "https://api.devnet.solana.com")
ESCROW = os.getenv("ESCROW_ADDRESS", "")


def get_parsed_tx(signature: str, tries: int = 12):
    """Poll until the transaction is confirmed (or give up after ~18 s)."""
    payload = {
        "jsonrpc": "2.0", "id": 1, "method": "getTransaction",
        "params": [signature, {"encoding": "jsonParsed", "commitment": "confirmed",
                               "maxSupportedTransactionVersion": 0}],
    }
    for _ in range(tries):
        try:
            result = httpx.post(RPC, json=payload, timeout=15).json().get("result")
        except httpx.HTTPError:
            result = None
        if result:
            return result
        time.sleep(1.5)
    return None


def transferred_lamports(tx: dict, source: str, destination: str) -> int:
    """Total lamports moved source -> destination by System Program transfers in this tx."""
    if not tx.get("meta") or tx["meta"].get("err") is not None:
        return 0
    total = 0
    for ix in tx["transaction"]["message"]["instructions"]:
        parsed = ix.get("parsed")
        if ix.get("program") == "system" and isinstance(parsed, dict) and parsed.get("type") == "transfer":
            info = parsed["info"]
            if info["source"] == source and info["destination"] == destination:
                total += int(info["lamports"])
    return total