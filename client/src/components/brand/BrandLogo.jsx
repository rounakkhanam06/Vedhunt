import lightLogo from '../../assets/brand/vedhunt-logo-light.png';
import darkLogo from '../../assets/brand/vedhunt-logo-dark.png';
import whiteLogo from '../../assets/brand/vedhunt-logo-white.png';

/**
 * The Vedhunt wordmark with the right contrast for the surface it sits on:
 *   - "auto"   — theme-reactive surfaces: orange+black in light, orange+white in dark
 *   - "light"  — always on a light surface
 *   - "dark"   — always on a dark surface
 *   - "brand"  — on the brand-orange surface: all white (the orange "VED" would vanish)
 * The assets are tightly cropped, so size it with a height class only.
 */
export default function BrandLogo({ variant = 'auto', className = 'h-7' }) {
  const img = (src, extra = '') => <img src={src} alt="Vedhunt" className={`${className} w-auto object-contain ${extra}`} />;
  if (variant === 'brand') return img(whiteLogo);
  if (variant === 'light') return img(lightLogo);
  if (variant === 'dark') return img(darkLogo);
  return (
    <>
      {img(lightLogo, 'dark:hidden')}
      {img(darkLogo, 'hidden dark:block')}
    </>
  );
}
