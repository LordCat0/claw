import claw from 'shared/assets/claw.svg';
import * as styles from './logo.css';

export default function Logo() {
  return (
    <img
      className={styles.logo}
      src={claw}
      alt="Claw"
      width="62"
      height="49"
    />
  );
}
