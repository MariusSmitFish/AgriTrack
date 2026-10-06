import { useState } from 'react'
import { Button } from './Button'
import { Input } from './Input'
import { TagScanDialog } from './TagScanDialog'

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
  const [open, setOpen] = useState(false)

  return (
    <>
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
        <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => setOpen(true)}>
          Scan with camera
        </Button>
      </div>
      <TagScanDialog
        open={open}
        title={`Scan ${label}`}
        initialValue={value}
        onClose={() => setOpen(false)}
        onApply={(next) => {
          if (onCommit) onCommit(next)
          else onChange(next)
        }}
      />
    </>
  )
}
