import { ClerkProvider } from '@clerk/react';
import { render } from 'preact';
import Router, { Route } from 'preact-router';
import Home from './pages/home';
import './styles/global.css';

render(
  <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
    <Router>
      <Route path="/" component={Home} />
    </Router>
  </ClerkProvider>,
  document.getElementById('app')!
);
