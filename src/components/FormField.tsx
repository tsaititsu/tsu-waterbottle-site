type FormFieldProps = {
  label: string
  type?: string
  placeholder?: string
}

export function FormField({ label, type = 'text', placeholder }: FormFieldProps) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-textDark">{label}</span>
      <input className="focus-ring rounded-lg border border-borderSoft bg-white px-4 py-3" type={type} placeholder={placeholder ?? label} />
    </label>
  )
}
