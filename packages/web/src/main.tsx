import { ClerkProvider } from '@clerk/react';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from 'preact';
import Router, { Route } from 'preact-router';
import { env } from './config';
import Home from './pages/home';
import Package from './pages/package';
import Search from './pages/search';
import './styles/global.css';

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      console.error('Request failed', query.queryKey, error);
    }
  })
});

render(
  <ClerkProvider publishableKey={env.clerkPublishableKey}>
    <QueryClientProvider client={queryClient}>
      <Router>
        <Route path="/" component={Home} />
        <Route path="/search" component={Search} />
        <Route path="/package/:name" component={Package} />
      </Router>
    </QueryClientProvider>
  </ClerkProvider>,
  document.getElementById('app')!
);
