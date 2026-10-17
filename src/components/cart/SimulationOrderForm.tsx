type Props = {
  customerName: string;
  disabled: boolean;
  onCustomerNameChange: (name: string) => void;
};

function SimulationOrderForm({ customerName, disabled, onCustomerNameChange }: Props) {
  return (
    <div>
      <p className="mb-lg rounded-lg border bg-card px-lg py-md text-sm text-ink">
        <strong>Schul-Simulation:</strong> Es wird nichts bezahlt. Deine Bestellung fließt direkt in
        die Tagesproduktion der Anlage ein.
      </p>
      <label className="block text-sm font-semibold text-ink-muted" htmlFor="customer-name">
        Dein Name (optional)
        <input
          className="mt-sm block w-full rounded-lg border border-input-border bg-input px-md py-sm font-normal text-ink"
          disabled={disabled}
          id="customer-name"
          maxLength={60}
          onChange={(event) => onCustomerNameChange(event.target.value)}
          value={customerName}
        />
      </label>
    </div>
  );
}

export default SimulationOrderForm;
