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

   # Hashed assets first, kept forever, so a client still holding the old
   # index.html can fetch the chunks it references.
   aws s3 sync dist/assets/ s3://<YOUR_BUCKET_NAME>/assets --cache-control "public, max-age=31536000, immutable"

   # Then the shell and public files. --delete is scoped so it cannot remove
   # the assets synced above.
   aws s3 sync dist/ s3://<YOUR_BUCKET_NAME> --delete --exclude "assets/*" --cache-control "public, max-age=0, must-revalidate"
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

### If your Amplify build is already failing

A build that dies during provisioning with:

```
CustomerError: Cannot read 'next' version in package.json.
If you are using monorepo, please ensure that AMPLIFY_MONOREPO_APP_ROOT is set correctly.
```

is **not** a problem with the repository. The build never got as far as
`amplify.yml`. The app was created in Amplify as a Next.js SSR app
(`platform: WEB_COMPUTE`), so Amplify looks for a `next` dependency during
provisioning. ShareHub is a Vite SPA and has none.

It is also not a monorepo problem, so setting `AMPLIFY_MONOREPO_APP_ROOT` will
not help. Switch the app to static hosting instead:

```bash
./aws/amplify-configure.sh <APP_ID> <REGION>
```

That script sets `platform` to `WEB` and installs the SPA rewrite rule. Find
`<APP_ID>` in the Amplify console URL (`.../apps/d1a2b3c4d5e6f7/...`).

To do it by hand in the console instead: **App settings > General settings >
Edit**, set **Platform** to **Web**, save, then redeploy.

Either way, trigger a fresh build afterwards — the failed one produced no
artifacts:

```bash
aws amplify start-job --app-id <APP_ID> --branch-name main --job-type RELEASE --region <REGION>
```

### Creating the app from scratch

1. Push your repository to GitHub / GitLab / Bitbucket.
2. Open the **[AWS Amplify Console](https://console.aws.amazon.com/amplify)**.
3. Click **Create new app** > **Host web app**.
4. Connect the repository (`mraaziqp/CommunityMarketPlace`) and the `main` branch.
5. Confirm the detected framework is **Web** / **Vite**, not Next.js. This is the
   single setting that causes the provisioning failure above.
6. Amplify picks up [`amplify.yml`](./amplify.yml) for the build and headers.
7. **Do not add environment variables.** The app reads none, and every value
   passed to a Vite build is readable in the shipped bundle. See
   [`.env.production.example`](./.env.production.example).
8. Click **Save and deploy**.

### Required: SPA rewrite rule

Amplify serves files, so `/admin` and any other deep link 404s until every
non-asset path is rewritten to the app shell. `aws/amplify-configure.sh` sets
this for you. To add it manually under **Hosting > Rewrites and redirects**:

Source (copy this verbatim — the escaping matters):

```
</^[^.]+$|\.(?!(css|gif|ico|jpg|jpeg|js|mjs|png|txt|svg|webp|avif|woff|woff2|ttf|eot|map|json|webmanifest)$)([^.]+$)/>
```

Target: `/index.html` &nbsp;&nbsp; Type: `200 (Rewrite)`

Without it the PWA still loads at `/`, but a refresh on any other path fails.

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

   The build itself needs no application secrets — only the AWS credentials above.
3. Once set, every push to `main` will automatically build the app, upload assets to S3 with cache controls, and invalidate CloudFront.
