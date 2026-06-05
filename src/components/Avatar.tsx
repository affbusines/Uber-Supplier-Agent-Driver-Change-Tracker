import { useState } from 'react';

interface AvatarProps {
  photoUrl: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
}

export function getInitials(name: string): string {
  if (!name) return '?';
  const words = name.trim().split(' ');
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function getAvatarColor(name: string): string {
  // Consistent color from name — same name = same color always
  const colors = [
    '#06C167', // Uber Green
    '#276EF1', // Uber Blue
    '#FFC043', // Yellow
    '#E02020', // Red
    '#9747FF', // Purple
    '#00A9CE'  // Teal
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

export default function Avatar({ photoUrl, name, size = 40, className = '' }: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  if (photoUrl && !imgError) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={`rounded-full shrink-0 object-cover ${className}`}
        style={{ width: size, height: size }}
        onError={() => setImgError(true)} // fallback on error (e.g. expired expired CloudFront CDN link)
        referrerPolicy="no-referrer"
      />
    );
  }

  // Initials fallback
  return (
    <div
      className={`rounded-full shrink-0 flex items-center justify-center font-black text-black border border-zinc-200 dark:border-zinc-805 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: getAvatarColor(name || ''),
        fontSize: size * 0.35,
      }}
    >
      {getInitials(name)}
    </div>
  );
}
