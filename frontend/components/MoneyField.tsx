export default function MoneyField({
  id,
  label,
  value,
  onChange,
  currency,
  allowNegative = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  currency: string;
  allowNegative?: boolean;
}) {
  return (
    <div>
      <label className="input-label" htmlFor={id}>{label}</label>
      <div className="money-input compact-money-input">
        <span>{currency === "INR" ? "₹" : currency}</span>
        <input
          id={id}
          required
          step="0.01"
          type="number"
          {...(allowNegative ? {} : { min: "0" })}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}
