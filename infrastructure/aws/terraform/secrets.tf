# Secrets Manager.
#
# Five secrets, matching the five values server/src/config/index.js reads
# from the environment in production. Three (DATABASE_URL, REDIS_URL,
# JWT_SECRET) are generated here by Terraform - there is no human-typed value
# to leak, only a value this configuration invents and immediately stores.
# The other two (the OpenAI key, the GitHub OAuth app's credentials) come
# from var.openai_api_key / var.github_client_* - real external accounts
# Terraform cannot create, supplied through terraform.tfvars and never
# committed. Not created by this configuration - see the standing
# no-provisioning policy in the repository root README.
#
# ecs.tf's task definitions read these five ARNs directly
# (aws_secretsmanager_secret.*.arn), so the value stored here and the value
# injected into the running container can never drift apart.

# --- Generated credentials ---------------------------------------------------
# special = false avoids every character that is reserved in a URI
# (":", "/", "@", "?", "#", ...), so the generated value can be embedded
# directly into a connection-string secret below with no escaping needed.

resource "random_password" "db_master" {
  length  = 32
  special = false
}

resource "random_password" "redis_auth" {
  length  = 32
  special = false
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

# --- DATABASE_URL -------------------------------------------------------------

resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${local.name_prefix}/database-url"
  description             = "Prisma DATABASE_URL connection string for the DevPulse RDS instance."
  recovery_window_in_days = var.secrets_recovery_window_days

  tags = {
    Name = "${local.name_prefix}-database-url"
  }
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = "postgresql://${var.db_username}:${random_password.db_master.result}@${aws_db_instance.main.endpoint}/${var.db_name}"
}

# --- REDIS_URL ------------------------------------------------------------------
# rediss:// (double "s") is the TLS-enabled scheme ioredis expects - required
# since redis.tf sets transit_encryption_enabled = true whenever an auth
# token is configured. The empty username before the colon is the standard
# form for Redis's default-user AUTH-token authentication.

resource "aws_secretsmanager_secret" "redis_url" {
  name                    = "${local.name_prefix}/redis-url"
  description             = "REDIS_URL connection string, including the AUTH token, for the DevPulse ElastiCache replication group."
  recovery_window_in_days = var.secrets_recovery_window_days

  tags = {
    Name = "${local.name_prefix}-redis-url"
  }
}

resource "aws_secretsmanager_secret_version" "redis_url" {
  secret_id     = aws_secretsmanager_secret.redis_url.id
  secret_string = "rediss://:${random_password.redis_auth.result}@${aws_elasticache_replication_group.main.primary_endpoint_address}:6379"
}

# --- JWT_SECRET ------------------------------------------------------------------

resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "${local.name_prefix}/jwt-secret"
  description             = "Signing secret for application-issued JWTs."
  recovery_window_in_days = var.secrets_recovery_window_days

  tags = {
    Name = "${local.name_prefix}-jwt-secret"
  }
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = random_password.jwt_secret.result
}

# --- OPENAI_API_KEY ------------------------------------------------------------

resource "aws_secretsmanager_secret" "openai_api_key" {
  name                    = "${local.name_prefix}/openai-api-key"
  description             = "OpenAI API key used for AI-generated insights and weekly report narratives."
  recovery_window_in_days = var.secrets_recovery_window_days

  tags = {
    Name = "${local.name_prefix}-openai-api-key"
  }
}

resource "aws_secretsmanager_secret_version" "openai_api_key" {
  secret_id     = aws_secretsmanager_secret.openai_api_key.id
  secret_string = var.openai_api_key
}

# --- GitHub OAuth (client id, client secret, webhook secret) ------------------
# One JSON secret rather than three, since all three are issued together by
# the same GitHub OAuth App and are only ever rotated together. ecs.tf pulls
# individual keys out of it into separate environment variables using
# Secrets Manager's ":<json-key>::" ARN suffix syntax.

resource "aws_secretsmanager_secret" "github_oauth" {
  name                    = "${local.name_prefix}/github-oauth"
  description             = "GitHub OAuth App credentials: client_id, client_secret, webhook_secret."
  recovery_window_in_days = var.secrets_recovery_window_days

  tags = {
    Name = "${local.name_prefix}-github-oauth"
  }
}

resource "aws_secretsmanager_secret_version" "github_oauth" {
  secret_id = aws_secretsmanager_secret.github_oauth.id
  secret_string = jsonencode({
    client_id      = var.github_client_id
    client_secret  = var.github_client_secret
    webhook_secret = var.github_webhook_secret
  })
}
