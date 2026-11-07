const S: Record<string, [string, string]> = {
  submitted: ["Awaiting review", "bg-amber/15 text-amber-700"],
  approved: ["Approved", "bg-brand-2/15 text-brand"],
  rejected: ["Rejected", "bg-danger/10 text-danger"],
  paid: ["Paid on Solana", "sol-chip"],
};

export default function SubStatus({ status }: { status: string }) {
  const [label, cls] = S[status] ?? [status, "bg-border-low text-muted"];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}