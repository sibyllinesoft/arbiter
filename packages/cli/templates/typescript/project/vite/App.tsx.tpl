import { BrowserRouter } from 'react-router-dom';
import { Suspense } from 'react';
import { routes } from './routes';
import { AppRoutes } from './routes/AppRoutes';
import './App.css';

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div>Loading...</div>}>
        <AppRoutes routes={routes} />
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
