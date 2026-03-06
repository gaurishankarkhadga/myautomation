import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ==================== TOAST NOTIFICATION COMPONENT ====================
// Premium glassmorphism toast: success, warning, error, info
// Auto-dismiss after 4s, stackable, smooth slide-in/out

function ToastNotification({ toasts, onRemove }) {
    if (!toasts || toasts.length === 0) return null;

    return (
        <div className="toast-container" id="toast-container">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
            ))}
        </div>
    );
}

function ToastItem({ toast, onRemove }) {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsExiting(true);
            setTimeout(() => onRemove(toast.id), 350);
        }, toast.duration || 4000);

        return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onRemove]);

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => onRemove(toast.id), 350);
    };

    const iconMap = {
        success: <CheckCircle size={18} strokeWidth={2} />,
        error: <XCircle size={18} strokeWidth={2} />,
        warning: <AlertTriangle size={18} strokeWidth={2} />,
        info: <Info size={18} strokeWidth={2} />
    };

    const type = toast.type || 'info';

    return (
        <div className={`toast-item toast-${type} ${isExiting ? 'toast-exit' : 'toast-enter'}`}>
            <div className={`toast-icon-wrap toast-icon-${type}`}>
                {iconMap[type] || iconMap.info}
            </div>
            <div className="toast-body">
                {toast.title && <span className="toast-title">{toast.title}</span>}
                {toast.message && <span className="toast-msg">{toast.message}</span>}
            </div>
            <button className="toast-dismiss" onClick={handleClose} aria-label="Dismiss">
                <X size={14} strokeWidth={2.5} />
            </button>
        </div>
    );
}

// ==================== TOAST HOOK ====================
export function useToasts() {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((toast) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { ...toast, id }]);
    }, []);

    const addToasts = useCallback((newToasts) => {
        const timestamped = newToasts.map((t, i) => ({
            ...t,
            id: Date.now() + Math.random() + i
        }));
        setToasts(prev => [...prev, ...timestamped]);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return { toasts, addToast, addToasts, removeToast };
}

export default ToastNotification;
