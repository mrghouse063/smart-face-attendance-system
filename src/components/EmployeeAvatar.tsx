import React from 'react';

interface EmployeeAvatarProps {
  name: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const EmployeeAvatar: React.FC<EmployeeAvatarProps> = ({
  name,
  color = '#16A34A',
  size = 'md',
}) => {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  const sizeClasses = {
    sm: 'w-9 h-9 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-lg',
  }[size];

  return (
    <div
      style={{ backgroundColor: color }}
      className={`${sizeClasses} rounded-full text-white font-bold flex items-center justify-center shrink-0 select-none shadow-xs`}
      aria-hidden="true"
    >
      {initials || 'EM'}
    </div>
  );
};
