import { useState } from 'react';
import { Utensils } from 'lucide-react';
import { NUTRIX_IMAGES } from '../lib/images.ts';
import type { RecipeImageKey } from '../types/nutrix.ts';

interface FoodImageProps {
  imageKey: RecipeImageKey | 'pantry';
  alt: string;
  className?: string;
}

export function FoodImage({ imageKey, alt, className = 'w-full h-48 object-cover' }: FoodImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`${className} bg-gradient-to-br from-[#173D32] to-[#225445] flex flex-col items-center justify-center gap-2 text-[#C3F28B] p-4`}
        role="img"
        aria-label={alt}
      >
        <Utensils className="w-7 h-7 opacity-80" />
        <span className="text-xs font-medium text-white/90 text-center line-clamp-2">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={NUTRIX_IMAGES[imageKey] || NUTRIX_IMAGES.hero}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
