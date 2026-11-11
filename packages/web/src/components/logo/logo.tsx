import claw from './claw.svg';
import * as styles from './logo.css';

export default function Logo() {
  return <img className={styles.logo} src={claw} alt="Claw" width="65" height="54" />;
}
