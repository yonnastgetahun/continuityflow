import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

// Configure PDF.js worker using bundled version (no CDN)
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface PDFViewerProps {
  file: File | null;
  fileName?: string;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  highlightSnippet?: string;
  className?: string;
}

export function PDFViewer({ 
  file, 
  fileName,
  currentPage = 1, 
  onPageChange,
  highlightSnippet,
  className 
}: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(currentPage);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load PDF document
  useEffect(() => {
    if (!file) {
      setPdf(null);
      setNumPages(0);
      return;
    }

    const loadPdf = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        setPdf(pdfDoc);
        setNumPages(pdfDoc.numPages);
        setPageNum(1);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError('Failed to load PDF');
      } finally {
        setIsLoading(false);
      }
    };

    loadPdf();
  }, [file]);

  // Navigate to page when currentPage prop changes
  useEffect(() => {
    if (currentPage && currentPage !== pageNum && currentPage >= 1 && currentPage <= numPages) {
      setPageNum(currentPage);
    }
  }, [currentPage, numPages, pageNum]);

  // Render current page
  const renderPage = useCallback(async () => {
    if (!pdf || !canvasRef.current) return;

    setIsLoading(true);
    try {
      const page = await pdf.getPage(pageNum);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      const viewport = page.getViewport({ scale });
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport,
      }).promise;
    } catch (err) {
      console.error('Error rendering page:', err);
    } finally {
      setIsLoading(false);
    }
  }, [pdf, pageNum, scale]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  const goToPrevPage = () => {
    if (pageNum > 1) {
      const newPage = pageNum - 1;
      setPageNum(newPage);
      onPageChange?.(newPage);
    }
  };

  const goToNextPage = () => {
    if (pageNum < numPages) {
      const newPage = pageNum + 1;
      setPageNum(newPage);
      onPageChange?.(newPage);
    }
  };

  const zoomIn = () => setScale((s) => Math.min(s + 0.2, 3));
  const zoomOut = () => setScale((s) => Math.max(s - 0.2, 0.5));

  if (!file) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full bg-muted/30 rounded-lg border-2 border-dashed", className)}>
        <FileText className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-muted-foreground text-sm">No document selected</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b rounded-t-lg">
        <span className="text-sm font-medium truncate max-w-[150px]" title={fileName}>
          {fileName || 'Document'}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Highlight Snippet Overlay */}
      {highlightSnippet && (
        <div className="mx-2 mt-2 p-3 bg-primary/10 border border-primary/30 rounded-lg animate-scale-in">
          <p className="text-xs font-medium text-primary mb-1">Evidence found:</p>
          <p className="text-xs text-foreground italic">"{highlightSnippet}"</p>
        </div>
      )}

      {/* Canvas Container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto bg-muted/20 flex items-start justify-center p-4"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}
        {error ? (
          <div className="text-destructive text-sm">{error}</div>
        ) : (
          <canvas 
            ref={canvasRef} 
            className="shadow-lg rounded"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        )}
      </div>

      {/* Page Navigation */}
      <div className="flex items-center justify-center gap-3 px-3 py-2 bg-muted/50 border-t rounded-b-lg">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7" 
          onClick={goToPrevPage}
          disabled={pageNum <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {pageNum} of {numPages}
        </span>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7" 
          onClick={goToNextPage}
          disabled={pageNum >= numPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
