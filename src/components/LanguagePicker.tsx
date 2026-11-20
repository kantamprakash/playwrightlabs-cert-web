import { LAB_LANGUAGES, type LabLanguage } from '../api'

/** TypeScript or JavaScript for a hands-on lab exam. Both are graded the same way. */
export function LanguagePicker({
  name,
  value,
  onChange,
  disabled,
}: {
  name: string
  value: LabLanguage
  onChange: (value: LabLanguage) => void
  disabled?: boolean
}) {
  return (
    <fieldset className="language-picker" disabled={disabled}>
      <legend>Language for your tests</legend>
      <div className="options" role="radiogroup">
        {LAB_LANGUAGES.map((l) => (
          <label key={l.value} className={`option ${value === l.value ? 'selected' : ''}`}>
            <input type="radio" name={name} checked={value === l.value} onChange={() => onChange(l.value)} />
            <span>
              <strong>{l.label}</strong>
              <span className="faint"> · each task is a <code>.spec.{l.extension}</code> file</span>
            </span>
          </label>
        ))}
      </div>
      <p className="faint" style={{ margin: '8px 0 0' }}>
        Both are graded the same way. You can change this from your dashboard until you start the exam.
      </p>
    </fieldset>
  )
}
