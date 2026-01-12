import { forwardRef } from 'react';

interface SocialComplyLogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

export const SocialComplyLogo = forwardRef<SVGSVGElement, SocialComplyLogoProps>(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path
        d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"
        fill="url(#shieldGradient)"
        stroke="currentColor"
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 11l2 2 4-4"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M7.5 15.5h9v2.5c0 0.5-0.5 1-1 1h-7c-0.5 0-1-0.5-1-1v-2.5z"
        fill="white"
        fillOpacity="0.3"
        stroke="white"
        strokeWidth="0.5"
      />
      <rect x="9" y="15" width="2" height="3" fill="white" fillOpacity="0.5" rx="0.25" />
      <rect x="13" y="15" width="2" height="3" fill="white" fillOpacity="0.5" rx="0.25" />
      <defs>
        <linearGradient id="shieldGradient" x1="3" y1="2" x2="21" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10b981" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
    </svg>
  )
);

SocialComplyLogo.displayName = 'SocialComplyLogo';

export const SocialComplyLogoSimple = forwardRef<SVGSVGElement, SocialComplyLogoProps>(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path
        d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M8 11l2 2 4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M8 16h8M8 16v2h8v-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
);

SocialComplyLogoSimple.displayName = 'SocialComplyLogoSimple';

export const PropertyHomeIcon = forwardRef<SVGSVGElement, SocialComplyLogoProps>(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path
        d="M3 10.5L12 3l9 7.5v10.5a1 1 0 01-1 1H4a1 1 0 01-1-1V10.5z"
        fill="url(#homeGradient)"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 21V12h6v9"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <rect x="6" y="8" width="3" height="2.5" rx="0.5" fill="white" fillOpacity="0.7" />
      <rect x="15" y="8" width="3" height="2.5" rx="0.5" fill="white" fillOpacity="0.7" />
      <defs>
        <linearGradient id="homeGradient" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
    </svg>
  )
);

PropertyHomeIcon.displayName = 'PropertyHomeIcon';
