import { ButtonHTMLAttributes } from 'react';
import { Loader2, LucideIcon } from 'lucide-react';

interface LinkActionIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  tone?: 'default' | 'danger' | 'success';
  loading?: boolean;
}

export function LinkActionIconButton({
  icon: Icon,
  label,
  tone = 'default',
  loading = false,
  className = '',
  disabled,
  type = 'button',
  ...props
}: LinkActionIconButtonProps) {
  const toneClasses = {
    default: 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700',
    danger: 'border-red-200 bg-white text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700',
    success: 'border-emerald-200 bg-white text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700',
  };

  return (
    <button
      type={type}
      title={label}
      aria-label={label}
      disabled={disabled || loading}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${toneClasses[tone]} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Icon className="w-4 h-4" />
      )}
    </button>
  );
}
