# Product Requirements

## What is DevPulse AI?

DevPulse AI is a developer analytics SaaS platform. Engineers connect their GitHub repositories and receive AI-powered insights into their team's engineering velocity, pull request health, code review patterns, and weekly engineering reports.

## Target Users

Individual developers and small engineering teams who want visibility into their development workflow without manual tracking or spreadsheets.

## Core Features

### Authentication
- Email/password registration and login
- GitHub OAuth (one-click sign-in)
- JWT-based sessions

### Repository Management
- Connect any GitHub repository
- Enable/disable sync per repository
- Manual and automatic data sync

### Analytics Dashboard
- PR metrics: merge rate, avg time to merge, throughput
- Commit metrics: frequency, contributors, activity heatmap
- Code churn tracking
- Configurable date ranges (7d / 30d / 90d / custom)

### AI Features
- AI-generated PR summaries
- Weekly engineering reports
- Repository health score (0–100)
- AI chat: ask questions about your repo data

### Notifications
- In-app notification center
- Weekly report emails (opt-in)
- Sync completion alerts

## Non-Goals (v1)
- Team/organization workspaces (v2)
- GitLab or Bitbucket integration (v2)
- Mobile app (v2)
