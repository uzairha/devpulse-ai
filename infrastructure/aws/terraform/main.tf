# Root module entry point.
#
# Resources are organized by concern into dedicated files rather than this
# one, which is why main.tf itself declares nothing:
#
#   versions.tf           Terraform / provider version constraints
#   providers.tf           AWS provider configuration and default tags
#   variables.tf           All input variables, grouped by concern
#   networking.tf           VPC, subnets, internet gateway, route tables, NAT
#   security-groups.tf     The ALB -> ECS -> RDS/ElastiCache security group chain
#   ecr.tf                   Container image repositories
#   iam.tf                   ECS execution and task roles
#   load-balancer.tf       ALB, target groups, listeners
#   ecs.tf                   Cluster, task definitions and services
#   rds.tf                   PostgreSQL
#   redis.tf                ElastiCache Redis
#   s3.tf                     Object storage for future uploads
#   secrets.tf               Secrets Manager
#   cloudwatch.tf           Log groups and alarms
#   outputs.tf               Values exposed after apply
#
# See docs/aws-deployment.md for the full architecture and deployment
# procedure. Nothing in this directory has been applied - see the repository
# root README for the standing $0-out-of-pocket / no-provisioning policy this
# configuration is written under.
