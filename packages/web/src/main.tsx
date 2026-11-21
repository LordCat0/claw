import { ClerkProvider } from '@clerk/react';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createOrUpdateBrowserConditionStore,
  getTranslationsSnapshot,
  GTProvider,
  initializeGTSPA,
  useLocale
} from 'gt-react';
import { render } from 'preact';
import { useEffect } from 'preact/hooks';
import Router, { Route } from 'preact-router';
import gtConfig from '../gt.config.json';
import { env } from './config';
import Home from './pages/home';
import Package from './pages/package';
import Search from './pages/search';
import { theme } from './styles/theme.css';
import './styles/global.css';

await initializeGTSPA({
  ...gtConfig,
  projectId: env.GTProjectId,
  devApiKey: env.GTDevApiKey
});

const locale = createOrUpdateBrowserConditionStore({}).getLocale();
const translations = await getTranslationsSnapshot(locale);

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      console.error('Request failed', query.queryKey, error);
    }
  })
});

function DocumentLanguage() {
  const activeLocale = useLocale();

  useEffect(() => {
    document.documentElement.lang = activeLocale;
  }, [activeLocale]);

  return null;
}

render(
  <GTProvider locale={'es'} translations={translations}>
    <DocumentLanguage />
    <ClerkProvider
      publishableKey={env.clerkPublishableKey}
      appearance={{
        variables: {
          colorPrimary: theme.brand.primary,
          colorPrimaryForeground: '#FFFFFF',
          colorBackground: theme.color.background,
          colorForeground: theme.color.text,
          colorMuted: theme.color.surface,
          colorMutedForeground: theme.color.muted,
          colorNeutral: theme.color.text,
          colorBorder: theme.color.border,
          colorRing: theme.brand.primary,
          fontFamily: 'Arial, Helvetica, sans-serif',
          borderRadius: '0'
        },
        elements: {
          card: {
            border: `1px solid ${theme.color.border}`,
            boxShadow: 'none'
          },
          footer: {
            background: theme.color.surface
          },
          formFieldInput: {
            background: theme.color.surface,
            color: theme.color.text
          },
          formButtonPrimary: {
            fontWeight: 600,
            ':hover': {
              background: theme.brand.secondary
            }
          }
        }
      }}
    >
      <QueryClientProvider client={queryClient}>
        <Router>
          <Route path="/" component={Home} />
          <Route path="/search" component={Search} />
          <Route path="/package/:name" component={Package} />
        </Router>
      </QueryClientProvider>
    </ClerkProvider>
  </GTProvider>,
  document.getElementById('app')!
);
