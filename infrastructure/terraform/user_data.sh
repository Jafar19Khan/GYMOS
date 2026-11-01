#!/bin/bash
set -Eeuo pipefail
exec > >(tee -a /var/log/gymos-bootstrap.log | logger -t gymos-bootstrap -s 2>/dev/console) 2>&1

echo "Starting GYMOS EC2 bootstrap."
dnf upgrade -y
dnf install -y git nginx postgresql15 postgresql15-server nodejs22 nodejs22-npm openssl curl

node --version
npm --version

# PostgreSQL is local to this host. It is never opened in the EC2 security group.
if [ ! -s /var/lib/pgsql/data/PG_VERSION ]; then
  postgresql-setup --initdb --unit postgresql
fi
systemctl enable --now postgresql

DB_PASSWORD="$(openssl rand -hex 32)"
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='gymos'" | grep -q '^1$'; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER ROLE gymos WITH LOGIN PASSWORD '$DB_PASSWORD';"
else
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE gymos LOGIN PASSWORD '$DB_PASSWORD';"
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='gymos'" | grep -q '^1$'; then
  sudo -u postgres createdb --owner=gymos gymos
fi

sed -ri "s/^#?listen_addresses[[:space:]]*=.*/listen_addresses = '127.0.0.1'/" /var/lib/pgsql/data/postgresql.conf
if grep -qE "^host[[:space:]]+all[[:space:]]+all[[:space:]]+127\.0\.0\.1/32" /var/lib/pgsql/data/pg_hba.conf; then
  sed -ri 's#^host[[:space:]]+all[[:space:]]+all[[:space:]]+127\.0\.0\.1/32.*#host all all 127.0.0.1/32 scram-sha-256#' /var/lib/pgsql/data/pg_hba.conf
else
  printf '\nhost all all 127.0.0.1/32 scram-sha-256\n' >> /var/lib/pgsql/data/pg_hba.conf
fi
systemctl restart postgresql

id gymos >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/gymos --shell /bin/bash gymos
install -d -o gymos -g gymos -m 0755 /opt/gymos
install -d -o root -g gymos -m 0750 /etc/gymos

QR_SECRET="$(openssl rand -hex 32)"
cat > /etc/gymos/gymos.env <<EOF
NODE_ENV=production
PORT=3000
HOSTNAME=127.0.0.1
APP_URL=https://pending
TRUST_PROXY_HEADERS=true
ATTENDANCE_QR_SECRET=$QR_SECRET
NEXT_TELEMETRY_DISABLED=1
DATABASE_URL=postgresql://gymos:$DB_PASSWORD@127.0.0.1:5432/gymos?schema=public
BOOTSTRAP_GYM_NAME=GYMOS-Live
BOOTSTRAP_OWNER_NAME=Gym-Owner
BOOTSTRAP_OWNER_EMAIL=
BOOTSTRAP_OWNER_PASSWORD=
BOOTSTRAP_SUPER_ADMIN_NAME=Platform-Admin
BOOTSTRAP_SUPER_ADMIN_EMAIL=
BOOTSTRAP_SUPER_ADMIN_PASSWORD=
EOF
chown root:gymos /etc/gymos/gymos.env
chmod 0640 /etc/gymos/gymos.env

# Refreshes the IP-SAN certificate on each boot; production Secure cookies stay enabled.
cat > /usr/local/sbin/gymos-refresh-public-ip <<'SCRIPT'
#!/bin/bash
set -Eeuo pipefail
PUBLIC_IP=""
for attempt in $(seq 1 30); do
  TOKEN="$(curl -fsS --max-time 3 -X PUT 'http://169.254.169.254/latest/api/token' -H 'X-aws-ec2-metadata-token-ttl-seconds: 21600' 2>/dev/null || true)"
  if [ -n "$TOKEN" ]; then
    PUBLIC_IP="$(curl -fsS --max-time 3 -H "X-aws-ec2-metadata-token: $TOKEN" 'http://169.254.169.254/latest/meta-data/public-ipv4' 2>/dev/null || true)"
  fi
  if [[ "$PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then break; fi
  PUBLIC_IP=""
  sleep 2
done
if [ -z "$PUBLIC_IP" ]; then
  echo "Could not read the EC2 public IPv4 address from IMDSv2." >&2
  exit 1
fi
sed -i "s#^APP_URL=.*#APP_URL=https://$PUBLIC_IP#" /etc/gymos/gymos.env
umask 077
openssl req -x509 -nodes -newkey rsa:2048 -days 90 \
  -keyout /etc/pki/tls/private/gymos-selfsigned.key \
  -out /etc/pki/tls/certs/gymos-selfsigned.crt \
  -subj "/CN=$PUBLIC_IP" \
  -addext "subjectAltName=IP:$PUBLIC_IP"
chmod 0600 /etc/pki/tls/private/gymos-selfsigned.key
chmod 0644 /etc/pki/tls/certs/gymos-selfsigned.crt
echo "Temporary TLS certificate generated for $PUBLIC_IP."
SCRIPT
chmod 0750 /usr/local/sbin/gymos-refresh-public-ip

cat > /etc/systemd/system/gymos-public-ip.service <<'UNIT'
[Unit]
Description=Refresh GYMOS public IP and temporary TLS certificate
Wants=network-online.target
After=network-online.target
Before=nginx.service gymos.service
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/gymos-refresh-public-ip
RemainAfterExit=yes
[Install]
WantedBy=multi-user.target
UNIT

install -d -m 0755 /etc/systemd/system/nginx.service.d
cat > /etc/systemd/system/nginx.service.d/gymos-public-ip.conf <<'UNIT'
[Unit]
Requires=gymos-public-ip.service
After=gymos-public-ip.service
UNIT

cat > /etc/nginx/conf.d/gymos.conf <<'NGINX'
server {
    listen 80 default_server;
    server_name _;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl default_server;
    server_name _;
    ssl_certificate     /etc/pki/tls/certs/gymos-selfsigned.crt;
    ssl_certificate_key /etc/pki/tls/private/gymos-selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:GYMOS_SSL:10m;
    client_max_body_size 10m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
    }
}
NGINX
rm -f /etc/nginx/conf.d/default.conf

NPM_BIN="$(command -v npm)"
cat > /etc/systemd/system/gymos.service <<UNIT
[Unit]
Description=GYMOS Next.js application
Requires=postgresql.service gymos-public-ip.service
After=network-online.target postgresql.service gymos-public-ip.service
Wants=network-online.target
[Service]
Type=simple
User=gymos
Group=gymos
WorkingDirectory=/opt/gymos
EnvironmentFile=/etc/gymos/gymos.env
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
ExecStart=$NPM_BIN run start
Restart=on-failure
RestartSec=5
TimeoutStartSec=180
NoNewPrivileges=true
PrivateTmp=true
[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now amazon-ssm-agent
systemctl enable --now postgresql
systemctl enable --now gymos-public-ip.service
nginx -t
systemctl enable --now nginx.service

echo "GYMOS host bootstrap completed. Deploy the application from PowerShell next."
