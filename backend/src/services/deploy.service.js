import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import Site from '../models/Site.js';

const execAsync = promisify(exec);

function getConfig() {
  const host = process.env.DEPLOY_HOST || '192.168.110.74';
  const user = process.env.DEPLOY_USER || 'swigs';
  const sitesDir = process.env.DEPLOY_SITES_DIR || '/var/www/sites';
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  return { host, user, sitesDir, isLocal };
}

function runCmd(cmd) {
  const { isLocal, user, host } = getConfig();
  if (isLocal) return execAsync(cmd);
  return execAsync(`ssh -o StrictHostKeyChecking=no ${user}@${host} "${cmd}"`);
}

function runSudo(cmd) {
  const { isLocal, user, host } = getConfig();
  if (isLocal) return execAsync(`echo 'AagD2jCusi' | sudo -S bash -c '${cmd}'`);
  return execAsync(`ssh -o StrictHostKeyChecking=no ${user}@${host} "echo 'AagD2jCusi' | sudo -S bash -c '${cmd}'"`);
}

function generateNginxConfig(domain) {
  const { sitesDir } = getConfig();
  return `server {
    listen 80;
    server_name ${domain} www.${domain};
    root ${sitesDir}/${domain};
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Cache static assets aggressively
    location ~* \\.(css|js|webp|jpg|jpeg|png|gif|ico|svg|woff2|woff)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # HTML pages - short cache for easy updates
    location ~* \\.html$ {
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }

    # Clean URLs
    try_files $uri $uri.html $uri/ =404;

    error_page 404 /index.html;

    # Gzip
    gzip on;
    gzip_types text/plain text/css text/xml application/json application/javascript text/javascript image/svg+xml;
    gzip_min_length 1000;
}`;
}

export async function deploySite(siteId) {
  const site = await Site.findById(siteId);
  if (!site) throw new Error('Site not found');
  if (!site.domain) throw new Error('Site domain not configured');

  const { isLocal, user, host, sitesDir } = getConfig();
  const buildDir = path.resolve(process.env.BUILD_OUTPUT_DIR || './builds', site.slug);
  const remoteDir = `${sitesDir}/${site.domain}`;

  try {
    // 1. Create target directory
    await runSudo(`mkdir -p ${remoteDir} && chown ${user}:${user} ${remoteDir}`);

    // 2. Copy/rsync build files
    if (isLocal) {
      await execAsync(`rsync -a --delete ${buildDir}/ ${remoteDir}/`);
    } else {
      await execAsync(
        `rsync -azP --delete -e "ssh -o StrictHostKeyChecking=no" ${buildDir}/ ${user}@${host}:${remoteDir}/`
      );
    }

    // 3. Write Nginx config
    const nginxConfig = generateNginxConfig(site.domain);
    const configPath = `/etc/nginx/sites-available/${site.domain}`;
    const enabledPath = `/etc/nginx/sites-enabled/${site.domain}`;

    // Write config via temp file
    await runCmd(`cat > /tmp/nginx-${site.slug}.conf << 'NGINXEOF'\n${nginxConfig}\nNGINXEOF`);
    await runSudo(`mv /tmp/nginx-${site.slug}.conf ${configPath}`);
    await runSudo(`ln -sf ${configPath} ${enabledPath}`);

    // 4. Test and reload Nginx
    await runSudo('nginx -t');
    await runSudo('systemctl reload nginx');

    // 5. SSL with Certbot (non-interactive, skip if already configured or local domain)
    try {
      await runSudo(
        `certbot --nginx -d ${site.domain} -d www.${site.domain} --non-interactive --agree-tos --email admin@swigs.ch --redirect 2>/dev/null || true`
      );
    } catch {
      // Certbot may fail for local/internal domains — not critical
    }

    // 6. Update site status
    await Site.findByIdAndUpdate(siteId, {
      status: 'published',
      lastPublishedAt: new Date(),
      buildError: null,
    });

    return { success: true, url: `https://${site.domain}` };
  } catch (err) {
    await Site.findByIdAndUpdate(siteId, {
      status: 'error',
      buildError: err.message,
    });
    throw err;
  }
}

export async function unpublishSite(siteId) {
  const site = await Site.findById(siteId);
  if (!site?.domain) throw new Error('Site not found or no domain');

  await runSudo(`rm -f /etc/nginx/sites-enabled/${site.domain}`);
  await runSudo('systemctl reload nginx');

  await Site.findByIdAndUpdate(siteId, { status: 'draft' });
  return { success: true };
}
