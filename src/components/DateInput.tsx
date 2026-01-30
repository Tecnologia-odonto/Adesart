import { forwardRef } from 'react';

interface DateInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const formatDateMask = (value: string): string => {
  const numbers = value.replace(/\D/g, '');

  if (numbers.length <= 2) {
    return numbers;
  }
  if (numbers.length <= 4) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  }
  return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
};

const convertToISODate = (ddmmyyyy: string): string => {
  if (!ddmmyyyy || ddmmyyyy.length !== 10) return ddmmyyyy;

  const [day, month, year] = ddmmyyyy.split('/');
  if (!day || !month || !year) return ddmmyyyy;

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

const convertFromISODate = (isoDate: string): string => {
  if (!isoDate) return '';

  if (isoDate.includes('/')) {
    return isoDate;
  }

  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;

  return `${day}/${month}/${year}`;
};

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ label, error, className = '', value, onChange, ...props }, ref) => {
    const displayValue = convertFromISODate(value as string || '');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatDateMask(e.target.value);

      let finalValue = formatted;
      if (formatted.length === 10) {
        finalValue = convertToISODate(formatted);
      }

      const maskedEvent = {
        ...e,
        target: {
          ...e.target,
          value: finalValue,
        },
      };

      if (onChange) {
        onChange(maskedEvent as React.ChangeEvent<HTMLInputElement>);
      }
    };

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          type="text"
          placeholder="DD/MM/AAAA"
          maxLength={10}
          value={displayValue}
          onChange={handleChange}
          className={`
            w-full px-3 py-2 border border-slate-300 rounded-lg
            focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
            disabled:bg-slate-100 disabled:cursor-not-allowed
            text-slate-900 placeholder-slate-400
            transition-colors
            ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }
);

DateInput.displayName = 'DateInput';
