terraform {
  backend "gcs" {
    bucket  = "feup-ds-tf-state"
    prefix  = "terraform/state"
  }
}

#############################
# Cloud SQL (Postgres)
#############################

resource "google_sql_database_instance" "db" {
  name             = "my-postgres-instance"
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    tier    = "db-f1-micro"
    # ENTERPRISE edition might be overkill for dev/academic use, but kept as per original.
    edition = "ENTERPRISE" 

    ip_configuration {
      ipv4_enabled    = false
      private_network = "projects/${var.project_id}/global/networks/default"
    }

    backup_configuration {
      enabled = true
    }
  }

  deletion_protection = true
}

resource "google_sql_database" "mydb" {
  name     = "mydatabase"
  instance = google_sql_database_instance.db.name
}

resource "google_sql_user" "postgres" {
  name     = "postgres"
  instance = google_sql_database_instance.db.name
  password = var.db_password
  depends_on = [google_sql_database_instance.db]
}

#############################
# Secret Manager for DB password
#############################

resource "google_secret_manager_secret" "db_password" {
  secret_id = "db-password"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "db_password_version" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = var.db_password
}

#############################
# VPC Connector (for Cloud Run → Cloud SQL/Memorystore)
#############################

resource "google_vpc_access_connector" "connector" {
  name           = "vpc-connector"
  region         = var.region
  network        = "default"
  ip_cidr_range  = "10.8.0.0/28"
  min_throughput = 200
  max_throughput = 300
}

#############################
# Dedicated Service Account for Cloud Run
#############################

resource "google_service_account" "cloud_run_sa" {
  account_id   = "cloud-run-sa"
  display_name = "Cloud Run Service Account"
}

# Grant Cloud SQL Client role
resource "google_project_iam_member" "run_sa_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = google_service_account.cloud_run_sa.member
}

# Grant Secret Manager access
resource "google_project_iam_member" "run_sa_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = google_service_account.cloud_run_sa.member
}

# Grant access to the Pub/Sub service account key secret
resource "google_secret_manager_secret_iam_member" "pubsub_key_access" {
  project   = var.project_id
  secret_id = "pubsub-service-account-key"
  role      = "roles/secretmanager.secretAccessor"
  member    = google_service_account.cloud_run_sa.member
}

# Enable required APIs
resource "google_project_service" "sqladmin" {
  project = var.project_id
  service = "sqladmin.googleapis.com"
  disable_on_destroy = false
}

# Enable Secret Manager API
resource "google_project_service" "secretmanager" {
  project = var.project_id
  service = "secretmanager.googleapis.com"
  disable_on_destroy = false
}

# Enable Pub/Sub API in the main project
resource "google_project_service" "pubsub" {
  project = var.project_id
  service = "pubsub.googleapis.com"
  disable_on_destroy = false
}

# NOTE: Ask the ds-2526-mips project admin to grant Pub/Sub permissions to your service account:
# gcloud projects add-iam-policy-binding ds-2526-mips \
#   --member="serviceAccount:cloud-run-sa@feup-ds.iam.gserviceaccount.com" \
#   --role="roles/pubsub.subscriber"
#
# gcloud projects add-iam-policy-binding ds-2526-mips \
#   --member="serviceAccount:cloud-run-sa@feup-ds.iam.gserviceaccount.com" \
#   --role="roles/pubsub.viewer"

#############################
# Cloud Run Service (Backend API)
#############################

