import Header from '../components/header/header';
import Logo from '../components/logo/logo';
import * as styles from './home.css';

export default function Home() {
  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main} aria-label="Claw">
        <div className={styles.logo}>
          <Logo />
        </div>
      </main>
    </div>
  );
}
