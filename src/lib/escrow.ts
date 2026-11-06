import { AccountRole, address, getAddressEncoder, getProgramDerivedAddress } from "@solana/kit";

const SYSTEM_PROGRAM = address("11111111111111111111111111111111");
const text = new TextEncoder();
const addr = getAddressEncoder();

// Anchor instruction discriminators: first 8 bytes of sha256("global:<name>")
const DISC = {
  create: [111, 131, 187, 98, 160, 193, 114, 244],
  payout: [149, 140, 194, 236, 174, 189, 6, 239],
  close: [65, 49, 110, 7, 63, 238, 206, 77],
};

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const num = (size: number, write: (v: DataView) => void) => {
  const b = new Uint8Array(size);
  write(new DataView(b.buffer));
  return b;
};
const u16 = (n: number) => num(2, (v) => v.setUint16(0, n, true));
const u32 = (n: number) => num(4, (v) => v.setUint32(0, n, true));
const u64 = (n: bigint) => num(8, (v) => v.setBigUint64(0, n, true));
const i64 = (n: bigint) => num(8, (v) => v.setBigInt64(0, n, true));

export const uuidBytes = (id: string) =>
  Uint8Array.from(id.replace(/-/g, "").match(/../g)!.map((h) => parseInt(h, 16)));

export const feeFor = (reward: bigint, bps: number) => (reward * BigInt(bps)) / 10_000n;
export const totalFor = (reward: bigint, count: number, bps: number) =>
  (reward + feeFor(reward, bps)) * BigInt(count);

export async function sha256(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", text.encode(value)));
}
export const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

async function pda(programId: string, seeds: Uint8Array[]) {
  const [a] = await getProgramDerivedAddress({ programAddress: address(programId), seeds });
  return a;
}

export async function createCampaignIx(p: {
  programId: string; owner: string; campaignId: string; reward: bigint; maxPayouts: number;
  feeBps: number; deadline: bigint; reviewer: string; treasury: string;
}) {
  const escrow = await pda(p.programId, [text.encode("campaign"), addr.encode(address(p.owner)) as Uint8Array, uuidBytes(p.campaignId)]);
  const data = concat(
    Uint8Array.from(DISC.create), uuidBytes(p.campaignId), u64(p.reward), u32(p.maxPayouts),
    u16(p.feeBps), i64(p.deadline),
    addr.encode(address(p.reviewer)) as Uint8Array, addr.encode(address(p.treasury)) as Uint8Array,
  );
  return {
    escrow: escrow as string,
    ix: {
      programAddress: address(p.programId),
      accounts: [
        { address: address(p.owner), role: AccountRole.WRITABLE_SIGNER },
        { address: escrow, role: AccountRole.WRITABLE },
        { address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
      ],
      data,
    },
  };
}

export async function payoutIx(p: {
  programId: string; reviewer: string; escrow: string; contributor: string; treasury: string;
  submissionHash: Uint8Array;
}) {
  const receipt = await pda(p.programId, [text.encode("receipt"), addr.encode(address(p.escrow)) as Uint8Array, p.submissionHash]);
  return {
    programAddress: address(p.programId),
    accounts: [
      { address: address(p.reviewer), role: AccountRole.WRITABLE_SIGNER },
      { address: address(p.escrow), role: AccountRole.WRITABLE },
      { address: address(p.contributor), role: AccountRole.WRITABLE },
      { address: address(p.treasury), role: AccountRole.WRITABLE },
      { address: receipt, role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
    ],
    data: concat(Uint8Array.from(DISC.payout), p.submissionHash),
  };
}

export function closeIx(p: { programId: string; owner: string; escrow: string }) {
  return {
    programAddress: address(p.programId),
    accounts: [
      { address: address(p.owner), role: AccountRole.WRITABLE_SIGNER },
      { address: address(p.escrow), role: AccountRole.WRITABLE },
    ],
    data: Uint8Array.from(DISC.close),
  };
}