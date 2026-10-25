import { Input } from './Input'

interface TagScannerFieldProps {
  label: string
  hint?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  onCommit?: (value: string) => void
  id?: string
}

export function TagScannerField({
  label,
  hint,
  placeholder = 'Optional',
  value,
  onChange,
  onCommit,
  id,
}: TagScannerFieldProps) {
  return (
    <div className="space-y-2">
      <Input
        id={id}
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onCommit?.(e.target.value)}
        placeholder={placeholder}
      />
      {hint && <p className="text-xs text-soil-500">{hint}</p>}
    </div>
  )
}
