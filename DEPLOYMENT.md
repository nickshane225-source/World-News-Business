# Production Deployment Guide — `worldnews.business` (Linux VPS)

This guide covers deploying **World News / AI Publisher Pro** (`worldnews.business`) on a clean Ubuntu 22.04 / 24.04 LTS VPS using **Node.js 20**, **Redis**, **PM2**, **Nginx**, and **Let's Encrypt SSL (Certbot)**.

---

## 1. DNS Configuration (`worldnews.business`)

In your domain registrar's DNS panel for `worldnews.business`, create the following records pointing to your VPS public IPv4 address (`YOUR_VPS_IP`):

| Type | Host / Name | Value / Target | TTL |
| :--- | :--- | :--- | :--- |
| `A` | `@` | `YOUR_VPS_IP` | 300 (or Auto) |
| `A` | `www` | `YOUR_VPS_IP` | 300 (or Auto) |

Verify propagation before running Certbot:
```bash
dig +short worldnews.business
dig +short www.worldnews.business
```

---

## 2. Firewall Setup (UFW)

Allow SSH, HTTP, and HTTPS only (keep port `5000` and Redis `6379` bound to `127.0.0.1`):
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## 3. Install Node.js 20, Nginx, Certbot & Redis

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx certbot python3-certbot-nginx build-essential

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2
```

### Redis Installation (Option A: Native APT — Recommended for VPS)
```bash
sudo apt install -y redis-server
sudo sed -i 's/^supervised no/supervised systemd/' /etc/redis/redis.conf
sudo systemctl enable --now redis-server
redis-cli ping  # Must reply: PONG
```

### Redis Installation (Option B: Docker)
```bash
docker run -d --name worldnews-redis --restart unless-stopped -p 127.0.0.1:6379:6379 redis:7-alpine
```

---

## 4. Clone / Upload Project & Build Frontend

```bash
sudo mkdir -p /var/www/worldnews
sudo chown -R $USER:$USER /var/www/worldnews
cd /var/www/worldnews

# Copy or git clone the repository into /var/www/worldnews
# Build the React + Vite frontend into client/dist:
cd /var/www/worldnews/client
npm ci
npm run build

# Install backend dependencies (including sharp):
cd /var/www/worldnews/server
npm ci --omit=dev
```

---

## 5. Environment Variables (`server/.env`)

Create `/var/www/worldnews/server/.env` and lock down file permissions (`chmod 600`):
```bash
nano /var/www/worldnews/server/.env
```

```ini
PORT=5000
SITE_URL=https://worldnews.business

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

REDIS_URL=redis://127.0.0.1:6379

ADMIN_EMAIL=admin@worldnews.business
ADMIN_PASSWORD=your-strong-admin-password
JWT_SECRET=your-64-char-random-hex-secret

GEMINI_API_KEY=your-gemini-api-key
GEMINI_TEXT_MODEL=gemini-3.6-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
```

Secure the `.env` file:
```bash
chmod 600 /var/www/worldnews/server/.env
```

---

## 6. Process Management & Auto-Restart with PM2

Start the Express API + BullMQ worker with PM2 and configure systemd startup on reboot:
```bash
cd /var/www/worldnews/server
pm2 start src/server.js --name "worldnews-server" --max-memory-restart 500M
pm2 save
pm2 startup systemd
# Run the sudo env PATH=... command printed by pm2 startup
```

Useful PM2 commands:
- View live logs: `pm2 logs worldnews-server`
- Restart after update: `pm2 reload worldnews-server`
- Monitor CPU/RAM: `pm2 monit`

---

## 7. Nginx Reverse Proxy & Static Asset Configuration

Create `/etc/nginx/sites-available/worldnews.business`:
```nginx
server {
    listen 80;
    server_name worldnews.business www.worldnews.business;

    # Redirect www to apex domain
    if ($host = www.worldnews.business) {
        return 301 https://worldnews.business$request_uri;
    }

    root /var/www/worldnews/client/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    # Cache immutable Vite assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # Proxy API, Sitemap, and Robots to Express on 127.0.0.1:5000
    location ~ ^/(api|sitemap\.xml|robots\.txt) {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # SPA fallback for React Router
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable the site and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/worldnews.business /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

---

## 8. Let's Encrypt SSL (Certbot)

Issue and auto-configure HTTPS certificates for both `worldnews.business` and `www.worldnews.business`:
```bash
sudo certbot --nginx -d worldnews.business -d www.worldnews.business --redirect --agree-tos -m admin@worldnews.business
```

Verify automatic renewal timer:
```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

---

## 9. Automated Daily Backups

Create a daily cron job `/etc/cron.daily/worldnews-backup` that exports your Supabase tables (`articles`, `article_sources`, `trending_topics`, `automation_settings`) and rotates backups older than 14 days:
```bash
sudo tee /etc/cron.daily/worldnews-backup > /dev/null << 'EOF'
#!/usr/bin/env bash
set -e
BACKUP_DIR="/var/backups/worldnews/$(date +\%F)"
mkdir -p "$BACKUP_DIR"
cd /var/www/worldnews/server
node -e '
import("./src/lib/supabase.js").then(async ({ supabase }) => {
  const fs = await import("fs");
  for (const t of ["articles", "article_sources", "trending_topics", "automation_settings"]) {
    const { data } = await supabase.from(t).select("*");
    fs.writeFileSync(`${process.env.BACKUP_DIR}/${t}.json`, JSON.stringify(data || [], null, 2));
  }
  process.exit(0);
});
' BACKUP_DIR="$BACKUP_DIR"
find /var/backups/worldnews -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +
EOF
sudo chmod +x /etc/cron.daily/worldnews-backup
```
