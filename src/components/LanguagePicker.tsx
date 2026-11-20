import { LAB_LANGUAGES, type LabLanguage } from '../api'

/**
 * TypeScript or JavaScript for a certification exam. In a hands-on lab it's the language of the candidate's test
 * files; in a multiple-choice exam it decides which language-specific questions they can get.
 */
export function LanguagePicker({
  name,
  value,
  onChange,
  disabled,
  lab,
}: {
  name: string
  value: LabLanguage
  onChange: (value: LabLanguage) => void
  disabled?: boolean
  /** A hands-on lab: the candidate writes test files in this language. */
  lab: boolean
}) {
  return (
    <fieldset className="language-picker" disabled={disabled}>
      <legend>{lab ? 'Language for your tests' : 'Exam language'}</legend>
      <div className="options" role="radiogroup">
        {LAB_LANGUAGES.map((l) => (
          <label key={l.value} className={`option ${value === l.value ? 'selected' : ''}`}>
            <input type="radio" name={name} checked={value === l.value} onChange={() => onChange(l.value)} />
            <span>
              <strong>{l.label}</strong>
              {lab && <span className="faint"> · each task is a <code>.spec.{l.extension}</code> file</span>}
            </span>
          </label>
        ))}
      </div>
      <p className="faint" style={{ margin: '8px 0 0' }}>
        {lab ? 'Both are graded the same way.' : 'Questions about one language only are left out for the other.'} You
        can change this from your dashboard until you start the exam.
      </p>
    </fieldset>
  )
}
