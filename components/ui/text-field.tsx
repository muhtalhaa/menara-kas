type FieldProps = {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
};

export function TextField({
  label,
  name,
  type = "text",
  defaultValue,
  error,
  required,
  placeholder,
  autoComplete,
}: FieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="h-[38px] w-full rounded-lg border border-mist-300 bg-white px-3 text-sm text-ink outline-none focus:border-teal-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
      />
      {error ? <span className="text-xs text-deficit">{error}</span> : null}
    </label>
  );
}
