import { forwardRef } from 'react';

interface DateInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ label, error, className = '', ...props }, ref) => {
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
          type="date"
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
