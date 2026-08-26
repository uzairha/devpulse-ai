# VPC, subnets and routing.
#
# Layout: N public subnets (ALB, and ECS tasks when enable_nat_gateway=false)
# and N private subnets (RDS, ElastiCache always; ECS tasks too when
# enable_nat_gateway=true), one pair per availability zone, N = var.az_count.

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  azs = slice(data.aws_availability_zones.available.names, 0, var.az_count)

  # /24s carved out of the /16 VPC CIDR: 10.0.0.0/24, 10.0.1.0/24, ... for
  # public subnets, continuing from where public leaves off for private, e.g.
  # with az_count=2: public 10.0.0.0/24, 10.0.1.0/24; private 10.0.2.0/24, 10.0.3.0/24.
  public_subnet_cidrs  = [for i in range(var.az_count) : cidrsubnet(var.vpc_cidr, 8, i)]
  private_subnet_cidrs = [for i in range(var.az_count) : cidrsubnet(var.vpc_cidr, 8, i + var.az_count)]

  # Where ECS tasks run, and whether they need a public IP to reach the
  # internet, is entirely determined by the NAT gateway toggle. See the
  # enable_nat_gateway variable description for the cost/architecture tradeoff.
  ecs_subnet_ids       = var.enable_nat_gateway ? aws_subnet.private[*].id : aws_subnet.public[*].id
  ecs_assign_public_ip = var.enable_nat_gateway ? false : true
}

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${local.name_prefix}-vpc"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-igw"
  }
}

# --- Public subnets ---------------------------------------------------------
# Host the ALB always, and ECS tasks when NAT is disabled.

resource "aws_subnet" "public" {
  count = var.az_count

  vpc_id                  = aws_vpc.main.id
  cidr_block              = local.public_subnet_cidrs[count.index]
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${local.name_prefix}-public-${local.azs[count.index]}"
    Tier = "public"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${local.name_prefix}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  count = var.az_count

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# --- Private subnets ---------------------------------------------------------
# Always host RDS and ElastiCache. Host ECS tasks too when NAT is enabled.

resource "aws_subnet" "private" {
  count = var.az_count

  vpc_id            = aws_vpc.main.id
  cidr_block        = local.private_subnet_cidrs[count.index]
  availability_zone = local.azs[count.index]

  tags = {
    Name = "${local.name_prefix}-private-${local.azs[count.index]}"
    Tier = "private"
  }
}

# One NAT Gateway (not one per AZ) to keep the fixed monthly cost as low as a
# NAT deployment can be - a single AZ's worth of NAT traffic is a non-issue at
# this application's scale, and losing one AZ's NAT path in an outage is an
# acceptable tradeoff for a portfolio-sized deployment. Created only when
# enable_nat_gateway is true.
resource "aws_eip" "nat" {
  count = var.enable_nat_gateway ? 1 : 0

  domain = "vpc"

  tags = {
    Name = "${local.name_prefix}-nat-eip"
  }
}

resource "aws_nat_gateway" "main" {
  count = var.enable_nat_gateway ? 1 : 0

  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public[0].id

  tags = {
    Name = "${local.name_prefix}-nat"
  }

  depends_on = [aws_internet_gateway.main]
}

# A single route table shared by every private subnet. When NAT is disabled
# this table has no default route at all - private subnets are then fully
# isolated from the internet, which is correct: RDS and ElastiCache never need
# outbound access, and ECS tasks have already moved to the public subnets.
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  dynamic "route" {
    for_each = var.enable_nat_gateway ? [1] : []
    content {
      cidr_block     = "0.0.0.0/0"
      nat_gateway_id = aws_nat_gateway.main[0].id
    }
  }

  tags = {
    Name = "${local.name_prefix}-private-rt"
  }
}

resource "aws_route_table_association" "private" {
  count = var.az_count

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}
