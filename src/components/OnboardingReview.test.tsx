import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import OnboardingReview from './OnboardingReview';

describe('OnboardingReview', () => {
  const originalDisplayNames = Intl.DisplayNames;

  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Intl.DisplayNames = originalDisplayNames;
  });

  it('renders correctly with normal Intl.DisplayNames behavior', () => {
    sessionStorage.setItem(
      'onboardingBusiness',
      JSON.stringify({
        businessName: 'Test Business',
        website: 'example.com',
        country: 'US',
      })
    );

    render(
      <MemoryRouter>
        <OnboardingReview />
      </MemoryRouter>
    );

    // US should be formatted as "United States"
    expect(screen.getByText(/United States/)).toBeInTheDocument();
    expect(screen.getByText(/Test Business/)).toBeInTheDocument();
  });

  it('falls back to raw country code when Intl.DisplayNames throws', () => {
    sessionStorage.setItem(
      'onboardingBusiness',
      JSON.stringify({
        businessName: 'Test Business',
        website: 'example.com',
        country: 'US',
      })
    );

    // Force Intl.DisplayNames to throw
    Intl.DisplayNames = vi.fn().mockImplementation(() => {
      throw new Error('Intl not supported');
    }) as any;

    render(
      <MemoryRouter>
        <OnboardingReview />
      </MemoryRouter>
    );

    // Should fall back to "US"
    expect(screen.getByText(/US/)).toBeInTheDocument();
    expect(screen.queryByText(/United States/)).not.toBeInTheDocument();
  });

  it('handles missing country', () => {
    sessionStorage.setItem(
      'onboardingBusiness',
      JSON.stringify({
        businessName: 'Test Business',
        website: 'example.com',
        country: '',
      })
    );

    render(
      <MemoryRouter>
        <OnboardingReview />
      </MemoryRouter>
    );

    expect(screen.getByText(/No country selected/)).toBeInTheDocument();
  });

  const validBusiness = {
    businessName: 'Test Business',
    website: 'example.com',
    country: 'US',
  };

  // A checksum-valid EVM address (all lowercase hex is valid EIP-55).
  const validPayout = '0x0000000000000000000000000000000000000000';

  const renderWithRoutes = () =>
    render(
      <MemoryRouter initialEntries={['/onboarding/review']}>
        <Routes>
          <Route path="/onboarding/review" element={<OnboardingReview />} />
          <Route path="/onboarding/business" element={<div>Business Step</div>} />
          <Route path="/onboarding/payout" element={<div>Payout Step</div>} />
          <Route path="/onboarding-success" element={<div>Success Page</div>} />
        </Routes>
      </MemoryRouter>
    );

  it('redirects to business step when storage is empty', async () => {
    renderWithRoutes();

    await waitFor(() => {
      expect(screen.getByText('Business Step')).toBeInTheDocument();
    });
  });

  it('redirects to payout step when business exists but payout is missing', async () => {
    sessionStorage.setItem('onboardingBusiness', JSON.stringify(validBusiness));

    renderWithRoutes();

    await waitFor(() => {
      expect(screen.getByText('Payout Step')).toBeInTheDocument();
    });
  });

  it('completes successfully and clears storage on happy path', async () => {
    sessionStorage.setItem('onboardingBusiness', JSON.stringify(validBusiness));
    sessionStorage.setItem('onboardingPayout', JSON.stringify({ payoutAddress: validPayout }));

    renderWithRoutes();

    const completeButton = screen.getByRole('button', { name: /complete setup/i });
    expect(completeButton).toBeEnabled();

    fireEvent.click(completeButton);

    await waitFor(() => {
      expect(screen.getByText('Success Page')).toBeInTheDocument();
    });

    expect(sessionStorage.getItem('onboardingBusiness')).toBeNull();
    expect(sessionStorage.getItem('onboardingPayout')).toBeNull();
  });

  it('shows an inline error and stays on review when submit rejects', async () => {
    sessionStorage.setItem('onboardingBusiness', JSON.stringify(validBusiness));
    sessionStorage.setItem('onboardingPayout', JSON.stringify({ payoutAddress: validPayout }));

    const submitSpy = vi
      .spyOn(OnboardingReview as any, 'submitOnboarding')
      .mockRejectedValue(new Error('submit failed'));

    renderWithRoutes();

    fireEvent.click(screen.getByRole('button', { name: /complete setup/i }));

    await waitFor(() => {
      expect(screen.getByText(/submit failed/i)).toBeInTheDocument();
    });

    expect(screen.queryByText('Success Page')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('onboardingBusiness')).not.toBeNull();

    submitSpy.mockRestore();
  });
});
