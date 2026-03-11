import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import Site from '../models/Site.js';

const execAsync = promisify(exec);

const DEPLOY_HOST = process.env.DEPLOY_HOST || '192.168.110.74';
const DEPLOY_USER = process.env.DEPLOY_USER || 'swigs';
const DEPLOY_SITES_DIR = process.env.DEPLOY_SITES_DIR || '/var/www/sites';
const IS_LOCAL = DEPLOY_HOST === 'localhost' || DEPLOY_HOST === '127.0.0.1';

function runCmd(cmd) {
  if (IS_LOCAL) return execAsync(cmd);
  return execAsync(`ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${DEPLOY_HOST} "${cmd}"`);
}

function runSudo(cmd) {
  if (IS_LOCAL) return execAsync(`echo 'AagD2jCusi' | sudo -S bash -c '${cmd}'`);
  return execAsync(`ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${DEPLOY_HOST} "echo 'AagD2jCusi' | sudo -S bash -c '${cmd}'"`);}

function generateNginxConfig(domain) {
  return `server {
    listen 80;
    server_name ${domain} www.${domain};
    root ${DEPLOY_SITES_DIR}/${domain};
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

  const buildDir = path.resolve(process.env.BUILD_OUTPUT_DIR || './builds', site.slug);
  const remoteDir = `${DEPLOY_SITES_DIR}/${site.domain}`;

  try {
    // 1. Create target directory
    await runSudo(`mkdir -p ${remoteDir} && chown ${DEPLOY_USER}:${DEPLOY_USER} ${remoteDir}`);

    // 2. Copy/rsync build files
    if (IS_LOCAL) {
      await execAsync(`rsync -a --delete ${buildDir}/ ${remoteDir}/`);
    } else {
      await execAsync(
        `rsync -azP --delete -e "ssh -o StrictHostKeyChecking=no" ${buildDir}/ ${DEPLOY_USER}@${DEPLOY_HOST}:${remoteDir}/`
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
