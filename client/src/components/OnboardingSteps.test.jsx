import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OnboardingSteps from './OnboardingSteps.jsx';

const renderSteps = (props) =>
  render(
    <MemoryRouter>
      <OnboardingSteps {...props} />
    </MemoryRouter>
  );

describe('OnboardingSteps', () => {
  it('starts on step 1 with the Settings CTA when GitHub is not connected', () => {
    const { container } = renderSteps({ hasGithub: false, hasRepos: false });
    const link = screen.getByRole('link', { name: 'Go to Settings' });
    expect(link).toHaveAttribute('href', '/settings');
    expect(container.querySelector('.onboarding-step.active .step-title')).toHaveTextContent(
      'Connect GitHub'
    );
  });

  it('advances to step 2 (add a repo) once GitHub is connected, marking step 1 done', () => {
    const { container } = renderSteps({ hasGithub: true, hasRepos: false });
    expect(screen.getByRole('link', { name: 'Add repository' })).toHaveAttribute('href', '/repos');
    const steps = container.querySelectorAll('.onboarding-step');
    expect(steps[0]).toHaveClass('done');
    expect(steps[1]).toHaveClass('active');
  });

  it('lands on step 3 with no CTA once GitHub and a repo are connected', () => {
    const { container } = renderSteps({ hasGithub: true, hasRepos: true });
    const steps = container.querySelectorAll('.onboarding-step');
    expect(steps[0]).toHaveClass('done');
    expect(steps[1]).toHaveClass('done');
    expect(steps[2]).toHaveClass('active');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