resource "google_cloud_run_v2_service" "backend" {
  name     = var.backend_service_name
  location = var.region
  deletion_protection = false

  template {
    timeout = "300s"

    containers {
      image = var.backend_image

      env {
        name  = "DB_USER"
        value = google_sql_user.postgres.name
      }

      env {
        name = "DB_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_password.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "DB_NAME"
        value = google_sql_database.mydb.name
      }

      env {
        name  = "DB_CONNECTION_NAME"
        value = google_sql_database_instance.db.connection_name
      }
      
      env {
        name  = "REDIS_HOST"
        value = google_redis_instance.redis.host
      }
      
      env {
        name  = "REDIS_PORT"
        value = "6379"
      }
      
      env {
        name = "REDIS_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.redis_password.secret_id
            version = "latest"
          }
        }
      }
      
      env {
        name  = "JUMPSELLER_BASE_URL"
        value = "https://api.jumpseller.com/v1"
      }

      env {
        name  = "POSTGRES_TYPE"
        value = "postgres"
      }
      
      env {
        name  = "POSTGRES_HOST"
        value = google_sql_database_instance.db.private_ip_address
      }
      
      env {
        name  = "POSTGRES_PORT"
        value = "5432"
      }
      
      env {
        name  = "POSTGRES_USER"
        value = google_sql_user.postgres.name
      }
      
      env {
        name = "POSTGRES_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_password.secret_id
            version = "latest"
          }
        }
      }
      
      env {
        name  = "POSTGRES_DATABASE"
        value = google_sql_database.mydb.name
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }

      env {
        name  = "PUBSUB_PROJECT"
        value = var.pubsub_project_id
      }

      env {
        name  = "SENTRY_DSN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.sentry_dsn.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "SENTRY_ENVIRONMENT"
        value = "production"
      }

      env {
        name  = "GOOGLE_APPLICATION_CREDENTIALS"
        value = "/var/run/secrets/cloud.google.com/service-account-key.json"
      }

      # Volume mount for service account secret
      volume_mounts {
        name       = "gcp-secret"
        mount_path = "/var/run/secrets/cloud.google.com"
      }

      startup_probe {
        initial_delay_seconds = 30
        timeout_seconds       = 5
        period_seconds        = 10
        failure_threshold     = 6
        http_get {
          path = "/api/v1/health"
          port = 8080
        }
      }
      
      liveness_probe {
        http_get {
          path = "/api/v1/health"
          port = 8080
        }
      }
    }

    # Volume for GCP service account secret from Secret Manager
    volumes {
      name = "gcp-secret"
      secret {
        secret = "pubsub-service-account-key"
        items {
          version = "latest"
          path    = "service-account-key.json"
        }
      }
    }

    service_account = google_service_account.cloud_run_sa.email

    scaling {
      min_instance_count = 1  # Keep at least 1 instance running to receive Pub/Sub messages
      max_instance_count = 10
    }

    vpc_access {
      connector = "projects/${var.project_id}/locations/${var.region}/connectors/${google_vpc_access_connector.connector.name}"
      egress    = "PRIVATE_RANGES_ONLY"
    }

    annotations = {
      "run.googleapis.com/cloudsql-instances" = google_sql_database_instance.db.connection_name
    }
  }

  depends_on = [
    google_vpc_access_connector.connector,
    google_sql_database_instance.db,
    google_secret_manager_secret_version.db_password_version,
    google_secret_manager_secret_version.redis_password_version,
    google_secret_manager_secret_version.sentry_dsn_version
  ]
}

#############################
# Cloud Run Service (Frontend)
#############################

resource "google_cloud_run_v2_service" "frontend" {
  name     = var.frontend_service_name
  location = var.region
  deletion_protection = false

  template {
    timeout = "300s"

    containers {
      image = var.frontend_image

      env {
        name  = "VITE_API_RECOMMENDATIONS"
        value = "${google_cloud_run_v2_service.backend.uri}/api/v1/recommendations/1"
      }

      env {
        name  = "VITE_API_URL"
        value = google_cloud_run_v2_service.backend.uri
      }

      ports {
        container_port = 3000
      }

      startup_probe {
        initial_delay_seconds = 10
        timeout_seconds = 3
        period_seconds = 10
        failure_threshold = 30
        http_get {
          path = "/"
          port = 3000
        }
      }

      liveness_probe {
        http_get {
          path = "/"
          port = 3000
        }
      }
    }
  }

  depends_on = [
    google_cloud_run_v2_service.backend
  ]
}

#############################
# IAM: Allow public access to Cloud Run Backend
#############################

resource "google_cloud_run_v2_service_iam_binding" "public_access" {
  project  = var.project_id
  location = google_cloud_run_v2_service.backend.location
  name     = google_cloud_run_v2_service.backend.name

  role    = "roles/run.invoker"
  members = ["allUsers"]
}

resource "google_cloud_run_v2_service_iam_binding" "frontend_public_access" {
  project  = var.project_id
  location = google_cloud_run_v2_service.frontend.location
  name     = google_cloud_run_v2_service.frontend.name

  role    = "roles/run.invoker"
  members = ["allUsers"]
}

#############################
# Cloud Memorystore (Redis) - COST OPTIMIZATION
#############################

resource "google_project_service" "redis" {
  project            = var.project_id
  service            = "redis.googleapis.com"
  disable_on_destroy = false
  
  depends_on = [google_project_service.secretmanager]
}

resource "google_redis_instance" "redis" {
  name           = "my-redis-instance"
  region         = var.region
  
  # COST SAVING: Minimum size for BASIC tier is 1GB. To save money, this is the lowest you can go.
  tier           = "BASIC" 
  memory_size_gb = 1 

  authorized_network = "projects/${var.project_id}/global/networks/default"
  connect_mode       = "DIRECT_PEERING"

  auth_enabled = true
  redis_version = "REDIS_7_2"
  
  persistence_config {
    persistence_mode = "RDB" 
  }

  redis_configs = {
    "maxmemory-policy" = "allkeys-lru"
  }

  depends_on = [
    google_project_service.redis,
    google_vpc_access_connector.connector
  ]
}

#############################
# Secret Manager for Redis password
#############################

