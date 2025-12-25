import React, { useState, useEffect, useCallback } from 'react';
import { WorkflowStep, WORKFLOW_STEPS, AppState, InternalLink } from './types';
import Setup from './components/Setup';
import TopicIdeation from './components/IdeaLab';
import ResearchAndOutline from './components/ContentRepurposer';
import ArticleDrafting from './components/DraftingStudio';
import Publish from './components/AudioPublisher';
import IntroScreen from './components/IntroScreen';
import Login from './components/Login';
import { saveProjectToDb } from './services/webhook';

// Icons
const IconMenu = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>;
const IconX = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const IconGlobe = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9V3m0 18a9 9 0 009-9m-9 9a9 9 0 00-9-9" /></svg>;
const IconLightBulb = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 017.072 0m-11.314 0a5 5 0 007.072 0M12 21v-1m-4.657-3.343l.707-.707" /></svg>;
const IconSearch = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
const IconPencil = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const IconUpload = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>;
const IconChevronLeft = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-5 w-5"} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>;
const IconChevronRight = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-5 w-5"} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>;
const IconRefresh = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2H15" /></svg>;
const IconCloudSync = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-5 w-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>;
const IconTrash = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;

const LogoIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="logo-gradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#6366f1" />
        <stop offset="100%" stopColor="#8b5cf6" />
      </linearGradient>
    </defs>
    <rect x="4" y="4" width="32" height="32" rx="10" fill="url(#logo-gradient)" />
    <path d="M11 26L17 20L21 24L29 14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M29 14V19" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.5" />
    <path d="M29 14H24" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.5" />
    <circle cx="11" cy="26" r="1.5" fill="white" />
    <circle cx="17" cy="20" r="1.5" fill="white" />
    <circle cx="21" cy="24" r="1.5" fill="white" />
    <circle cx="29" cy="14" r="2" fill="white" />
  </svg>
);

const STEP_COMPONENTS: Record<WorkflowStep, React.ComponentType<any>> = {
  'Setup': Setup,
  'Topic Ideation': TopicIdeation,
  'Research & Outline': ResearchAndOutline,
  'Drafting': ArticleDrafting,
  'Publish': Publish,
};

const STEP_ICONS: Record<WorkflowStep, React.ReactNode> = {
  'Setup': <IconGlobe />,
  'Topic Ideation': <IconLightBulb />,
  'Research & Outline': <IconSearch />,
  'Drafting': <IconPencil />,
  'Publish': <IconUpload />,
};

const DEFAULT_STATE: AppState = { 
  websiteUrl: '', 
  country: '', 
  language: '', 
  topic: '', 
  outline: [], 
  draft: '', 
  imageUrl: '', 
  internalLinks: [] 
};

const getInitialState = (): AppState => {
  try {
    const saved = localStorage.getItem('rankensteinAppState');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Sanitizer: Deep merge with defaults to ensure critical array properties are never null
      return { 
        ...DEFAULT_STATE, 
        ...parsed,
        outline: Array.isArray(parsed.outline) ? parsed.outline : [],
        internalLinks: Array.isArray(parsed.internalLinks) ? parsed.internalLinks : []
      };
    }
  } catch (error) {
    console.error("Failed to parse state", error);
    localStorage.removeItem('rankensteinAppState');
  }
  return DEFAULT_STATE;
};

