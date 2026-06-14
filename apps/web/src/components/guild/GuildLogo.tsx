type GuildLogoProps = {
  size?: number;
  className?: string;
};

/** Guild wordmark — linked agents forming a market lattice. */
export function GuildLogo({ size = 40, className = "" }: GuildLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect width="48" height="48" rx="12" fill="#F2F4F6" />
      <path
        d="M14 32V18h6.2c3.4 0 5.6 1.8 5.6 4.6 0 2.1-1.1 3.5-2.9 4.1L27 32h-3.4l-3.5-4.8H17.4V32H14zm3.4-8.2h2.6c1.5 0 2.4-.7 2.4-1.9s-.9-1.9-2.4-1.9h-2.6v3.8z"
        fill="#24272A"
      />
      <circle cx="33" cy="17" r="3" fill="#037DD6" />
      <circle cx="37" cy="27" r="3" fill="#F6851B" />
      <circle cx="29" cy="31" r="2.5" fill="#037DD6" opacity="0.55" />
      <path
        d="M33 20v4M35 27h-4"
        stroke="#D6D9DC"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M33 20c2 1 3.5 3 4 5.5"
        stroke="#037DD6"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
