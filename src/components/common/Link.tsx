import { useRouter } from '../../App';

interface LinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  target?: string;
  rel?: string;
}

export function Link({ href, children, className = '', onClick, target, rel }: LinkProps) {
  const { navigate } = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      (target && target !== '_self')
    ) {
      return;
    }

    const isExternal = /^https?:\/\//i.test(href);
    if (isExternal) return;

    e.preventDefault();

    if (href.startsWith('/')) {
      navigate(href as any);
    }

    onClick?.();
  };

  return (
    <a href={href} onClick={handleClick} className={className} target={target} rel={rel}>
      {children}
    </a>
  );
}
