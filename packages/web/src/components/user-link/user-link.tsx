import { useQuery } from '@tanstack/react-query';
import { useGT } from 'gt-react';
import type { UserProfile } from 'shared';
import { env } from '../../config';

interface UserLinkProps {
  id: string;
  className?: string;
}

export default function UserLink(props: UserLinkProps) {
  const gt = useGT();
  const { data: user } = useQuery({
    queryKey: ['profile', props.id, 1],
    queryFn: async ({ signal }): Promise<UserProfile> => {
      const response = await fetch(
        `${env.apiUrl}/users/${encodeURIComponent(props.id)}`,
        { signal }
      );

      if (!response.ok) {
        throw new Error(`GET ${response.url} failed (${response.status})`);
      }

      return response.json();
    }
  });

  return (
    <a className={props.className} href={`/profile/${props.id}`}>
      {user?.username || user?.fullName || gt('Unknown')}
    </a>
  );
}
