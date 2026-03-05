import { useState, useEffect, useCallback } from 'react';

// ==================== TOAST NOTIFICATION COMPONENT ====================
// Reusable toast system: success (green), warning (yellow), error (red), info (blue)
// Auto-dismiss after 5s, stackable, animated slide-in/out

function ToastNotification({ toasts, onRemove }) {
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
            setTimeout(() => onRemove(toast.id), 400);
        }, toast.duration || 5000);

        return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onRemove]);

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => onRemove(toast.id), 400);
    };

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    return (
        <div className={`toast-item toast-${toast.type} ${isExiting ? 'toast-exit' : 'toast-enter'}`}>
            <div className="toast-icon">{icons[toast.type] || '📋'}</div>
            <div className="toast-content">
                <div className="toast-title">{toast.title}</div>
                <div className="toast-message">{toast.message}</div>
            </div>
            <button className="toast-close" onClick={handleClose}>×</button>
        </div>
    );
}

// ==================== TOAST HOOK ====================
// Custom hook for managing toast state

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
