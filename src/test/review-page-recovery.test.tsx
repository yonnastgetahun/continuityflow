import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ReviewPage from '@/pages/Review';

vi.mock('@/components/AppLayout', () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/PDFViewer', () => ({
  PDFViewer: () => <div>PDF Viewer</div>,
}));

vi.mock('@/components/ExtractionDebugPanel', () => ({
  ExtractionDebugPanel: () => null,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'qa@example.com' },
    profile: { plan_type: 'pro' },
    refreshProfile: vi.fn(),
    isReadOnly: false,
    isOwner: false,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe('ReviewPage recovery state', () => {
  it('shows a recovery message instead of rendering blank when review state is missing', () => {
    render(
      <MemoryRouter initialEntries={['/review']}>
        <Routes>
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/upload" element={<div>Upload Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/Review session unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Return to Upload/i })).toBeInTheDocument();
  });
});
