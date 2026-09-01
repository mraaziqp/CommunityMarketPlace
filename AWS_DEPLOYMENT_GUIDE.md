# AWS Deployment & Hosting Guide for CommunityMarketPlace

This guide provides step-by-step instructions for hosting the **CommunityMarketPlace** application on Amazon Web Services (AWS).

---

## Architecture Options Overview

| Hosting Option | Best For | AWS Services Used | Cost Profile |
| :--- | :--- | :--- | :--- |
| **Option 1: S3 + CloudFront (Recommended)** | Production SPA with global CDN & edge caching | S3, CloudFront OAC, Route 53, ACM | Very Low (~$0.50 - $2/mo for low-to-medium traffic) |
| **Option 2: AWS Amplify Hosting** | Fastest setup, 1-click continuous Git deployment | AWS Amplify Gen 2 Hosting | Free tier eligible, pay-as-you-go |
| **Option 3: Containerized (App Runner / ECS)** | Custom containers, proxying, or enterprise VPCs | App Runner / ECS Fargate, ECR, ALB | Moderate (~$5 - $25/mo) |

---

## Option 1: Deploy with AWS S3 + CloudFront (Recommended)

### Method A: 1-Click AWS CloudFormation Deployment

1. **Deploy the CloudFormation Stack via AWS CLI**:
   ```bash
   aws cloudformation deploy \
     --template-file aws/cloudformation-template.yml \
     --stack-name community-marketplace-prod \
     --parameter-overrides ProjectName=community-marketplace Environment=production \
     --capabilities CAPABILITY_IAM \
     --region us-east-1
   ```

2. **Retrieve the S3 Bucket Name and CloudFront Domain**:
   ```bash
   aws cloudformation describe-stacks \
     --stack-name community-marketplace-prod \
     --query "Stacks[0].Outputs" \
     --output table
   ```

3. **Build the Production Bundle and Upload**:
   ```bash
   npm ci
   npm run build

   # Sync root files (HTML, icons, manifests)
   aws s3 sync dist/ s3://<YOUR_BUCKET_NAME> --delete --cache-control "public, max-age=0, must-revalidate"

   # Sync immutable hashed JavaScript and CSS assets
   aws s3 sync dist/assets/ s3://<YOUR_BUCKET_NAME>/assets --delete --cache-control "public, max-age=31536000, immutable"
   ```

4. **Invalidate the CloudFront Cache**:
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id <YOUR_CLOUDFRONT_DISTRIBUTION_ID> \
     --paths "/*"
   ```

5. Access your live website at the `https://<YOUR_DISTRIBUTION_DOMAIN>.cloudfront.net`.

---

## Option 2: Deploy with AWS Amplify Hosting (1-Click Git Integration)

1. Push your repository to GitHub / GitLab / Bitbucket.
2. Open the **[AWS Amplify Console](https://console.aws.amazon.com/amplify)**.
3. Click **Create new app** > **Host web app**.
4. Connect your GitHub repository (`mraaziqp/CommunityMarketPlace`) and select the `main` branch.
5. AWS Amplify will automatically detect the provided [`amplify.yml`](./amplify.yml) file.
6. Under **Environment variables**, add:
   - `VITE_APP_URL`: Your Amplify app domain (or custom domain).
   - `VITE_GEMINI_API_KEY`: Your Gemini API key.
   - `DATABASE_URL`: Your Neon Postgres connection string.
7. Click **Save and deploy**. Amplify will build and deploy on every git push.

---

## Option 3: Deploy with Docker & AWS App Runner / ECS

### 1. Test Locally with Docker
```bash
# Build the Docker image
docker build -t community-marketplace:latest .

# Run container locally on port 8080
docker run -d -p 8080:80 --name marketplace-test community-marketplace:latest

# Open in browser: http://localhost:8080
```
Or using Docker Compose:
```bash
docker compose up -d
```

### 2. Push to Amazon Elastic Container Registry (ECR)
```bash
# Log in to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com

# Create repository if not already created
aws ecr create-repository --repository-name community-marketplace --region us-east-1

# Tag and push
docker tag community-marketplace:latest <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/community-marketplace:latest
docker push <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/community-marketplace:latest
```

### 3. Deploy to AWS App Runner
1. In the **AWS Management Console**, navigate to **AWS App Runner**.
2. Click **Create service** > **Container registry** > **Amazon ECR**.
3. Select your repository image `<AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/community-marketplace:latest`.
4. Configure port `80`.
5. Click **Create & Deploy**.

---

## Setting Up Custom Domain with SSL (HTTPS)

1. **Request a Certificate in AWS Certificate Manager (ACM)**:
   - Go to ACM in region `us-east-1` (CloudFront requires certificates in `us-east-1`).
   - Request a public certificate for `yourdomain.com` and `*.yourdomain.com`.
   - Complete DNS validation in Route 53 or your DNS provider.

2. **Associate with CloudFront**:
   - In CloudFront Distribution Settings, add `yourdomain.com` to **Alternate domain names (CNAMEs)**.
   - Select your ACM SSL Certificate.
   - In Route 53 (or your DNS registrar), create an `A` record with Alias pointing to your CloudFront distribution domain name.

---

## GitHub Actions Automated CI/CD Setup

To enable automated deployments on every `git push origin main`:

1. Go to your GitHub repository: **Settings** > **Secrets and variables** > **Actions**.
2. Add the following repository secrets:
   - `AWS_ACCESS_KEY_ID`: IAM user access key with S3 and CloudFront permissions.
   - `AWS_SECRET_ACCESS_KEY`: IAM user secret access key.
   - `AWS_REGION`: e.g. `us-east-1`.
   - `AWS_S3_BUCKET_NAME`: Your target S3 bucket name.
   - `AWS_CLOUDFRONT_DISTRIBUTION_ID`: Your CloudFront distribution ID.
   - `VITE_GEMINI_API_KEY`: Your Google Gemini API Key.
   - `DATABASE_URL`: Your Postgres connection string.
3. Once set, every push to `main` will automatically build the app, upload assets to S3 with cache controls, and invalidate CloudFront.
