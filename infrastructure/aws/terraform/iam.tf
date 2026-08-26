# IAM roles for ECS.
#
# Two distinct role types, per AWS's own separation:
#   - Execution role: used by the ECS agent itself, before the container
#     starts, to pull the image from ECR, write the initial log stream and
#     resolve `secrets` block values from Secrets Manager into environment
#     variables. The application code never assumes this role.
#   - Task role: assumed by the application code running inside the
#     container, for any AWS API calls the app makes directly (S3 uploads -
#     see s3.tf). Kept separate from the execution role
#     so a compromised application process cannot pull other images or read
#     arbitrary secrets through its own role.
#
# The frontend service gets no task role: nginx serves static files and never
# calls an AWS API, so there is nothing to grant it.

data "aws_iam_policy_document" "ecs_tasks_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# --- Execution role: shared by all three services ---------------------------
# All three need the identical capability set (pull from ECR, write logs,
# resolve the same family of secrets), so one role is genuinely least-privilege
# here - three copies of the same policy would not reduce blast radius.

resource "aws_iam_role" "ecs_task_execution" {
  name               = "${local.name_prefix}-ecs-execution-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume_role.json

  tags = {
    Name = "${local.name_prefix}-ecs-execution-role"
  }
}

# AWS-managed policy covering ECR image pulls and writing to the log group
# this task definition specifies. This is the standard, narrowly-scoped policy
# AWS documents for exactly this role - reimplementing it by hand would only
# reproduce the same permissions with more room for a mistake.
resource "aws_iam_role_policy_attachment" "ecs_task_execution_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Secrets Manager access is scoped to exactly the five secret ARNs this
# application uses (see secrets.tf), not secretsmanager:* / resource "*".
data "aws_iam_policy_document" "ecs_task_execution_secrets" {
  statement {
    sid     = "ReadApplicationSecrets"
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      aws_secretsmanager_secret.database_url.arn,
      aws_secretsmanager_secret.redis_url.arn,
      aws_secretsmanager_secret.jwt_secret.arn,
      aws_secretsmanager_secret.openai_api_key.arn,
      aws_secretsmanager_secret.github_oauth.arn,
    ]
  }
}

resource "aws_iam_role_policy" "ecs_task_execution_secrets" {
  name   = "${local.name_prefix}-ecs-execution-secrets"
  role   = aws_iam_role.ecs_task_execution.id
  policy = data.aws_iam_policy_document.ecs_task_execution_secrets.json
}

# --- Task roles: backend and worker -----------------------------------------
# The roles themselves are declared here since ecs.tf's task definitions
# reference them; the S3 policy attached to each is declared in s3.tf, next
# to the bucket it grants access to.

resource "aws_iam_role" "backend_task" {
  name               = "${local.name_prefix}-backend-task-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume_role.json

  tags = {
    Name = "${local.name_prefix}-backend-task-role"
  }
}

resource "aws_iam_role" "worker_task" {
  name               = "${local.name_prefix}-worker-task-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume_role.json

  tags = {
    Name = "${local.name_prefix}-worker-task-role"
  }
}
