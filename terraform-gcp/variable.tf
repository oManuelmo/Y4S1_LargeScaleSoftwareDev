variable "project_id" {
  description = "The Google Cloud project ID."
  type        = string
  default     = "feup-ds"
}

variable "region" {
  description = "The region where resources will be deployed."
  type        = string
  default     = "europe-west3"
}

variable "backend_service_name" {
  description = "The name for the Cloud Run service."
  type        = string
  default     = "backend-service"
}

variable "surprise_service_name" {
  description = "The name for the surprise Cloud Run service."
  type        = string
  default     = "surprise-service"
}

variable "backend_image" {
  description = "Container image to deploy to Cloud Run (including tag)."
  type        = string
  default     = "europe-west3-docker.pkg.dev/feup-ds/my-repo/backend:latest"
}

variable "db_password" {
  description = "PostgreSQL database password"
  type        = string
  sensitive   = true
}

variable "surprise_image" {
  description = "The Docker image for the surprise service."
  type        = string
  default     = "europe-west3-docker.pkg.dev/feup-ds/my-repo/surprise:latest"
}

variable "sentry_dsn" {
  description = "Sentry DSN for error tracking"
  type        = string
  sensitive   = true
}

variable "pubsub_project_id" {
  description = "GCP Project ID for Pub/Sub"
  type        = string
  default     = "ds-2526-mips"
}