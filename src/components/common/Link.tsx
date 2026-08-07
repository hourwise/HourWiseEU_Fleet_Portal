import { useRouter } from '../../App';
import { isRoute } from '../../lib/routes';

interface LinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  target?: string;
  rel?: string;
  title?: string;
}

export function Link({ href, children, className = '', onClick, target, rel, title }: LinkProps) {
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

    if (href.startsWith('/') && isRoute(href)) {
      navigate(href);
    } else if (href.startsWith('/')) {
      // Paths outside the React app routes (e.g. the static landing page at
      // "/") require a full page load so the correct static asset is served.
      window.location.href = href;
    }

    onClick?.();
  };

  return (
    <a href={href} onClick={handleClick} className={className} target={target} rel={rel} title={title}>
      {children}
    </a>
  );
}
