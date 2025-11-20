import React, { createContext, useContext, useMemo, useReducer } from "react";

export interface ValidationIssue {
  message: string;
  line?: number;
  column?: number;
}

interface ValidationState {
  isValidating: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  specHash: string | null;
  lastValidation: string | null;
}

type ValidationAction =
  | { type: "SET_VALIDATION_STATE"; payload: Partial<ValidationState> }
  | { type: "RESET" };

const initialState: ValidationState = {
  isValidating: false,
  errors: [],
  warnings: [],
  specHash: null,
  lastValidation: null,
};

function validationReducer(state: ValidationState, action: ValidationAction): ValidationState {
  switch (action.type) {
    case "SET_VALIDATION_STATE":
      return { ...state, ...action.payload };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

interface ValidationContextValue {
  state: ValidationState;
  setValidationState: (payload: Partial<ValidationState>) => void;
  resetValidation: () => void;
}

const ValidationContext = createContext<ValidationContextValue | undefined>(undefined);

export function ValidationProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(validationReducer, initialState);

  const value = useMemo<ValidationContextValue>(
    () => ({
      state,
      setValidationState: (payload) => dispatch({ type: "SET_VALIDATION_STATE", payload }),
      resetValidation: () => dispatch({ type: "RESET" }),
    }),
    [state],
  );

  return <ValidationContext.Provider value={value}>{children}</ValidationContext.Provider>;
}

export function useValidationState() {
  const context = useContext(ValidationContext);
  if (!context) throw new Error("useValidationState must be used within ValidationProvider");
  return context.state;
}

export function useValidationActions() {
  const context = useContext(ValidationContext);
  if (!context) throw new Error("useValidationActions must be used within ValidationProvider");
  return {
    setValidationState: context.setValidationState,
    resetValidation: context.resetValidation,
  };
}