resource "google_secret_manager_secret" "redis_password" {
  secret_id = "redis-password"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "redis_password_version" {
  secret      = google_secret_manager_secret.redis_password.id
  secret_data = google_redis_instance.redis.auth_string

  depends_on = [google_redis_instance.redis]
}

#############################
# Secret Manager for Sentry DSN
#############################

resource "google_secret_manager_secret" "sentry_dsn" {
  secret_id = "sentry-dsn"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "sentry_dsn_version" {
  secret      = google_secret_manager_secret.sentry_dsn.id
  secret_data = var.sentry_dsn
}


#############################
# Cloud Run JOB (Surprise Module) - ARCHITECTURE CHANGE
#############################

resource "google_cloud_run_v2_job" "surprise_job" {
  name     = var.surprise_service_name
  location = var.region

  template {

    task_count = 1

    template {
      containers {
        image = var.surprise_image

        # Redis
        env {
          name  = "REDIS_HOST"
          value = google_redis_instance.redis.host
        }
        env {
          name  = "REDIS_PORT"
          value = "6379"
        }
        env {
          name = "REDIS_PASSWORD"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.redis_password.secret_id
              version = "latest"
            }
          }
        }

        # PostgreSQL
        env {
          name  = "PG_HOST"
          value = google_sql_database_instance.db.private_ip_address
        }
        env {
          name  = "PG_PORT"
          value = "5432"
        }
        env {
          name  = "PG_USER"
          value = google_sql_user.postgres.name
        }
        env {
          name = "PG_PASSWORD"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.db_password.secret_id
              version = "latest"
            }
          }
        }
        env {
          name  = "PG_NAME"
          value = google_sql_database.mydb.name
        }

        env {
          name  = "APP_ENV"
          value = "production"
        }

        env {
          name  = "SENTRY_DSN"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.sentry_dsn.secret_id
              version = "latest"
            }
          }
        }

        env {
          name  = "SENTRY_ENVIRONMENT"
          value = "production"
        }
      }

      service_account = google_service_account.cloud_run_sa.email

      vpc_access {
        connector = "projects/${var.project_id}/locations/${var.region}/connectors/${google_vpc_access_connector.connector.name}"
        egress    = "PRIVATE_RANGES_ONLY"
      }
    }
  }

  depends_on = [
    google_vpc_access_connector.connector,
    google_sql_database_instance.db,
    google_redis_instance.redis,
    google_secret_manager_secret_version.db_password_version,
    google_secret_manager_secret_version.redis_password_version,
    google_secret_manager_secret_version.sentry_dsn_version
  ]
}


# --- Cloud Scheduler and IAM Setup for Daily Trigger ---

#############################
# Enable Cloud Scheduler API
#############################

resource "google_project_service" "cloudscheduler" {
  project            = var.project_id
  service            = "cloudscheduler.googleapis.com"
  disable_on_destroy = false
}

#############################
# Cloud Scheduler Job (Daily 2 AM Trigger)
#############################

resource "google_cloud_scheduler_job" "surprise_scheduler" {
  name        = "surprise-daily-trigger"
  description = "Triggers the Cloud Run Job for recommendation generation daily at 2 AM."
  region      = var.region

  schedule = "0 2 * * *"
  time_zone = "Europe/Lisbon"

  attempt_deadline = "1800s"

  http_target {
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${google_cloud_run_v2_job.surprise_job.name}:run"
    http_method = "POST"

    oauth_token {
      service_account_email = google_service_account.cloud_run_sa.email
    }
  }

  depends_on = [
    google_cloud_run_v2_job.surprise_job,
    google_project_service.cloudscheduler
  ]
}

resource "google_project_iam_member" "run_sa_job_invoker" {
  project = var.project_id
  role    = "roles/run.invoker"
  member  = google_service_account.cloud_run_sa.member
}

#############################
# Outputs
#############################

output "service_url" {
  description = "The URL of the deployed Cloud Run service (Backend API)."
  value       = google_cloud_run_v2_service.backend.uri
}

output "db_connection_name" {
  value = google_sql_database_instance.db.connection_name
}

output "db_name" {
  value = google_sql_database.mydb.name
}

output "surprise_job_name" {
  description = "The name of the deployed 'surprise' Cloud Run Job."
  value       = google_cloud_run_v2_job.surprise_job.name
}

output "db_private_ip" {
  value = google_sql_database_instance.db.private_ip_address
}

output "frontend_url" {
  description = "The URL of the deployed Cloud Run service (Frontend)."
  value       = google_cloud_run_v2_service.frontend.uri
}

variable "frontend_service_name" {
  description = "The name for the frontend Cloud Run service."
  type        = string
  default     = "frontend-service"
}

variable "frontend_image" {
  description = "Container image to deploy for frontend (including tag)."
  type        = string
  default     = "europe-west3-docker.pkg.dev/feup-ds/my-repo/frontend:latest"
}