import { Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import './OnboardingSteps.css';

const steps = [
  {
    num: 1,
    title: 'Connect GitHub',
    desc: 'Sign in with GitHub or connect your account in Settings.',
    action: { label: 'Go to Settings', to: '/settings' },
  },
  {
    num: 2,
    title: 'Connect a repository',
    desc: 'Choose a GitHub repo to track. We\'ll start syncing it immediately.',
    action: { label: 'Add repository', to: '/repos' },
  },
  {
    num: 3,
    title: 'Explore your analytics',
    desc: 'View PR metrics, commit activity, health scores, and AI-generated insights.',
    action: null,
  },
];

function OnboardingSteps({ hasGithub, hasRepos }) {
  const currentStep = !hasGithub ? 1 : !hasRepos ? 2 : 3;

  return (
    <div className="onboarding">
      <h2 className="onboarding-title">Get started with DevPulse AI</h2>
      <p className="onboarding-sub">Follow these steps to see your first analytics dashboard.</p>
      <div className="onboarding-steps">
        {steps.map((step) => {
          const done = step.num < currentStep;
          const active = step.num === currentStep;
          return (
            <div key={step.num} className={`onboarding-step ${done ? 'done' : active ? 'active' : 'upcoming'}`}>
              <div className="step-num">{done ? '✓' : step.num}</div>
              <div className="step-body">
                <div className="step-title">{step.title}</div>
                <div className="step-desc">{step.desc}</div>
                {active && step.action && (
                  <Link to={step.action.to} className="step-btn">{step.action.label}</Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default OnboardingSteps;
