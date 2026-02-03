import { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

export function ToastItem({ toast, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, 5000); // Auto-close after 5 seconds

    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertCircle,
    info: Info,
  };

  const colors = {
    success: { bg: '#d1fae5', border: '#10b981', text: '#065f46', icon: '#10b981' },
    error: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', icon: '#ef4444' },
    warning: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', icon: '#f59e0b' },
    info: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af', icon: '#3b82f6' },
  };

  const Icon = icons[toast.type];
  const color = colors[toast.type];

  return (
    <div
      className="toast-item"
      style={{
        background: color.bg,
        borderLeft: `4px solid ${color.border}`,
        color: color.text,
      }}
    >
      <Icon size={20} style={{ color: color.icon }} />
      <span>{toast.message}</span>
      <button
        onClick={() => onClose(toast.id)}
        className="toast-close"
        style={{ color: color.text }}
      >
        <X size={16} />
      </button>
      <style>{`
        .toast-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          border-radius: 0.5rem;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          margin-bottom: 0.75rem;
          min-width: 300px;
          max-width: 500px;
          animation: slideIn 0.3s ease-out;
        }
        .toast-item span {
          flex: 1;
          font-size: 0.875rem;
          line-height: 1.25rem;
        }
        .toast-close {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.25rem;
          display: flex;
          align-items: center;
          opacity: 0.7;
          transition: opacity 0.2s;
        }
        .toast-close:hover {
          opacity: 1;
        }
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}



