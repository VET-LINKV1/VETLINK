/**
 * OTPInput.jsx
 * 6-box OTP input with auto-advance and paste support.
 */
import { useRef, useEffect } from 'react';

function OTPInput({ value, onChange, disabled }) {
  const inputs = useRef([]);
  const digits = value.padEnd(6, '').split('').slice(0, 6);

  useEffect(() => {
    // Auto-focus first empty box
    const firstEmpty = digits.findIndex(d => !d);
    const focusIndex = firstEmpty === -1 ? 5 : firstEmpty;
    inputs.current[focusIndex]?.focus();
  }, []);

  const handleChange = (index, char) => {
    if (!/^[0-9]?$/.test(char)) return;
    const newDigits = [...digits];
    newDigits[index] = char;
    onChange(newDigits.join(''));
    // Auto-advance to next box
    if (char && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Move back and clear previous
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        onChange(newDigits.join(''));
        inputs.current[index - 1]?.focus();
      } else {
        const newDigits = [...digits];
        newDigits[index] = '';
        onChange(newDigits.join(''));
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) inputs.current[index + 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted.padEnd(6, '').slice(0, 6));
    inputs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="flex gap-3 justify-center">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={el => (inputs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          className={`
            w-12 h-14 text-center text-xl font-display font-700 rounded-xl border-2
            focus:outline-none focus:ring-0 transition-all duration-150
            disabled:opacity-50 disabled:cursor-not-allowed
            ${digit
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-slate-200 bg-white text-slate-800'}
            focus:border-blue-500 focus:bg-blue-50
          `}
        />
      ))}
    </div>
  );
}

export default OTPInput;
