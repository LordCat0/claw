import { Show, SignInButton, SignUpButton } from '@clerk/react';
import { Button } from '@base-ui/react/button';
import { Input } from '@base-ui/react/input';
import { Search } from 'lucide-preact';
import { route } from 'preact-router';
import Logo from '../logo/logo';
import ProfileMenu from '../profile-menu/profile-menu';
import * as styles from './header.css';

interface HeaderProps {
  query: string;
}

export default function Header(props: HeaderProps) {
  return (
    <header className={styles.header}>
      <a href="/" className={styles.homeLink} aria-label="Claw home">
        <Logo />
      </a>
      <form
        role="search"
        action="/search"
        className={styles.search}
        onSubmit={event => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const params = new URLSearchParams({ q: String(data.get('q')).trim() });
          route(`/search?${params}`);
        }}
      >
        <Button type="submit" className={styles.searchButton} aria-label="Search">
          <Search size={20} strokeWidth={1.8} aria-hidden="true" />
        </Button>
        <Input
          type="search"
          name="q"
          defaultValue={props.query || ''}
          maxLength={64}
          aria-label="Search packages"
          placeholder="Search packages"
          className={styles.searchInput}
        />
      </form>
      <nav aria-label="Account" className={styles.account}>
        <Show when="signed-out">
          <SignInButton mode="modal">
            <Button className={styles.signIn}>Sign in</Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button className={styles.signUp}>Sign up</Button>
          </SignUpButton>
        </Show>
        <Show when="signed-in">
          <ProfileMenu />
        </Show>
      </nav>
    </header>
  );
}
