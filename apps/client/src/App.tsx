import React, { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AppProvider } from './contexts/AppContext';
import { ProjectProvider } from './contexts/ProjectContext';
// Providers
import { QueryProvider } from './providers/QueryProvider';

import { useTheme } from './stores/ui-store';

import { ConfigScreen } from './pages/ConfigScreen';
// Pages
import { LandingPage } from './pages/LandingPage';
import { ProjectView } from './pages/project-view';

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
        <div className="min-h-screen bg-gray-50 dark:bg-graphite-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-graphite-900 rounded-lg shadow-lg p-6 text-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-graphite-25 mb-4">
              Something went wrong
            </h2>
            <p className="text-gray-600 dark:text-graphite-400 mb-4">
              The application encountered an unexpected error.
            </p>
            <details className="text-left mb-4">
              <summary className="cursor-pointer text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mb-2">
                Error Details
              </summary>
              <pre className="text-xs bg-gray-100 dark:bg-graphite-800 p-3 rounded overflow-auto">
                {this.state.error?.stack}
              </pre>
            </details>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors dark:bg-blue-500 dark:hover:bg-blue-400"
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

// Main App component with all providers
function App() {
  const { isDark } = useTheme();

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toastTheme = isDark ? 'dark' : 'light';

  return (
    <ErrorBoundary>
      <QueryProvider>
        <AppProvider>
          <ProjectProvider>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/project/:projectId" element={<ProjectView />} />
            </Routes>
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
              theme={toastTheme}
            />
          </ProjectProvider>
        </AppProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}

export default App;
