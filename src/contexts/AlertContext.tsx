import React, { createContext, useContext, useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

type AlertType = 'info' | 'success' | 'warning' | 'error';

interface AlertOptions {
  title?: string;
  message: string;
  type?: AlertType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  isConfirm?: boolean;
}

interface AlertContextType {
  showAlert: (options: AlertOptions | string) => void;
  showConfirm: (options: Omit<AlertOptions, 'isConfirm'>) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert] = useState<AlertOptions | null>(null);

  const showAlert = (options: AlertOptions | string) => {
    if (typeof options === 'string') {
      setAlert({ message: options, type: 'info', isConfirm: false });
    } else {
      setAlert({ ...options, type: options.type || 'info', isConfirm: false });
    }
  };

  const showConfirm = (options: Omit<AlertOptions, 'isConfirm'>) => {
    setAlert({ ...options, type: options.type || 'warning', isConfirm: true });
  };

  const handleClose = () => {
    if (alert?.onCancel) alert.onCancel();
    setAlert(null);
  };

  const handleConfirm = () => {
    if (alert?.onConfirm) alert.onConfirm();
    setAlert(null);
  };

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      <AnimatePresence>
        {alert && (
          <motion.div 
            key="alert-modal" 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={alert.isConfirm ? undefined : handleClose}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 md:p-8">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    alert.type === 'error' ? 'bg-red-50 text-red-500' :
                    alert.type === 'warning' ? 'bg-amber-50 text-amber-500' :
                    alert.type === 'success' ? 'bg-emerald-50 text-emerald-500' :
                    'bg-blue-50 text-blue-500'
                  }`}>
                    {alert.type === 'error' || alert.type === 'warning' ? <AlertTriangle size={24} /> :
                     alert.type === 'success' ? <CheckCircle size={24} /> :
                     <Info size={24} />}
                  </div>
                  <div className="flex-1 pt-1">
                    <h3 className="text-lg font-bold text-slate-900 mb-2">
                      {alert.title || (
                        alert.type === 'error' ? 'Erreur' :
                        alert.type === 'warning' ? 'Attention' :
                        alert.type === 'success' ? 'Succès' :
                        'Information'
                      )}
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                      {alert.message}
                    </p>
                  </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                  {alert.isConfirm ? (
                    <>
                      <button
                        onClick={handleClose}
                        className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                      >
                        {alert.cancelText || 'Annuler'}
                      </button>
                      <button
                        onClick={handleConfirm}
                        className={`px-5 py-2.5 rounded-xl font-bold text-white transition-colors ${
                          alert.type === 'error' ? 'bg-red-500 hover:bg-red-600' :
                          alert.type === 'warning' ? 'bg-amber-500 hover:bg-amber-600' :
                          'bg-academic-900 hover:bg-academic-800'
                        }`}
                      >
                        {alert.confirmText || 'Confirmer'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleClose}
                      className="px-5 py-2.5 rounded-xl font-bold text-white bg-academic-900 hover:bg-academic-800 transition-colors"
                    >
                      OK
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (context === undefined) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}
