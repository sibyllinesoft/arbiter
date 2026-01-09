import React, { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { ToastContainer, type ToastContainerProps } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { clsx } from "clsx";

/** Storage keys for error recovery */
const STORAGE_KEYS = {
  currentProject: "arbiter:currentProject",
  editorState: "arbiter:editorState",
} as const;

/** Error boundary SVG icon path */
const ERROR_ICON_PATH =
  "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z";

/** Toast container base configuration */
const TOAST_CONFIG: Partial<ToastContainerProps> = {
  position: "bottom-right",
  autoClose: 2000,
  hideProgressBar: false,
  newestOnTop: true,
  closeOnClick: true,
  rtl: false,
  pauseOnFocusLoss: false,
  draggable: false,
  pauseOnHover: false,
  limit: 5,
} as const;

/** Check if error is related to CUE/spec parsing */
const checkIsParsingError = (error: Error | null): boolean =>
  Boolean(
    error?.message?.includes("CUE") ||
      error?.message?.includes("spec") ||
      error?.message?.includes("parse"),
  );

import { AppProvider } from "./contexts/AppContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ProjectProvider } from "./contexts/ProjectContext";
import { WebSocketProvider } from "./contexts/WebSocketContext";
// Providers
import { QueryProvider } from "./providers/QueryProvider";

import { useTheme } from "./stores/ui-store";

import { AuthGate } from "./components/core/AuthGate";
import { ConfigScreen } from "./pages/ConfigScreen";
// Pages
import { LandingPage } from "./pages/LandingPage";
import { OAuthCallback } from "./pages/OAuthCallback";
import { ProjectView } from "./pages/project-view";

// Error boundary component
export class ErrorBoundary extends React.Component<
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
    console.error("Error boundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.currentProject);
      localStorage.removeItem(STORAGE_KEYS.editorState);
    } catch (e) {
      console.error("Failed to clear localStorage:", e);
    }

    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      const hasParsingError = checkIsParsingError(this.state.error);

      return (
        <div className="min-h-screen bg-gray-50 dark:bg-graphite-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-graphite-900 rounded-lg shadow-lg p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={ERROR_ICON_PATH}
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-graphite-25 mb-2">
                {hasParsingError ? "Specification Error" : "Something went wrong"}
              </h2>
              <p className="text-gray-600 dark:text-graphite-400 mb-4">
                {hasParsingError
                  ? "The application encountered an error parsing your CUE specification."
                  : "The application encountered an unexpected error."}
              </p>
            </div>

            <details className="text-left mb-6 bg-gray-50 dark:bg-graphite-800 rounded-lg p-4">
              <summary className="cursor-pointer text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mb-2 font-medium">
                Error Details
              </summary>
              <pre className="text-xs bg-gray-100 dark:bg-graphite-800 p-3 rounded overflow-auto max-h-40 mt-2">
                {this.state.error?.stack}
              </pre>
            </details>

            {hasParsingError && (
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-left">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  Troubleshooting Tips:
                </h3>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                  <li>Check your CUE syntax for errors</li>
                  <li>Verify all field types match their constraints</li>
                  <li>
                    Run <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">cue vet</code>{" "}
                    on your specification locally
                  </li>
                </ul>
              </div>
            )}

            <div className="flex gap-3">
              <button
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors dark:bg-blue-500 dark:hover:bg-blue-400 font-medium"
                onClick={() => window.location.reload()}
              >
                Reload Page
              </button>
              <button
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors dark:bg-red-500 dark:hover:bg-red-400 font-medium"
                onClick={this.handleReset}
                title="Clear local state and return to home"
              >
                Reset Project
              </button>
            </div>

            <p className="mt-4 text-xs text-gray-500 dark:text-graphite-500 text-center">
              If the problem persists, try clearing your browser cache or contact support.
            </p>
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
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }
  }, [isDark]);

  return (
    <ErrorBoundary>
      <QueryProvider>
        <AuthProvider>
          <AppProvider>
            <ProjectProvider>
              <WebSocketProvider>
                <Routes>
                  <Route
                    path="/"
                    element={
                      <AuthGate>
                        <LandingPage />
                      </AuthGate>
                    }
                  />
                  <Route
                    path="/project/:projectId"
                    element={
                      <AuthGate>
                        <ProjectView />
                      </AuthGate>
                    }
                  />
                  <Route path="/oauth/callback" element={<OAuthCallback />} />
                </Routes>
                <ToastContainer
                  {...TOAST_CONFIG}
                  theme={isDark ? "dark" : "light"}
                  toastClassName={(context) =>
                    clsx(
                      context?.defaultClassName,
                      "graphite-toast",
                      isDark ? "graphite-toast-dark" : "graphite-toast-light",
                    )
                  }
                  bodyClassName={(context) =>
                    clsx(
                      context?.defaultClassName,
                      "graphite-toast-body",
                      isDark ? "graphite-toast-body-dark" : "graphite-toast-body-light",
                    )
                  }
                  progressClassName={(context) =>
                    clsx(
                      context?.defaultClassName,
                      isDark ? "graphite-toast-progress-dark" : "graphite-toast-progress-light",
                    )
                  }
                />
              </WebSocketProvider>
            </ProjectProvider>
          </AppProvider>
        </AuthProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}

export default App;
