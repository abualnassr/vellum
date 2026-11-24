import { useEffect } from 'react';

interface ImageLightboxProps {
  media: { kind: 'image' | 'svg'; src: string };
  onClose: () => void;
}

export function ImageLightbox({ media, onClose }: ImageLightboxProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="lightbox-backdrop" onClick={onClose} role="dialog" aria-label="Media Preview">
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        {media.kind === 'image' ? (
          <img src={media.src} alt="Zoomed preview" />
        ) : (
          <div dangerouslySetInnerHTML={{ __html: media.src }} />
        )}
      </div>
    </div>
  );
}
