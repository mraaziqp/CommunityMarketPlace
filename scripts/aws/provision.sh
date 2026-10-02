#!/usr/bin/env bash
# ==============================================================================
# One-time AWS setup for ShareHub production.
#
#   bash scripts/aws/provision.sh
#
# Creates (in AWS_REGION, default eu-west-2):
#   - Security groups  sharehub-web (80/443 public, 22 from your IP) and
#                      sharehub-db  (5432 from the web server only)
#   - RDS Postgres 16  sharehub-prod: db.t4g.micro, private, encrypted,
#                      7-day backups, deletion protection
#   - EC2              sharehub-prod: t4g.small Amazon Linux 2023 (arm64) with
#                      Node 22 + Caddy (automatic HTTPS) + systemd service
#   - Elastic IP       attached to the instance
#   - Route 53         APP_DOMAIN -> Elastic IP (replaces the old dangling CNAME)
#
# Approximate cost: US$30/month. Safe to re-run: existing resources are reused.
# Reads settings and writes outputs to ~/.sharehub/production.env.
# Afterwards run: bash scripts/aws/deploy.sh
# ==============================================================================
set -euo pipefail
export AWS_PAGER="" MSYS_NO_PATHCONV=1

ENV_FILE="${ENV_FILE:-$HOME/.sharehub/production.env}"
[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE"; exit 1; }
set -a; source "$ENV_FILE"; set +a

R="${AWS_REGION:-eu-west-2}"
DOMAIN="${APP_DOMAIN:?APP_DOMAIN not set}"
ZONE="${HOSTED_ZONE_ID:?HOSTED_ZONE_ID not set}"
KEY_NAME=sharehub-prod
KEY_FILE="$HOME/.sharehub/$KEY_NAME.pem"

save() { # save KEY VALUE into the env file (replacing any previous value)
  grep -v "^$1=" "$ENV_FILE" > "$ENV_FILE.tmp" || true
  echo "$1=$2" >> "$ENV_FILE.tmp"
  mv "$ENV_FILE.tmp" "$ENV_FILE"
  export "$1=$2"
}

echo "== Account: $(aws sts get-caller-identity --query Account --output text), region $R"
VPC=$(aws ec2 describe-vpcs --region "$R" --filters Name=isDefault,Values=true --query "Vpcs[0].VpcId" --output text)
MY_IP=$(curl -fsS https://checkip.amazonaws.com | tr -d '[:space:]')

# --- Secrets (generated once) -------------------------------------------------
gen() { node -e "console.log(require('crypto').randomBytes($1).toString('$2'))"; }
[ -n "${DB_PASSWORD:-}" ] || save DB_PASSWORD "$(gen 24 base64url)"
[ -n "${BOT_API_KEYS:-}" ] || save BOT_API_KEYS "shb_$(gen 32 base64url)"
[ -n "${BOT_WEBHOOK_SECRET:-}" ] || save BOT_WEBHOOK_SECRET "$(gen 32 hex)"

# --- Security groups ----------------------------------------------------------
sg_id() { aws ec2 describe-security-groups --region "$R" --filters Name=group-name,Values="$1" Name=vpc-id,Values="$VPC" --query "SecurityGroups[0].GroupId" --output text; }
WEB_SG=$(sg_id sharehub-web)
if [ "$WEB_SG" = "None" ]; then
  WEB_SG=$(aws ec2 create-security-group --region "$R" --vpc-id "$VPC" --group-name sharehub-web --description "ShareHub web server" --query GroupId --output text)
  aws ec2 authorize-security-group-ingress --region "$R" --group-id "$WEB_SG" --ip-permissions \
    "IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges=[{CidrIp=0.0.0.0/0}],Ipv6Ranges=[{CidrIpv6=::/0}]" \
    "IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=0.0.0.0/0}],Ipv6Ranges=[{CidrIpv6=::/0}]" >/dev/null
fi
# SSH only from the machine running this script (re-running updates it).
aws ec2 authorize-security-group-ingress --region "$R" --group-id "$WEB_SG" \
  --ip-permissions "IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges=[{CidrIp=$MY_IP/32,Description=admin-ssh}]" >/dev/null 2>&1 || true
DB_SG=$(sg_id sharehub-db)
if [ "$DB_SG" = "None" ]; then
  DB_SG=$(aws ec2 create-security-group --region "$R" --vpc-id "$VPC" --group-name sharehub-db --description "ShareHub Postgres (web server only)" --query GroupId --output text)
fi
aws ec2 authorize-security-group-ingress --region "$R" --group-id "$DB_SG" \
  --ip-permissions "IpProtocol=tcp,FromPort=5432,ToPort=5432,UserIdGroupPairs=[{GroupId=$WEB_SG}]" >/dev/null 2>&1 || true
save WEB_SG "$WEB_SG"; save DB_SG "$DB_SG"
echo "== Security groups: web $WEB_SG, db $DB_SG"

# --- Postgres (RDS) ------------------------------------------------------------
if ! aws rds describe-db-instances --region "$R" --db-instance-identifier sharehub-prod >/dev/null 2>&1; then
  echo "== Creating RDS Postgres (takes ~10 minutes)"
  aws rds create-db-instance --region "$R" \
    --db-instance-identifier sharehub-prod \
    --engine postgres --engine-version 16.15 \
    --db-instance-class db.t4g.micro \
    --allocated-storage 20 --storage-type gp3 --storage-encrypted \
    --master-username sharehub --master-user-password "$DB_PASSWORD" \
    --db-name sharehub \
    --vpc-security-group-ids "$DB_SG" --no-publicly-accessible \
    --backup-retention-period "${RDS_BACKUP_DAYS:-7}" --deletion-protection --copy-tags-to-snapshot \
    --tags Key=app,Value=sharehub >/dev/null
fi

# --- SSH key ------------------------------------------------------------------
if [ ! -f "$KEY_FILE" ]; then
  aws ec2 delete-key-pair --region "$R" --key-name "$KEY_NAME" >/dev/null 2>&1 || true
  # The Windows AWS CLI writes CRLF line endings, which OpenSSH cannot parse.
  aws ec2 create-key-pair --region "$R" --key-name "$KEY_NAME" --key-type ed25519 --query KeyMaterial --output text | tr -d '\r' > "$KEY_FILE"
  echo >> "$KEY_FILE"
  chmod 600 "$KEY_FILE"
fi

# --- EC2 instance ---------------------------------------------------------------
INSTANCE=$(aws ec2 describe-instances --region "$R" --filters Name=tag:Name,Values=sharehub-prod Name=instance-state-name,Values=pending,running,stopped \
  --query "Reservations[0].Instances[0].InstanceId" --output text)
if [ "$INSTANCE" = "None" ]; then
  AMI=$(aws ssm get-parameter --region "$R" --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64 --query Parameter.Value --output text)
  # Kept under ~/.sharehub (not /tmp) so the Windows AWS CLI can read it from Git Bash.
  USER_DATA="$HOME/.sharehub/user-data.sh"
  cat > "$USER_DATA" <<USERDATA
#!/bin/bash
set -euxo pipefail
dnf install -y tar xz
NODE_VER=\$(curl -fsSL https://nodejs.org/dist/index.json | python3 -c "import json,sys;print(next(r['version'] for r in json.load(sys.stdin) if r['version'].startswith('v22.')))")
curl -fsSL "https://nodejs.org/dist/\$NODE_VER/node-\$NODE_VER-linux-arm64.tar.xz" | tar -xJ -C /usr/local --strip-components=1
curl -fsSL "https://caddyserver.com/api/download?os=linux&arch=arm64" -o /usr/local/bin/caddy && chmod +x /usr/local/bin/caddy
useradd --system --home /opt/sharehub --shell /sbin/nologin sharehub || true
useradd --system --home /var/lib/caddy --shell /sbin/nologin caddy || true
mkdir -p /opt/sharehub/releases /etc/sharehub /etc/caddy /var/lib/caddy
chown -R caddy:caddy /var/lib/caddy
cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
  encode zstd gzip
  reverse_proxy 127.0.0.1:8787
}
CADDY
cat > /etc/systemd/system/caddy.service <<UNIT
[Unit]
Description=Caddy (HTTPS for ShareHub)
After=network-online.target
[Service]
User=caddy
Group=caddy
Environment=XDG_DATA_HOME=/var/lib/caddy XDG_CONFIG_HOME=/var/lib/caddy
ExecStart=/usr/local/bin/caddy run --config /etc/caddy/Caddyfile
AmbientCapabilities=CAP_NET_BIND_SERVICE
Restart=always
[Install]
WantedBy=multi-user.target
UNIT
cat > /etc/systemd/system/sharehub.service <<UNIT
[Unit]
Description=ShareHub server
After=network-online.target
[Service]
User=sharehub
WorkingDirectory=/opt/sharehub/current
EnvironmentFile=/etc/sharehub/sharehub.env
ExecStart=/usr/local/bin/node dist-server/index.mjs
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now caddy
systemctl enable sharehub
USERDATA
  echo "== Launching EC2 instance"
  INSTANCE=$(aws ec2 run-instances --region "$R" --image-id "$AMI" --instance-type t4g.small \
    --key-name "$KEY_NAME" --security-group-ids "$WEB_SG" \
    --metadata-options HttpTokens=required \
    --block-device-mappings "DeviceName=/dev/xvda,Ebs={VolumeSize=20,VolumeType=gp3,Encrypted=true}" \
    --user-data "file://$(cygpath -m "$USER_DATA" 2>/dev/null || echo "$USER_DATA")" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=sharehub-prod},{Key=app,Value=sharehub}]" \
    --query "Instances[0].InstanceId" --output text)
  rm -f "$USER_DATA"
  aws ec2 wait instance-running --region "$R" --instance-ids "$INSTANCE"
fi
save INSTANCE_ID "$INSTANCE"

# --- Elastic IP -----------------------------------------------------------------
ALLOC=$(aws ec2 describe-addresses --region "$R" --filters Name=tag:Name,Values=sharehub-prod --query "Addresses[0].AllocationId" --output text)
if [ "$ALLOC" = "None" ]; then
  ALLOC=$(aws ec2 allocate-address --region "$R" --domain vpc --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=sharehub-prod}]" --query AllocationId --output text)
