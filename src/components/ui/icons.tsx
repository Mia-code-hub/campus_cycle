import type { SVGProps } from 'react';

/**
 * 图标集：统一 24×24 视框、1.8 描边、currentColor。
 * 全部 aria-hidden——图标旁边的文字才是可读信息，纯图标按钮必须自己带 aria-label。
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M9.5 20v-5.5h5V20" />
    </Svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function GiftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 10.5h16V20H4z" />
      <path d="M3 7h18v3.5H3zM12 7v13" />
      <path d="M12 7S10.8 3.5 8.6 3.5A2.1 2.1 0 0 0 8.6 7.7M12 7s1.2-3.5 3.4-3.5a2.1 2.1 0 0 1 0 4.2" />
    </Svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8.2" r="3.7" />
      <path d="M4.8 20c.9-3.6 3.8-5.4 7.2-5.4s6.3 1.8 7.2 5.4" />
    </Svg>
  );
}

export function BoxIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16z" />
      <path d="M3.5 8 12 12.5 20.5 8M12 12.5v8" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5M12 16h.01" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </Svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 8h.01" />
    </Svg>
  );
}

/** 空态插画：一只半开的纸箱，配色全部来自令牌（currentColor + 固定的令牌类名） */
export function EmptyBoxArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 96"
      className={className}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="60" cy="84" rx="38" ry="6" className="fill-line" />
      <path d="M26 40h68v38a4 4 0 0 1-4 4H30a4 4 0 0 1-4-4z" className="fill-sunken stroke-line-strong" strokeWidth="2" />
      <path d="M26 40 40 22h40l14 18" className="fill-panel stroke-line-strong" strokeWidth="2" />
      <path d="M26 40h68" className="stroke-line-strong" strokeWidth="2" />
      <path d="M60 22v18" className="stroke-line-strong" strokeWidth="2" strokeDasharray="3 4" />
      <circle cx="60" cy="55" r="9" className="fill-blush/60" />
      <path d="M56.5 55h7M60 51.5v7" className="stroke-ink/60" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
