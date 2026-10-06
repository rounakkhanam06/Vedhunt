import { useState } from 'react';
import LegalDocumentModal from './LegalDocumentModal';

/**
 * "I agree to the Terms & Conditions and Privacy Policy" checkbox for the
 * client / employee login forms. The links open the documents in a modal
 * (without leaving the form). Nothing is stored server-side.
 *
 * @param {'client'|'employee'} audience
 */
const LegalConsentCheckbox = ({ audience, checked, onChange, className = '', labelClassName = '' }) => {
  const [openDoc, setOpenDoc] = useState(null);
  const link = (doc, text) => (
    <button
      type="button"
      onClick={() => setOpenDoc(doc)}
      className="underline underline-offset-2 font-medium hover:opacity-80 cursor-pointer text-[#FF5A1F]"
    >
      {text}
    </button>
  );

  return (
    <div className={className}>
      <label className={`flex items-start gap-2.5 text-xs sm:text-sm select-none leading-relaxed ${labelClassName}`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 w-4 h-4 shrink-0 accent-[#FF5A1F] cursor-pointer"
          aria-describedby={`legal-consent-${audience}`}
        />
        <span id={`legal-consent-${audience}`}>
          I agree to the {link(`${audience}-terms`, 'Terms & Conditions')} and {link(`${audience}-privacy`, 'Privacy Policy')}.
        </span>
      </label>
      {openDoc && <LegalDocumentModal doc={openDoc} onClose={() => setOpenDoc(null)} />}
    </div>
  );
};

export default LegalConsentCheckbox;
