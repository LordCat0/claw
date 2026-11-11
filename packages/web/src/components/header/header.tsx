import { Show, SignInButton, SignUpButton } from '@clerk/react';
import { Button } from '@base-ui/react/button';
import { Input } from '@base-ui/react/input';
import { Search } from 'lucide-preact';
import Logo from '../logo/logo';
import ProfileMenu from '../profile-menu/profile-menu';
import * as styles from './header.css';

export default function Header() {
  return (
    <header className={styles.header}>
      <a href="/" className={styles.homeLink} aria-label="Claw home">
        <Logo />
      </a>
      <div role="search" className={styles.search}>
        <Search size={20} strokeWidth={1.8} aria-hidden="true" />
        <Input
          type="search"
          name="q"
          aria-label="Search packages"
          placeholder="Search packages"
          className={styles.searchInput}
        />
      </div>
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
