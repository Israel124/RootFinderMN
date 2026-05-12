import { cn } from '@/lib/utils';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
}

const sizeMap = {
  sm: {
    frame: 'h-9 w-9 rounded-xl',
    circle: 'h-6 w-6',
    sigma: 'text-sm',
    wordmark: 'text-sm',
  },
  md: {
    frame: 'h-12 w-12 rounded-2xl',
    circle: 'h-8 w-8',
    sigma: 'text-lg',
    wordmark: 'text-base',
  },
  lg: {
    frame: 'h-16 w-16 rounded-[1.4rem]',
    circle: 'h-11 w-11',
    sigma: 'text-2xl',
    wordmark: 'text-xl',
  },
} as const;

export function BrandLogo({ size = 'md', showWordmark = false, className }: BrandLogoProps) {
  const styles = sizeMap[size];

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn('flex items-center justify-center bg-[#07110c] shadow-inner ring-1 ring-white/6', styles.frame)}>
        <div className={cn('flex items-center justify-center rounded-full bg-[#10b981] text-[#04110b]', styles.circle)}>
          <span className={cn('font-black leading-none', styles.sigma)}>Σ</span>
        </div>
      </div>
      {showWordmark ? (
        <span className={cn('font-black tracking-tight text-[var(--text-primary)]', styles.wordmark)}>
          RootFinder
        </span>
      ) : null}
    </div>
  );
}
