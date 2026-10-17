import defaultProductImage from '@/assets/default-product.webp';
import placeholderImage from '@/assets/placeholder-product.svg';

/** Local fallback for articles without a picture: works offline, no third-party request. */
const PLACEHOLDER_IMAGE: string = placeholderImage;

/** Default product photo shown during a simulation session (local, optimised asset). */
const SIMULATION_DEFAULT_IMAGE: string = defaultProductImage;
const SIMULATION_DEFAULT_IMAGE_ALT = 'Salz- und Pfefferstreuer';

/** Picture for an article: its own image, else the simulation default or the neutral placeholder. */
export function resolveArticleImage(
  imageUrl: string | null,
  name: string,
  isSimulation: boolean
): { src: string; alt: string; isDefault: boolean } {
  if (imageUrl) return { src: imageUrl, alt: name, isDefault: false };
  if (isSimulation) {
    return { src: SIMULATION_DEFAULT_IMAGE, alt: SIMULATION_DEFAULT_IMAGE_ALT, isDefault: true };
  }
  return { src: PLACEHOLDER_IMAGE, alt: name, isDefault: false };
}
