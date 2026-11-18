import React from 'react';

export const MTS_LOGO_SRC =
  '/assets/aistudio/WhatsApp_Image_2026-10-24_at_17.07.20_aed32341.jpeg';

interface MTSLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<MTSLogoProps['size']>, string> = {
  xs: 'h-8 w-8 rounded-md',
  sm: 'h-9 w-9 rounded-lg',
  md: 'h-11 w-11 rounded-lg',
  lg: 'h-14 w-14 rounded-xl',
  xl: 'h-20 w-20 rounded-xl',
};

export const MTSLogo: React.FC<MTSLogoProps> = ({
  size = 'sm',
  className = '',
}) => {
  return (
    <img
      src={MTS_LOGO_SRC}
      alt="MTS Trainings Logo"
      className={`shrink-0 bg-[#071526] object-cover ${SIZE_CLASSES[size]} ${className}`}
    />
  );
};
