#!/usr/bin/env bash
# Trustello — Hetzner Ubuntu 24.04 Server-Setup
# Einmalig als root ausführen: bash server-setup.sh
set -euo pipefail

echo "=== 1. System aktualisieren ==="
apt-get update -q && apt-get upgrade -y -q

echo "=== 2. Docker CE installieren ==="
apt-get install -y -q ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -q
apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable docker

echo "=== 3. Nginx + Certbot installieren ==="
apt-get install -y -q nginx certbot python3-certbot-nginx

echo "=== 4. Deploy-User anlegen ==="
if ! id -u deploy &>/dev/null; then
  useradd -m -s /bin/bash deploy
  usermod -aG docker deploy
  mkdir -p /home/deploy/.ssh
  chmod 700 /home/deploy/.ssh
  echo "SSH public key für deploy-User in /home/deploy/.ssh/authorized_keys eintragen!"
fi

echo "=== 5. Verzeichnisstruktur anlegen ==="
mkdir -p /opt/trustello
chown deploy:deploy /opt/trustello

echo "=== 6. UFW Firewall konfigurieren ==="
apt-get install -y -q ufw
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

echo "=== 7. Swap anlegen (2GB) ==="
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo ""
echo "✓ Server-Setup abgeschlossen!"
echo ""
echo "Nächste Schritte:"
echo "  1. SSH-Key des deploy-Users hinterlegen:"
echo "     echo 'SSH_PUBLIC_KEY' >> /home/deploy/.ssh/authorized_keys"
echo "     chown -R deploy:deploy /home/deploy/.ssh"
echo ""
echo "  2. Als deploy-User: Repository klonen:"
echo "     su - deploy"
echo "     git clone https://github.com/Beseco/trustello /opt/trustello"
echo ""
echo "  3. .env.production anlegen (siehe deploy/env.production.example)"
echo ""
echo "  4. Nginx-Config kopieren und SSL einrichten (siehe deploy/nginx/)"
