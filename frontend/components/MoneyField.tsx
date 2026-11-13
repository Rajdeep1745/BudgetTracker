export default function MoneyField({
  id,
  label,
  hint,
  value,
  onChange,
  currency,
  allowNegative = false,
}: {
  id: string;
  label: string;
  hint?: string;
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
      {hint && <small className="field-hint">{hint}</small>}
    </div>
  );
}
