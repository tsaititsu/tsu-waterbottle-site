type SelectFieldProps = {
  label: string
  options: string[]
}

export function SelectField({ label, options }: SelectFieldProps) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-textDark">{label}</span>
      <select className="focus-ring rounded-lg border border-borderSoft bg-white px-4 py-3">
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}
