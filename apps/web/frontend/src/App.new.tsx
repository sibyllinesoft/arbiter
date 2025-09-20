import React, { useState } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Providers
import { QueryProvider } from './providers/QueryProvider';
import { ProjectProvider } from './contexts/ProjectContext';
import { AppProvider } from './contexts/AppContext';

// Pages
import { LandingPage } from './pages/LandingPage';
import { ConfigScreen } from './pages/ConfigScreen';

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Something went wrong</h2>
            <p className="text-gray-600 mb-4">The application encountered an unexpected error.</p>
            <details className="text-left mb-4">
              <summary className="cursor-pointer text-blue-600 hover:text-blue-700 mb-2">
                Error Details
              </summary>
              <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto">
                {this.state.error?.stack}
              </pre>
            </details>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Main app content with simple routing
function AppContent() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'config'>('dashboard');

  const navigateToConfig = () => setCurrentView('config');
  const navigateToDashboard = () => setCurrentView('dashboard');

  return (
    <>
      {currentView === 'dashboard' && <LandingPage onNavigateToConfig={navigateToConfig} />}
      {currentView === 'config' && <ConfigScreen onNavigateBack={navigateToDashboard} />}
    </>
  );
}

// Main App component with all providers
function App() {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <AppProvider>
          <ProjectProvider>
            <AppContent />
            <ToastContainer
              position="top-right"
              autoClose={3000}
              hideProgressBar={false}
              newestOnTop
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="light"
            />
          </ProjectProvider>
        </AppProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}

export default App;
