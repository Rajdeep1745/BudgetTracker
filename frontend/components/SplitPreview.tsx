import type { GroupName } from "../types";

export default function SplitPreview({
  name,
  percent,
  amount,
  color,
  formatMoney,
}: {
  name: GroupName;
  percent: number;
  amount: number;
  color: string;
  formatMoney: (value: number) => string;
}) {
  return (
    <div className="split-preview-card">
      <div>
        <span className="dot" style={{ backgroundColor: color }} />
        <strong>{name}</strong>
        <span className="split-percent">{percent}%</span>
      </div>
      <strong className="split-amount">{formatMoney(amount)}</strong>
    </div>
  );
}
