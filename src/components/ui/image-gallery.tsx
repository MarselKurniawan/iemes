import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, ZoomIn, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { convertToWebP } from '@/lib/image-utils';
interface ImageGalleryProps {
  images: string[];
  className?: string;
}

export function ImageGallery({ images, className }: ImageGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (images.length === 0) {
    return null;
  }

  const openLightbox = (index: number) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
  };

  const goNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const goPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <>
      <div className={cn("flex gap-1 flex-wrap", className)}>
        {images.slice(0, 3).map((url, idx) => (
          <div 
            key={idx} 
            className="relative cursor-pointer group"
            onClick={() => openLightbox(idx)}
          >
            <img 
              src={url} 
              alt={`Photo ${idx + 1}`} 
              className="w-10 h-10 object-cover rounded border hover:opacity-80 transition-opacity"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded">
              <ZoomIn className="h-4 w-4 text-white" />
            </div>
            {idx === 2 && images.length > 3 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded text-white text-xs font-medium">
                +{images.length - 3}
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-50 text-white hover:bg-white/20"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
          
          <div className="relative flex items-center justify-center min-h-[60vh] p-4">
            {images.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 text-white hover:bg-white/20"
                onClick={goPrev}
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
            )}
            
            <img 
              src={images[currentIndex]} 
              alt={`Photo ${currentIndex + 1}`}
              className="max-h-[80vh] max-w-full object-contain rounded-lg"
            />
            
            {images.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 text-white hover:bg-white/20"
                onClick={goNext}
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex justify-center gap-2 pb-4">
              {images.map((url, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={cn(
                    "w-12 h-12 rounded border-2 overflow-hidden transition-all",
                    idx === currentIndex ? "border-white" : "border-transparent opacity-60 hover:opacity-100"
                  )}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface ImageGalleryInputProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  onUpload: (file: File) => Promise<string | null>;
  uploading?: boolean;
  showStorageLink?: boolean;
  storageUrl?: string;
}

export function ImageGalleryInput({ images, onImagesChange, onUpload, uploading, showStorageLink, storageUrl }: ImageGalleryInputProps) {
  const [converting, setConverting] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    setConverting(true);
    
    for (const file of Array.from(files)) {
      try {
        // Convert to WebP before upload for better compression
        const webpFile = await convertToWebP(file, 0.85);
        const url = await onUpload(webpFile);
        if (url) {
          onImagesChange([...images, url]);
        }
      } catch (error) {
        console.error('Error converting image:', error);
        // Fallback to original file if conversion fails
        const url = await onUpload(file);
        if (url) {
          onImagesChange([...images, url]);
        }
      }
    }
    
    setConverting(false);
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  const isProcessing = uploading || converting;

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {images.map((url, idx) => (
            <div key={idx} className="relative group">
              <img 
                src={url} 
                alt={`Photo ${idx + 1}`} 
                className="w-20 h-20 object-cover rounded-lg border"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeImage(idx)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      
      <div className="flex gap-2">
        <label className="flex-1">
          <div className={cn(
            "flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors",
            isProcessing && "opacity-50 pointer-events-none"
          )}>
            {converting ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                <circle cx="12" cy="13" r="3"/>
              </svg>
            )}
            <span className="text-sm text-muted-foreground">
              {converting ? 'Converting...' : uploading ? 'Uploading...' : 'Kamera'}
            </span>
          </div>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
            disabled={isProcessing}
          />
        </label>
        <label className="flex-1">
          <div className={cn(
            "flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors",
            isProcessing && "opacity-50 pointer-events-none"
          )}>
            {converting ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            )}
            <span className="text-sm text-muted-foreground">
              {converting ? 'Converting...' : uploading ? 'Uploading...' : 'Upload'}
            </span>
          </div>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
            disabled={isProcessing}
          />
        </label>
      </div>

      {showStorageLink && storageUrl && (
        <a
          href={storageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Buka folder storage
        </a>
      )}

      <p className="text-xs text-muted-foreground">
        Foto otomatis dikonversi ke WebP untuk menghemat storage
      </p>
    </div>
  );
}