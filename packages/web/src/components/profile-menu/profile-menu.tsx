import { useClerk, useUser } from '@clerk/react';
import { Avatar } from '@base-ui/react/avatar';
import { Menu } from '@base-ui/react/menu';
import { T, useGT, useLocaleSelector } from 'gt-react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Languages,
  LogOut,
  Settings,
  User
} from 'lucide-preact';
import { useRef } from 'preact/hooks';
import * as styles from './profile-menu.css';

export default function ProfileMenu() {
  const gt = useGT();
  const { user } = useUser();
  const { openUserProfile, signOut } = useClerk();
  const { locale, locales, getLocaleProperties, setLocale } = useLocaleSelector();
  const menuPositioner = useRef<HTMLDivElement>(null);

  if (!user) {
    return null;
  }

  const name = user.username || user.fullName || gt('Unknown');

  return (
    <Menu.Root modal={false}>
      <Menu.Trigger className={styles.trigger} aria-label={gt('Account menu')}>
        <Avatar.Root className={styles.avatar} aria-hidden="true">
          <Avatar.Image className={styles.avatarImage} src={user.imageUrl} />
          <Avatar.Fallback>{name.slice(0, 1).toUpperCase()}</Avatar.Fallback>
        </Avatar.Root>
        <span className={styles.name}>{name}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          ref={menuPositioner}
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
              render={<a href={`/profile/${user.id}`} />}
            >
              <User size={16} aria-hidden="true" />
              <T>View profile</T>
            </Menu.Item>
            <Menu.SubmenuRoot>
              <Menu.SubmenuTrigger className={styles.item}>
                <Languages size={16} aria-hidden="true" />
                <T>Set Language</T>
                <ChevronRight className={styles.itemEnd} size={16} aria-hidden="true" />
              </Menu.SubmenuTrigger>
              <Menu.Portal container={menuPositioner}>
                <Menu.Positioner
                  className={styles.positioner}
                  sideOffset={4}
                  collisionPadding={16}
                >
                  <Menu.Popup className={styles.content}>
                    <Menu.RadioGroup value={locale} onValueChange={setLocale}>
                      {locales.map(availableLocale => (
                        <Menu.RadioItem
                          className={styles.item}
                          value={availableLocale}
                          key={availableLocale}
                          closeOnClick
                        >
                          <span>{getLocaleProperties(availableLocale).nameWithRegionCode}</span>
                          <Menu.RadioItemIndicator className={styles.itemEnd}>
                            <Check size={16} aria-hidden="true" />
                          </Menu.RadioItemIndicator>
                        </Menu.RadioItem>
                      ))}
                    </Menu.RadioGroup>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.SubmenuRoot>
            <Menu.Item
              className={styles.item}
              onClick={() => openUserProfile()}
            >
              <Settings size={16} aria-hidden="true" />
              <T>Account settings</T>
            </Menu.Item>
            <Menu.Item
              className={styles.item}
              onClick={() => signOut({ redirectUrl: '/' })}
            >
              <LogOut size={16} aria-hidden="true" />
              <T>Sign out</T>
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
