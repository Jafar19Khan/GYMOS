variable "aws_region" {
  description = "AWS region for the GYMOS evaluation deployment."
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Prefix for resource names and tags."
  type        = string
  default     = "gymos"
}

variable "instance_type" {
  description = "EC2 size. t3.medium (4 GiB) is the starting point for Node.js build plus PostgreSQL."
  type        = string
  default     = "t3.medium"
  validation {
    condition     = contains(["t3.small", "t3.medium", "t3.large"], var.instance_type)
    error_message = "Choose t3.small, t3.medium, or t3.large. t3.micro is intentionally excluded because 1 GiB is too small for a reliable Next.js build plus PostgreSQL."
  }
}

variable "root_volume_size" {
  description = "Encrypted gp3 root volume in GiB."
  type        = number
  default     = 30
  validation {
    condition     = var.root_volume_size >= 20 && var.root_volume_size <= 100
    error_message = "root_volume_size must be between 20 and 100 GiB."
  }
}

variable "availability_zone" {
  description = "Optional AZ override. Leave empty to select the first available AZ in the region."
  type        = string
  default     = ""
}
