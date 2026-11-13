import { ShoppingBasket } from "lucide-react";

export default function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <span><ShoppingBasket size={19} /></span>
      <p>{text}</p>
    </div>
  );
}
