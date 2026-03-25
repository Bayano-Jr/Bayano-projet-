import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, FileText, AlertTriangle, Scale, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="terms-modal" 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        >
          <div
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl z-50 flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-academic-900/10 flex items-center justify-center text-academic-900">
                  <Scale size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-serif font-bold text-academic-900">{t('terms.title')}</h2>
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">{t('terms.lastUpdated')}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-white">
              <section>
                <h3 className="flex items-center gap-2 text-lg font-bold text-academic-900 mb-3">
                  <FileText size={18} className="text-accent" />
                  {t('terms.sections.acceptance.title')}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {t('terms.sections.acceptance.content')}
                </p>
              </section>

              <section>
                <h3 className="flex items-center gap-2 text-lg font-bold text-academic-900 mb-3">
                  <Shield size={18} className="text-accent" />
                  {t('terms.sections.description.title')}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {t('terms.sections.description.content')}
                </p>
              </section>

              <section className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <h3 className="flex items-center gap-2 text-lg font-bold text-amber-900 mb-3">
                  <AlertTriangle size={18} className="text-amber-600" />
                  {t('terms.sections.academicResponsibility.title')}
                </h3>
                <div className="space-y-3 text-sm text-amber-800 leading-relaxed">
                  <p>{t('terms.sections.academicResponsibility.content1')}</p>
                  <p className="font-medium">{t('terms.sections.academicResponsibility.content2')}</p>
                  <ul className="list-disc pl-5 space-y-1 mt-2 text-amber-900/80">
                    <li>{t('terms.sections.academicResponsibility.point1')}</li>
                    <li>{t('terms.sections.academicResponsibility.point2')}</li>
                    <li>{t('terms.sections.academicResponsibility.point3')}</li>
                  </ul>
                </div>
              </section>

              <section>
                <h3 className="flex items-center gap-2 text-lg font-bold text-academic-900 mb-3">
                  <CheckCircle2 size={18} className="text-accent" />
                  {t('terms.sections.acceptableUse.title')}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-3">
                  {t('terms.sections.acceptableUse.content')}
                </p>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0"></div>
                    <span>{t('terms.sections.acceptableUse.rule1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0"></div>
                    <span>{t('terms.sections.acceptableUse.rule2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0"></div>
                    <span>{t('terms.sections.acceptableUse.rule3')}</span>
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="flex items-center gap-2 text-lg font-bold text-academic-900 mb-3">
                  <Scale size={18} className="text-accent" />
                  {t('terms.sections.limitation.title')}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {t('terms.sections.limitation.content')}
                </p>
              </section>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 shrink-0 flex justify-end">
              <button
                onClick={onClose}
                className="btn-primary"
              >
                {t('terms.close')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TermsModal;
