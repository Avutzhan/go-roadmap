# 🧠 2. Platform Engineering, GitOps & IaC

## 📌 Что это такое

Platform Engineering — создание Internal Developer Platform (IDP), которая позволяет продуктовым командам деплоить, мониторить и масштабировать сервисы самостоятельно, без ожидания DevOps. GitOps — Git как single source of truth для инфраструктурного состояния.

---

## 🔬 Глубокий разбор (Senior/Staff)

### GitOps: принципы и инструменты

```
Принцип GitOps:
1. Весь код инфраструктуры — в Git репо
2. Система в кластере = состояние в Git
3. Автоматическое применение при merge в main
4. Любое расхождение — автоматически исправляется (drift reconciliation)

Инструменты:
- ArgoCD: GUI + sync из Git → K8s
- Flux: GitOps toolkit, более гибкий, Helm + Kustomize
```

```yaml
# ArgoCD Application manifest
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: payment-service
  namespace: argocd
spec:
  project: production
  source:
    repoURL: https://github.com/company/k8s-manifests
    targetRevision: HEAD
    path: services/payment-service
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true      # удалять ресурсы удалённые из Git
      selfHeal: true   # восстанавливать при ручных изменениях в кластере
    syncOptions:
    - CreateNamespace=true
```

### Terraform для Go-сервисов: типичный стек

```hcl
# infrastructure/main.tf — RDS + EKS + S3 для Go-сервиса

terraform {
  required_version = ">= 1.6"
  backend "s3" {
    bucket = "company-terraform-state"
    key    = "payment-service/prod/terraform.tfstate"
    region = "us-east-1"
  }
}

# RDS PostgreSQL для payment-service
module "rds" {
  source = "./modules/rds"
  
  identifier        = "payment-service-prod"
  engine            = "postgres"
  engine_version    = "16.1"
  instance_class    = "db.r6g.large"
  allocated_storage = 100
  
  db_name  = "payments"
  username = "app_user"
  # Пароль из AWS Secrets Manager, не хардкод!
  password = data.aws_secretsmanager_secret_version.db_password.secret_string
  
  multi_az               = true    # HA
  deletion_protection    = true    # нельзя удалить случайно
  backup_retention_period = 7
  
  tags = {
    Service     = "payment-service"
    Environment = "prod"
    ManagedBy   = "terraform"
  }
}

# Output для использования в K8s secrets
output "db_endpoint" {
  value     = module.rds.endpoint
  sensitive = true
}
```

### Helm чарт для Go-сервиса

```yaml
# helm/payment-service/values.yaml
replicaCount: 3

image:
  repository: 123456789.dkr.ecr.us-east-1.amazonaws.com/payment-service
  tag: "latest"  # В CI заменяется на git SHA
  pullPolicy: IfNotPresent

resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "500m"

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

livenessProbe:
  httpGet:
    path: /health/live
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5

# PodDisruptionBudget — при rolling update минимум 2 реплики живые
pdb:
  enabled: true
  minAvailable: 2
```

### Internal Developer Platform (IDP): что это для Staff

```
Цель IDP: продуктовая команда может САМА:
- Создать новый сервис из шаблона (golden path)
- Деплоить в staging одной командой
- Видеть логи, метрики, трейсы в одном UI
- Управлять feature flags
- Делать rollback кнопкой

Инструменты:
- Backstage (Spotify) — Developer Portal
- Crossplane — K8s native IaC
- Port — Service Catalog
```

```go
// Пример: Go scaffolding tool для IDP
// team run: platform new-service --name=payment --lang=go --db=postgres
// Генерирует:
// - Dockerfile (multi-stage, distroless)
// - K8s manifests (Deployment, Service, HPA, PDB)
// - GitHub Actions CI/CD
// - Helm values.yaml
// - health check endpoints
// - Prometheus metrics middleware
```

---

## 🔥 Реальные боевые кейсы

- **Drift detection**: разработчик вручную изменил ConfigMap → ArgoCD откатил через 3 минуты → "GitOps prevents config drift"
- **Terraform state lock**: два инженера одновременно запустили `apply` → state lock через S3+DynamoDB предотвратил конфликт
- **Golden path**: новый сервис от `platform new-service` до первого деплоя в prod — 15 минут вместо 2 дней
- **Helm + GitOps**: обновление image tag через PR → автоматический деплой в staging → approval gate → prod

---

## 💬 Как отвечать на интервью

> "GitOps для меня — Git как единственный источник правды для инфраструктуры. ArgoCD или Flux автоматически синхронизируют кластер с Git и исправляют drift. Terraform управляет underlying инфрой (RDS, VPC, EKS). Для Staff-уровня важна Platform Engineering — создание Internal Developer Platform, которая даёт командам self-service: новый сервис из шаблона, автоматический CI/CD, единый observability. Это умножает velocity всей инженерной организации."

---

## ❓ Вопросы для интервью (Senior/Staff)

### В чём риск `selfHeal: true` в ArgoCD?

Если есть легитимная причина для временного ручного изменения (hotfix во время инцидента) — ArgoCD откатит его через несколько минут. Нужно либо приостанавливать sync, либо делать изменение через Git (что правильнее). Также: selfHeal требует правильного разграничения прав — ArgoCD должен иметь права применять, но не удалять критичные ресурсы.

### Как управлять секретами в GitOps (нельзя коммитить в Git)?

Варианты:
1. **Sealed Secrets** (Bitnami): шифруют secret в кластере, в Git хранится зашифрованный вариант
2. **External Secrets Operator**: читает из Vault/AWS SM, создаёт K8s Secret
3. **SOPS**: encrypt файлы секретов через age/PGP перед коммитом

### Как Terraform справляется с зависимостями между ресурсами?

Terraform строит граф зависимостей из `depends_on` и неявных ссылок (`module.rds.endpoint`). Применяет параллельно независимые ресурсы, последовательно — зависимые. `terraform plan` показывает что изменится. State файл записывает текущее состояние — без него Terraform не знает что уже создано.

---

## 📊 Итоговая шпаргалка

| Инструмент | Назначение |
|------------|-----------|
| ArgoCD / Flux | GitOps: синхронизация Git → K8s |
| Terraform | IaC: создание облачных ресурсов |
| Helm | K8s package manager: параметризованные manifests |
| Backstage | Developer Portal: Service Catalog, IDP |
| Sealed Secrets | Зашифрованные секреты в Git |
| External Secrets | Интеграция K8s с Vault/AWS SM |
| `terraform plan` | Preview изменений без применения |
| State file | Terraform's "база данных" текущего состояния |
