import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const defaultButtonClassName =
  'absolute inset-y-0 right-0 flex items-center justify-center px-4 text-gray-400 transition-colors hover:text-black focus:outline-none dark:hover:text-white';

export default function PasswordField({
  className = '',
  containerClassName = '',
  buttonClassName = defaultButtonClassName,
  toggleShowLabel = 'Show password',
  toggleHideLabel = 'Hide password',
  style,
  ...props
}) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={`relative ${containerClassName}`.trim()}>
      <input
        {...props}
        type={isVisible ? 'text' : 'password'}
        className={className}
        style={{ ...style, paddingRight: style?.paddingRight ?? '3.5rem' }}
      />
      <button
        type="button"
        aria-label={isVisible ? toggleHideLabel : toggleShowLabel}
        aria-pressed={isVisible}
        onClick={() => setIsVisible((visible) => !visible)}
        className={buttonClassName}
      >
        {isVisible ? <EyeOff size={18} strokeWidth={2.2} /> : <Eye size={18} strokeWidth={2.2} />}
      </button>
    </div>
  );
}
