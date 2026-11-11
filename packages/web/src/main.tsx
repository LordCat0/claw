import { ClerkProvider } from '@clerk/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from 'preact';
import Router, { Route } from 'preact-router';
import { env } from './config';
import Home from './pages/home';
import Search from './pages/search';
import './styles/global.css';

const queryClient = new QueryClient();

render(
  <ClerkProvider publishableKey={env.clerkPublishableKey}>
    <QueryClientProvider client={queryClient}>
      <Router>
        <Route path="/" component={Home} />
        <Route path="/search" component={Search} />
      </Router>
    </QueryClientProvider>
  </ClerkProvider>,
  document.getElementById('app')!
);
