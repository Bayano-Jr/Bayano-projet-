import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, BookOpen, FileText, Table, Quote, List, CheckCircle2, Lightbulb, Cpu, HelpCircle, Plus, Bot, Download, AlertTriangle, PenTool, LayoutTemplate, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AcademicGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

const AcademicGuide: React.FC<AcademicGuideProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('philosophy');

  const tabs = [
    { id: 'philosophy', label: t('academicGuide.tabs.philosophy'), icon: HelpCircle },
    { id: 'general', label: t('academicGuide.tabs.general'), icon: FileText },
    { id: 'methodology', label: t('academicGuide.tabs.methodology'), icon: Lightbulb },
    { id: 'appUsage', label: t('academicGuide.tabs.appUsage'), icon: Cpu },
    { id: 'citations', label: t('academicGuide.tabs.citations'), icon: Quote },
    { id: 'tables', label: t('academicGuide.tabs.tables'), icon: Table },
    { id: 'structure', label: t('academicGuide.tabs.structure'), icon: List },
  ];

  const MockScreenshot = ({ icon: Icon, title, children }: { icon: any, title: string, children: React.ReactNode }) => (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 mt-3 mb-5 shadow-sm">
      <div className="bg-slate-200/50 px-3 py-2 flex items-center gap-2 border-b border-slate-200">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
        </div>
        <span className="text-xs font-medium text-slate-500 ml-2 flex items-center gap-1.5"><Icon size={12}/> {title}</span>
      </div>
      <div className="p-4 bg-white">
        {children}
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="academic-guide" 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50"
        >
          <div
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200"
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-serif font-bold text-academic-900">{t('academicGuide.title')}</h2>
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">{t('academicGuide.subtitle')}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex border-b border-slate-100 overflow-x-auto hide-scrollbar">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? 'border-accent text-accent'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <tab.icon size={16} />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
              {activeTab === 'philosophy' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                        <Bot size={20} />
                      </div>
                      <h3 className="font-serif font-bold text-academic-900 text-xl">{t('academicGuide.philosophy.title')}</h3>
                    </div>
                    <p className="text-slate-600 text-[15px] leading-relaxed mb-6">
                      {t('academicGuide.philosophy.desc')}
                    </p>
                    
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex gap-3">
                      <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                      <p className="text-sm text-amber-800 font-medium">
                        {t('academicGuide.philosophy.warning')}
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 mt-0.5">
                          <CheckCircle2 size={14} />
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed">{t('academicGuide.philosophy.role1')}</p>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 mt-0.5">
                          <PenTool size={14} />
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed">{t('academicGuide.philosophy.role2')}</p>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 mt-0.5">
                          <FileText size={14} />
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed">{t('academicGuide.philosophy.role3')}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'general' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-serif font-bold text-academic-900 text-lg mb-3">{t('academicGuide.general.title')}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed mb-4">
                      {t('academicGuide.general.desc')}
                    </p>
                    <ul className="space-y-2 text-sm text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                        <span>{t('academicGuide.general.point1')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                        <span>{t('academicGuide.general.point2')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                        <span>{t('academicGuide.general.point3')}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === 'methodology' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-serif font-bold text-academic-900 text-lg mb-3">{t('academicGuide.methodology.title')}</h3>
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-bold text-academic-900 mb-1">{t('academicGuide.methodology.step1Title')}</h4>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {t('academicGuide.methodology.step1Desc')}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-academic-900 mb-1">{t('academicGuide.methodology.step2Title')}</h4>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {t('academicGuide.methodology.step2Desc')}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-academic-900 mb-1">{t('academicGuide.methodology.step3Title')}</h4>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {t('academicGuide.methodology.step3Desc')}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-academic-900 mb-1">{t('academicGuide.methodology.step4Title')}</h4>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {t('academicGuide.methodology.step4Desc')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'appUsage' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-serif font-bold text-academic-900 text-xl mb-2">{t('academicGuide.appUsage.title')}</h3>
                    <p className="text-slate-600 text-[15px] mb-6">{t('academicGuide.appUsage.intro')}</p>
                    
                    <div className="space-y-10">
                      {/* Step 1 */}
                      <div>
                        <div className="flex gap-3 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                            <Plus size={16} />
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-academic-900">{t('academicGuide.appUsage.step1Title')}</h4>
                            <p className="text-sm text-slate-600 mt-1">{t('academicGuide.appUsage.step1Desc')}</p>
                          </div>
                        </div>
                        <MockScreenshot icon={LayoutTemplate} title={t('academicGuide.appUsage.step1ImgAlt')}>
                          <div className="space-y-3">
                            <div className="h-4 w-1/3 bg-slate-100 rounded"></div>
                            <div className="h-10 w-full bg-slate-50 border border-slate-200 rounded-lg"></div>
                            <div className="h-4 w-1/4 bg-slate-100 rounded mt-4"></div>
                            <div className="h-20 w-full bg-slate-50 border border-slate-200 rounded-lg"></div>
                            <div className="flex justify-end mt-2">
                              <div className="h-8 w-24 bg-academic-900 rounded-lg"></div>
                            </div>
                          </div>
                        </MockScreenshot>
                      </div>

                      {/* Step 2 */}
                      <div>
                        <div className="flex gap-3 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                            <List size={16} />
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-academic-900">{t('academicGuide.appUsage.step2Title')}</h4>
                            <p className="text-sm text-slate-600 mt-1">{t('academicGuide.appUsage.step2Desc')}</p>
                          </div>
                        </div>
                        <MockScreenshot icon={List} title={t('academicGuide.appUsage.step2ImgAlt')}>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg bg-white shadow-sm">
                              <div className="w-4 h-4 bg-slate-200 rounded"></div>
                              <div className="h-4 w-1/2 bg-slate-100 rounded"></div>
                            </div>
                            <div className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg bg-white shadow-sm ml-6">
                              <div className="w-4 h-4 bg-slate-200 rounded"></div>
                              <div className="h-4 w-2/3 bg-slate-100 rounded"></div>
                            </div>
                            <div className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg bg-white shadow-sm">
                              <div className="w-4 h-4 bg-slate-200 rounded"></div>
                              <div className="h-4 w-1/3 bg-slate-100 rounded"></div>
                            </div>
                          </div>
                        </MockScreenshot>
                      </div>

                      {/* Step 3 */}
                      <div>
                        <div className="flex gap-3 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                            <Bot size={16} />
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-academic-900">{t('academicGuide.appUsage.step3Title')}</h4>
                            <p className="text-sm text-slate-600 mt-1">{t('academicGuide.appUsage.step3Desc')}</p>
                          </div>
                        </div>
                        <MockScreenshot icon={MessageSquare} title={t('academicGuide.appUsage.step3ImgAlt')}>
                          <div className="flex gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="h-3 w-full bg-slate-100 rounded"></div>
                              <div className="h-3 w-full bg-slate-100 rounded"></div>
                              <div className="h-3 w-4/5 bg-slate-100 rounded"></div>
                            </div>
                            <div className="w-1/3 border-l border-slate-100 pl-4 space-y-3">
                              <div className="h-6 w-3/4 bg-purple-50 rounded-lg ml-auto"></div>
                              <div className="h-12 w-5/6 bg-slate-100 rounded-lg"></div>
                            </div>
                          </div>
                        </MockScreenshot>
                      </div>

                      {/* Step 4 */}
                      <div>
                        <div className="flex gap-3 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                            <Download size={16} />
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-academic-900">{t('academicGuide.appUsage.step4Title')}</h4>
                            <p className="text-sm text-slate-600 mt-1">{t('academicGuide.appUsage.step4Desc')}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'citations' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-serif font-bold text-academic-900 text-lg mb-3">{t('academicGuide.citations.title')}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed mb-4">
                      {t('academicGuide.citations.desc1')}
                    </p>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{t('academicGuide.citations.formatTitle')}</h4>
                      <code className="text-xs text-accent bg-accent/10 px-2 py-1 rounded block mb-2">
                        Selon Bourdieu[^1], la reproduction sociale...
                      </code>
                      <code className="text-xs text-slate-600 bg-white border border-slate-200 px-2 py-1 rounded block">
                        [^1]: Bourdieu, P. (1970). La Reproduction. Éditions de Minuit.
                      </code>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      {t('academicGuide.citations.desc2')}
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'tables' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-serif font-bold text-academic-900 text-lg mb-3">{t('academicGuide.tables.title')}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed mb-4">
                      {t('academicGuide.tables.desc1')}
                    </p>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{t('academicGuide.tables.formatTitle')}</h4>
                      <pre className="text-xs text-slate-600 bg-white border border-slate-200 p-3 rounded overflow-x-auto">
{`| Variable | Effectif | Pourcentage |
| :--- | :---: | :---: |
| Hommes | 45 | 45% |
| Femmes | 55 | 55% |
| **Total** | **100** | **100%** |`}
                      </pre>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      {t('academicGuide.tables.desc2')}
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'structure' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-serif font-bold text-academic-900 text-lg mb-3">{t('academicGuide.structure.title')}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed mb-4">
                      {t('academicGuide.structure.desc')}
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">1</div>
                        <div>
                          <h4 className="text-sm font-bold text-academic-900">{t('academicGuide.structure.step1Title')}</h4>
                          <p className="text-xs text-slate-500">{t('academicGuide.structure.step1Desc')}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">2</div>
                        <div>
                          <h4 className="text-sm font-bold text-academic-900">{t('academicGuide.structure.step2Title')}</h4>
                          <p className="text-xs text-slate-500">{t('academicGuide.structure.step2Desc')}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">3</div>
                        <div>
                          <h4 className="text-sm font-bold text-academic-900">{t('academicGuide.structure.step3Title')}</h4>
                          <p className="text-xs text-slate-500">{t('academicGuide.structure.step3Desc')}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">4</div>
                        <div>
                          <h4 className="text-sm font-bold text-academic-900">{t('academicGuide.structure.step4Title')}</h4>
                          <p className="text-xs text-slate-500">{t('academicGuide.structure.step4Desc')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-white">
              <button 
                onClick={onClose}
                className="w-full py-3 bg-academic-900 text-white rounded-xl font-medium hover:bg-academic-800 transition-colors"
              >
                {t('academicGuide.gotIt')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AcademicGuide;
