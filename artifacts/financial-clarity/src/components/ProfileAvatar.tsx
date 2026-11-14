import { useState } from 'react';
import { UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProfileAvatarUser {
  name: string;
  email: string;
  imageUrl?: string;
}

interface ProfileAvatarProps {
  /** Google profile to show, or null when no Google account is connected. */
  user: ProfileAvatarUser | null;
  size?: 'sm' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: { box: 'w-9 h-9 text-sm', icon: 18 },
  lg: { box: 'w-20 h-20 text-2xl', icon: 36 },
} as const;

/** Round profile picture with an initial or a generic icon as fallbacks. Decorative: callers label it. */
export function ProfileAvatar({ user, size = 'sm', className }: ProfileAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const { box, icon } = SIZE_CLASSES[size];
  const imageUrl = user?.imageUrl && user.imageUrl !== failedUrl ? user.imageUrl : null;
  const initial = user ? (user.name.trim() || user.email.trim()).charAt(0).toUpperCase() : '';

  return (
    <span
      aria-hidden="true"
      data-testid="profile-avatar"
      className={cn(
        'rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 font-bold',
        user ? 'bg-accent/20 text-accent' : 'bg-muted text-muted-foreground',
        box,
        className,
      )}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : initial ? (
        initial
      ) : (
        <UserRound size={icon} />
      )}
    </span>
  );
}
