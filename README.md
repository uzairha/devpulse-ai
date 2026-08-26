# DevPulse AI

> AI-powered developer analytics platform. Connect your GitHub repositories and get intelligent insights into your team's engineering velocity, PR health, and code review patterns.

**Live Demo:** _coming soon_

---

## Documentation

- [Product Requirements](docs/product-requirements.md)
- [Architecture](docs/architecture.md)
- [Database Schema](docs/database-schema.md)
- [API Design](docs/api-design.md)
- [Roadmap](docs/roadmap.md)
- [Development Log](docs/development-log.md)
- [AWS Deployment](docs/aws-deployment.md)

---

## Deployment status

`infrastructure/aws/terraform/` describes a complete AWS deployment — VPC, ECS
Fargate, RDS, ElastiCache, S3, Secrets Manager, CloudWatch — and
`.github/workflows/deploy-aws.yml` describes the pipeline that would ship to it.

**Neither has ever been run, and nothing in this repository will run them for
you.** No AWS resources have been provisioned and none are being billed. This is
the standing no-provisioning policy the infrastructure code is written under,
and it is deliberate: the configuration is written to be read and reviewed, not
applied. Three things enforce it in practice:

- There is no Terraform state and no remote backend. `terraform apply` has
  never been run against this configuration.
- The deploy workflow is gated on a repository variable (`AWS_DEPLOY_ENABLED`)
  that does not exist, and authenticates via OIDC against a role that does not
  exist. There are no AWS credentials stored in this repository.
- CI runs `terraform fmt`/`validate` only, with `-backend=false` and no
  credentials, so it cannot reach AWS even by accident.

Applying it for real costs money — see the cost notes in
[docs/aws-deployment.md](docs/aws-deployment.md) before changing any of the
above.

---

## Running tests

```bash
docker compose up -d                 # Postgres + Redis must be running

cd server
cp .env.test.example .env.test
docker compose exec db psql -U postgres -c "CREATE DATABASE devpulse_test;"
npm run test:db:migrate              # apply migrations to devpulse_test
npm test

cd ../client && npm test
```

The server suite truncates its database between tests, so it refuses to start
unless `DATABASE_URL` names a database ending in `_test` and `REDIS_URL` points at
a non-zero Redis logical database.

---

_Full README coming in Week 6._
