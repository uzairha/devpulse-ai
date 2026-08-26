# ECS cluster, task definitions and services.
#
# Three independent Fargate services - backend (API), frontend (nginx/SPA)
# and worker (BullMQ background jobs) - matching the three processes the
# application already runs as in server/Dockerfile and docker-compose.yml's
# "full" profile. The worker reuses the backend's image with its command
# overridden, exactly as the local Compose stack does.

locals {
  # The public URL the application is reachable at, used both as the
  # CLIENT_URL the backend sends CORS/redirect responses to and as the base
  # for the GitHub OAuth callback URL.
  #
  # Host and scheme are decided independently, because they answer different
  # questions. The host falls back to the ALB's own DNS name so the stack is
  # internally consistent before a real domain exists (GitHub OAuth itself
  # still needs a stable domain - see var.app_domain). The scheme follows
  # whether a certificate is actually configured, not whether a domain is: a
  # domain with no certificate is still served over plain HTTP, and claiming
  # https:// there would hand GitHub a callback URL the ALB cannot answer on.
  app_scheme   = var.certificate_arn != "" ? "https" : "http"
  app_host     = var.app_domain != "" ? var.app_domain : aws_lb.main.dns_name
  app_base_url = "${local.app_scheme}://${local.app_host}"
}

resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = var.container_insights_enabled ? "enabled" : "disabled"
  }

  tags = {
    Name = "${local.name_prefix}-cluster"
  }
}

# ARM64 (Graviton): both base images (node:22-alpine, nginx-unprivileged)
# publish multi-arch manifests, and Fargate bills ARM64 tasks at a lower
# per-vCPU/GB rate than the x86_64 equivalent for identical cpu/memory
# settings - a straightforward saving with no architecture-specific code in
# this application.
locals {
  runtime_platform = {
    cpu_architecture        = "ARM64"
    operating_system_family = "LINUX"
  }
}

# ---------------------------------------------------------------------------
# Backend (API)
# ---------------------------------------------------------------------------

resource "aws_ecs_task_definition" "backend" {
  family                   = "${local.name_prefix}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.backend_cpu
  memory                   = var.backend_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.backend_task.arn

  runtime_platform {
    cpu_architecture        = local.runtime_platform.cpu_architecture
    operating_system_family = local.runtime_platform.operating_system_family
  }

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = var.backend_image != "" ? var.backend_image : "${aws_ecr_repository.backend.repository_url}:${var.bootstrap_image_tag}"
      essential = true

      portMappings = [
        { containerPort = var.backend_container_port, protocol = "tcp" }
      ]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = tostring(var.backend_container_port) },
        { name = "CLIENT_URL", value = local.app_base_url },
        { name = "TRUST_PROXY_HOPS", value = "1" },
        { name = "RUN_WORKERS_IN_API", value = "false" },
        { name = "GITHUB_CALLBACK_URL", value = "${local.app_base_url}/api/auth/github/callback" },
        { name = "WEBHOOK_BASE_URL", value = local.app_base_url },
      ]

      # JSON-key selectors (":<key>::") pull a single field out of the shared
      # GitHub OAuth secret - see secrets.tf's github_oauth resource.
      secrets = [
        { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
        { name = "REDIS_URL", valueFrom = aws_secretsmanager_secret.redis_url.arn },
        { name = "JWT_SECRET", valueFrom = aws_secretsmanager_secret.jwt_secret.arn },
        { name = "OPENAI_API_KEY", valueFrom = aws_secretsmanager_secret.openai_api_key.arn },
        { name = "GITHUB_CLIENT_ID", valueFrom = "${aws_secretsmanager_secret.github_oauth.arn}:client_id::" },
        { name = "GITHUB_CLIENT_SECRET", valueFrom = "${aws_secretsmanager_secret.github_oauth.arn}:client_secret::" },
        { name = "GITHUB_WEBHOOK_SECRET", valueFrom = "${aws_secretsmanager_secret.github_oauth.arn}:webhook_secret::" },
      ]

      healthCheck = {
        command     = ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:${var.backend_container_port}/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 15
      }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = {
    Name = "${local.name_prefix}-backend-task"
  }
}

resource "aws_ecs_service" "backend" {
  name            = "${local.name_prefix}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.backend_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = local.ecs_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = local.ecs_assign_public_ip
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = var.backend_container_port
  }

  # The target group must exist behind a listener before ECS tries to
  # register tasks against it.
  depends_on = [aws_lb_listener.http]

  tags = {
    Name = "${local.name_prefix}-backend-service"
  }
}

# ---------------------------------------------------------------------------
# Frontend (nginx / SPA)
# ---------------------------------------------------------------------------

resource "aws_ecs_task_definition" "frontend" {
  family                   = "${local.name_prefix}-frontend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.frontend_cpu
  memory                   = var.frontend_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  # No task_role_arn: nginx serves static files only and calls no AWS API.

  runtime_platform {
    cpu_architecture        = local.runtime_platform.cpu_architecture
    operating_system_family = local.runtime_platform.operating_system_family
  }

  container_definitions = jsonencode([
    {
      name      = "frontend"
      image     = var.frontend_image != "" ? var.frontend_image : "${aws_ecr_repository.frontend.repository_url}:${var.bootstrap_image_tag}"
      essential = true

      portMappings = [
        { containerPort = var.frontend_container_port, protocol = "tcp" }
      ]

      healthCheck = {
        command     = ["CMD-SHELL", "wget -q --spider http://127.0.0.1:${var.frontend_container_port}/healthz || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 5
      }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.frontend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = {
    Name = "${local.name_prefix}-frontend-task"
  }
}

resource "aws_ecs_service" "frontend" {
  name            = "${local.name_prefix}-frontend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = var.frontend_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = local.ecs_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = local.ecs_assign_public_ip
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend"
    container_port   = var.frontend_container_port
  }

  depends_on = [aws_lb_listener.http]

  tags = {
    Name = "${local.name_prefix}-frontend-service"
  }
}

# ---------------------------------------------------------------------------
# Worker (BullMQ background jobs)
# ---------------------------------------------------------------------------
# Same image as backend, command overridden - see server/Dockerfile. Not
# behind the ALB: nothing addresses this service over HTTP, so it has no
# target group, no load_balancer block and no container healthCheck (mirrors
# docker-compose.yml, which disables the inherited HTTP healthcheck for the
# same reason).

resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.name_prefix}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.worker_task.arn

  runtime_platform {
    cpu_architecture        = local.runtime_platform.cpu_architecture
    operating_system_family = local.runtime_platform.operating_system_family
  }

  container_definitions = jsonencode([
    {
      name      = "worker"
      image     = var.backend_image != "" ? var.backend_image : "${aws_ecr_repository.backend.repository_url}:${var.bootstrap_image_tag}"
      command   = ["node", "src/worker.js"]
      essential = true

      environment = [
        { name = "NODE_ENV", value = "production" },
      ]

      secrets = [
        { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
        { name = "REDIS_URL", valueFrom = aws_secretsmanager_secret.redis_url.arn },
        { name = "JWT_SECRET", valueFrom = aws_secretsmanager_secret.jwt_secret.arn },
        { name = "OPENAI_API_KEY", valueFrom = aws_secretsmanager_secret.openai_api_key.arn },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.worker.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = {
    Name = "${local.name_prefix}-worker-task"
  }
}

resource "aws_ecs_service" "worker" {
  name            = "${local.name_prefix}-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.worker_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = local.ecs_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = local.ecs_assign_public_ip
  }

  tags = {
    Name = "${local.name_prefix}-worker-service"
  }
}
