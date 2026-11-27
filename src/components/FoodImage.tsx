import { useState } from 'react';
import { NUTRIX_IMAGES } from '../lib/images.ts';
import type { RecipeImageKey } from '../types/nutrix.ts';

interface FoodImageProps {
  imageKey: RecipeImageKey | 'pantry';
  alt: string;
  className?: string;
}

const IMAGE_DIMENSIONS: Record<RecipeImageKey | 'pantry', { width: number; height: number }> = {
  hero: { width: 900, height: 502 },
  frango: { width: 900, height: 672 },
  omelete: { width: 900, height: 672 },
  veggie: { width: 900, height: 672 },
  pantry: { width: 900, height: 672 },
};

export function FoodImage({ imageKey, alt, className = 'w-full h-48 object-cover' }: FoodImageProps) {
  const [failed, setFailed] = useState(false);
  const dims = IMAGE_DIMENSIONS[imageKey] || IMAGE_DIMENSIONS.hero;

  if (failed) {
    return (
      <div
        className={`${className} bg-gradient-to-br from-[#173D32] to-[#225445] flex flex-col items-center justify-center gap-2 text-[#C3F28B] p-4`}
        role="img"
        aria-label={alt}
      >
        <span className="text-xs font-medium text-white/90 text-center line-clamp-2">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={NUTRIX_IMAGES[imageKey] || NUTRIX_IMAGES.hero}
      alt={alt}
      width={dims.width}
      height={dims.height}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
