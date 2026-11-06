const styles: Record<string, string> = {
  draft: "bg-amber/15 text-amber-700",
  active: "bg-brand-2/15 text-brand",
  closed: "bg-border-low text-muted",
};
const labels: Record<string, string> = {
  draft: "Awaiting funding",
  active: "Funded · live",
  closed: "Closed",
};

export default function StatusChip({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status] ?? styles.closed}`}>
      {labels[status] ?? status}
    </span>
  );
}