const getInitialProgress = (initialState: AppState) => {
    if (initialState.draft) return { index: 3, step: 'Publish' as WorkflowStep };
    // Safety: use optional chaining on length
    if (initialState.outline && (initialState.outline?.length ?? 0) > 0) return { index: 2, step: 'Drafting' as WorkflowStep };
    if (initialState.topic) return { index: 1, step: 'Research & Outline' as WorkflowStep };
    if (initialState.websiteUrl) return { index: 0, step: 'Topic Ideation' as WorkflowStep };
    return { index: -1, step: 'Setup' as WorkflowStep };
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(getInitialState);
  const [showIntro, setShowIntro] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
      return sessionStorage.getItem('quantum_auth') === 'true';
  });
  
  const initialProgress = getInitialProgress(appState);
  const [activeStep, setActiveStep] = useState<WorkflowStep>(initialProgress.step);
  const [highestCompletedStepIndex, setHighestCompletedStepIndex] = useState(initialProgress.index);
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  useEffect(() => {
    try {
      const stateToSave = { ...appState };
      if (stateToSave.imageUrl && stateToSave.imageUrl.startsWith('data:')) stateToSave.imageUrl = ''; 
      localStorage.setItem('rankensteinAppState', JSON.stringify(stateToSave));
    } catch (error) { console.error(error); }
  }, [appState]);

  const triggerCloudSync = useCallback(async (state: AppState) => {
    setIsSyncing(true);
    try {
        const result = await saveProjectToDb(state);
        if (result && result.projectId) setAppState(prev => ({ ...prev, projectId: result.projectId }));
        setLastSynced(new Date());
    } catch (error) { console.error("Cloud Sync Failed", error); } 
    finally { setIsSyncing(false); }
  }, []);

  const goToStep = (stepIndex: number) => {
    if (stepIndex <= highestCompletedStepIndex + 1) {
      setActiveStep(WORKFLOW_STEPS[stepIndex]);
      setIsMobileMenuOpen(false);
    }
  };

  const handleSetupComplete = (websiteUrl: string, country: string, language: string) => {
    const newState: AppState = { ...appState, websiteUrl, country, language, topic: '', outline: [], draft: '', imageUrl: '', internalLinks: [] };
    setAppState(newState);
    setHighestCompletedStepIndex(0);
    setActiveStep('Topic Ideation');
    triggerCloudSync(newState);
  };

  const handleTopicSelect = (topic: string) => {
    const newState: AppState = { ...appState, topic, outline: [], draft: '', imageUrl: '', internalLinks: [] };
    setAppState(newState);
    setHighestCompletedStepIndex(1);
    setActiveStep('Research & Outline');
    triggerCloudSync(newState);
  };

  const handleOutlineComplete = (outline: string[], internalLinks: InternalLink[]) => {
    const newState: AppState = { ...appState, outline, internalLinks, draft: '', imageUrl: '' };
    setAppState(newState);
    setHighestCompletedStepIndex(2);
    setActiveStep('Drafting');
    triggerCloudSync(newState);
  };

  const handleDraftComplete = (draft: string) => {
    const newState: AppState = { ...appState, draft };
    setAppState(newState);
    setHighestCompletedStepIndex(3);
    setActiveStep('Publish');
    triggerCloudSync(newState);
  };
  
  const handleImageGenerated = (imageUrl: string) => {
    const newState: AppState = { ...appState, imageUrl };
    setAppState(newState);
    triggerCloudSync({ ...newState, imageUrl: '[GENERATED]' });
  };

  const handleRestart = () => {
    if (window.confirm("Start over? Progress on the current project will be lost.")) {
      setAppState(DEFAULT_STATE);
      setHighestCompletedStepIndex(-1);
      setActiveStep('Setup');
      localStorage.removeItem('rankensteinAppState');
    }
  };

  const handleHardReset = () => {
    if (window.confirm("WARNING: This will clear ALL cache, including your login session and project state. You will be logged out. Continue?")) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  const handleLoginSuccess = () => {
      sessionStorage.setItem('quantum_auth', 'true');
      setIsAuthenticated(true);
  };
  
  if (showIntro) return <IntroScreen onStart={() => setShowIntro(false)} />;
  
  if (!isAuthenticated) return <Login onLoginSuccess={handleLoginSuccess} />;

  const ActiveComponent = STEP_COMPONENTS[activeStep];
  const componentProps = {
    appState,
    onSetupComplete: handleSetupComplete,
    onTopicSelect: handleTopicSelect,
    onOutlineComplete: handleOutlineComplete,
    onDraftComplete: handleDraftComplete,
    onImageGenerated: handleImageGenerated,
    onRestart: handleRestart,
  };

  return (
    <div className="flex h-screen bg-[#0f1117] font-sans text-slate-200 overflow-hidden animate-fade-in selection:bg-indigo-500/30">
      {isMobileMenuOpen && (
        <div onClick={() => setIsMobileMenuOpen(false)} className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden" />
      )}
      
      <nav className={`
        fixed inset-y-0 left-0 z-50 bg-[#090a0e] border-r border-white/5 flex flex-col h-full transition-all duration-300
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static
        ${isSidebarCollapsed ? 'md:w-20' : 'md:w-72'}
        w-72
      `}>
        <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="absolute -right-3 top-1/2 -translate-y-1/2 z-50 hidden md:flex w-6 h-6 bg-[#090a0e] border border-white/10 rounded-full text-slate-400 hover:text-white transition-all shadow-lg items-center justify-center">
            {isSidebarCollapsed ? <IconChevronRight className="w-3 h-3" /> : <IconChevronLeft className="w-3 h-3" />}
        </button>

        <div className={`flex items-center h-20 px-5 border-b border-white/5 ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className={`flex items-center transition-all ${isSidebarCollapsed ? 'justify-center w-full' : ''}`}>
               <LogoIcon className="h-9 w-9" />
            {!isSidebarCollapsed && (
              <div className="ml-3 flex flex-col animate-fade-in">
                 <h1 className="text-xl font-bold text-slate-100 leading-none">Quantum SEO</h1>
                 <div className="flex items-center gap-2 mt-1">
                   <span className="text-[10px] text-indigo-400 font-medium uppercase">Content Engine</span>
                   <span className="text-[9px] text-slate-500 font-mono">v1.2.9</span>
                 </div>
              </div>
            )}
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 p-1"><IconX /></button>
        </div>

        <div className="flex-1 py-6 px-3 overflow-y-auto">
          <div className="space-y-1.5">
            {WORKFLOW_STEPS.map((step, index) => {
              const isActive = activeStep === step;
              const isEnabled = index <= highestCompletedStepIndex + 1;
              return (
                <button
                  key={step}
                  onClick={() => goToStep(index)}
                  disabled={!isEnabled}
                  className={`
                    flex items-center w-full p-3 rounded-full transition-all group relative
                    ${isActive ? 'bg-indigo-500/10 text-indigo-300 font-semibold' : isEnabled ? 'text-slate-300 hover:bg-white/5' : 'text-slate-500 cursor-not-allowed opacity-60'}
                    ${isSidebarCollapsed ? 'justify-center' : ''}
                  `}
                >
                  <span className="flex-shrink-0">{STEP_ICONS[step]}</span>
                  {!isSidebarCollapsed && <span className="ml-3.5 text-sm whitespace-nowrap">{step}</span>}
                </button>
              );
            })}
          </div>
        </div>
        
        <div className="p-4 border-t border-white/5 bg-slate-900/30">
            <div className={`flex flex-col ${isSidebarCollapsed ? 'items-center' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                    <IconCloudSync className={`h-4 w-4 ${isSyncing ? 'text-indigo-400 animate-pulse' : 'text-emerald-500/70'}`} />
                    {!isSidebarCollapsed && <span className="text-[10px] font-bold text-slate-500 uppercase">Cloud Sync</span>}
                </div>
                {!isSidebarCollapsed && lastSynced && <span className="text-[9px] text-slate-600">Saved at {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
            </div>
        </div>

        <div className="p-4 border-t border-white/5 flex flex-col gap-1">
             <button onClick={handleRestart} className={`flex items-center w-full p-3 text-sm text-slate-300 rounded-full hover:bg-white/5 hover:text-indigo-400 transition-colors ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                <IconRefresh /><span className={isSidebarCollapsed ? 'hidden' : 'ml-3'}>Restart Project</span>
            </button>
             <button onClick={handleHardReset} className={`flex items-center w-full p-3 text-sm text-slate-400 rounded-full hover:bg-red-500/10 hover:text-red-400 transition-colors ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                <IconTrash /><span className={isSidebarCollapsed ? 'hidden' : 'ml-3'}>Hard Reset (Clear Cache)</span>
            </button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="md:hidden flex items-center justify-between p-4 bg-[#090a0e] border-b border-white/5 sticky top-0 z-30">
             <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -ml-2 text-slate-300"><IconMenu /></button>
             <div className="flex items-center gap-2"><LogoIcon className="h-6 w-6" /><span className="font-bold">Quantum SEO</span></div>
        </div>
        <div className="flex-grow p-4 md:p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto h-full"><ActiveComponent {...componentProps} /></div>
        </div>
      </main>
    </div>
  );
};

export default App;