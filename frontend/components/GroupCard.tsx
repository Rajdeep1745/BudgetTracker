import type { ReactNode } from "react";
import type { BudgetGroup, GroupName } from "../types";

export default function GroupCard({
  name,
  group,
  color,
  icon,
  formatMoney,
  percent,
}: {
  name: GroupName;
  group?: BudgetGroup;
  color: string;
  icon: ReactNode;
  formatMoney: (value: number) => string;
  percent: (value: number, total: number) => number;
}) {
  const spent = group?.spent ?? 0;
  const budget = group?.budget ?? 0;
  return (
    <article className="group-tile">
      <div className="group-tile-head">
        <span className="group-icon" style={{ color, backgroundColor: `${color}14` }}>{icon}</span>
        <div><strong>{name}</strong><small>{group?.percent ?? 0}% of monthly budget</small></div>
        <b>{formatMoney(budget)}</b>
      </div>
      <div className="progress-track"><span style={{ width: `${percent(spent, budget)}%`, backgroundColor: color }} /></div>
      <div className="group-tile-foot">
        <span>{formatMoney(spent)} spent</span>
        <span>{formatMoney(group?.remaining ?? 0)} remaining</span>
      </div>
    </article>
  );
}
