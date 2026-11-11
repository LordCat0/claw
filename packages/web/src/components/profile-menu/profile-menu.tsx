import { useClerk, useUser } from '@clerk/react';
import { Avatar } from '@base-ui/react/avatar';
import { Menu } from '@base-ui/react/menu';
import { ChevronDown, LogOut, Settings } from 'lucide-preact';
import * as styles from './profile-menu.css';

export default function ProfileMenu() {
  const { user } = useUser();
  const { openUserProfile, signOut } = useClerk();

  if (!user) {
    return null;
  }

  const name = user.fullName || user.username || 'Account';

  return (
    <Menu.Root modal={false}>
      <Menu.Trigger className={styles.trigger} aria-label="Account menu">
        <Avatar.Root className={styles.avatar} aria-hidden="true">
          <Avatar.Image className={styles.avatarImage} src={user.imageUrl} />
          <Avatar.Fallback>{name.slice(0, 1).toUpperCase()}</Avatar.Fallback>
        </Avatar.Root>
        <span className={styles.name}>{name}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          className={styles.positioner}
          align="end"
          sideOffset={8}
          collisionPadding={16}
        >
          <Menu.Popup className={styles.content}>
            <div className={styles.identity}>
              <span className={styles.name}>{name}</span>
              <span className={styles.email}>{user.primaryEmailAddress?.emailAddress}</span>
            </div>
            <Menu.Separator className={styles.separator} />
            <Menu.Item
              className={styles.item}
              onClick={() => openUserProfile()}
            >
              <Settings size={16} aria-hidden="true" />
              Account settings
            </Menu.Item>
            <Menu.Item
              className={styles.item}
              onClick={() => signOut({ redirectUrl: '/' })}
            >
              <LogOut size={16} aria-hidden="true" />
              Sign out
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