fi
aws ec2 associate-address --region "$R" --allocation-id "$ALLOC" --instance-id "$INSTANCE" --allow-reassociation >/dev/null
IP=$(aws ec2 describe-addresses --region "$R" --allocation-ids "$ALLOC" --query "Addresses[0].PublicIp" --output text)
save SERVER_IP "$IP"
echo "== Server $INSTANCE at $IP"

# --- DNS: APP_DOMAIN -> Elastic IP (removing any old CNAME for the name) --------
CHANGES=$(aws route53 list-resource-record-sets --hosted-zone-id "$ZONE" --start-record-name "$DOMAIN" --max-items 5 --output json \
  | DOMAIN="$DOMAIN" IP="$IP" node -e "
let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
  const name=process.env.DOMAIN.replace(/\.?$/,'.');
  const existing=JSON.parse(d).ResourceRecordSets.filter(r=>r.Name===name && (r.Type==='CNAME'||r.Type==='A'));
  const changes=existing.filter(r=>r.Type==='CNAME').map(r=>({Action:'DELETE',ResourceRecordSet:r}));
  changes.push({Action:'UPSERT',ResourceRecordSet:{Name:name,Type:'A',TTL:300,ResourceRecords:[{Value:process.env.IP}]}});
  console.log(JSON.stringify({Comment:'ShareHub production',Changes:changes}));
});")
aws route53 change-resource-record-sets --hosted-zone-id "$ZONE" --change-batch "$CHANGES" >/dev/null
echo "== DNS: $DOMAIN -> $IP"

# --- Wait for the database and record its URL ------------------------------------
echo "== Waiting for RDS to become available (can take ~10 minutes)…"
aws rds wait db-instance-available --region "$R" --db-instance-identifier sharehub-prod
DB_HOST=$(aws rds describe-db-instances --region "$R" --db-instance-identifier sharehub-prod --query "DBInstances[0].Endpoint.Address" --output text)
save DATABASE_URL "postgres://sharehub:$DB_PASSWORD@$DB_HOST:5432/sharehub?sslmode=require"

echo
echo "Provisioned. Next: bash scripts/aws/deploy.sh"
echo "SSH: ssh -i $KEY_FILE ec2-user@$IP"
