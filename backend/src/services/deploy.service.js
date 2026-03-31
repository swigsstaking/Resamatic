import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import Site from '../models/Site.js';
import { recordFirstDeployment } from './billing.service.js';

const execAsync = promisify(exec);

const DOMAIN_REGEX = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;
function validateDomain(domain) {
  if (!domain || !DOMAIN_REGEX.test(domain)) throw new Error(`Invalid domain: ${domain}`);
}

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
  return execAsync(`ssh ${user}@${host} "${cmd}"`);
}

function runSudo(cmd, opts = {}) {
  const { isLocal, user, host } = getConfig();
  const sudoPass = process.env.DEPLOY_SUDO_PASS;
  if (!sudoPass) throw new Error('DEPLOY_SUDO_PASS not configured');
  const execOpts = { timeout: opts.timeout || 60000 };
  if (isLocal) return execAsync(`echo '${sudoPass}' | sudo -S bash -c '${cmd}'`, execOpts);
  return execAsync(`ssh ${user}@${host} "echo '${sudoPass}' | sudo -S bash -c '${cmd}'"`, execOpts);
}

function generateNginxConfig(domain) {
  const { sitesDir } = getConfig();
  return `server {
    listen 80;
    server_name ${domain} www.${domain};
    root ${sitesDir}/${domain};
    index index.html;
    charset utf-8;

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
  validateDomain(site.domain);

  const { isLocal, user, host, sitesDir } = getConfig();
  const buildDir = path.resolve(process.env.BUILD_OUTPUT_DIR || './builds', site.slug);
  const remoteDir = `${sitesDir}/${site.domain}`;

  try {
    // 1. Create target directory
    await Site.findByIdAndUpdate(siteId, { deployStep: 'uploading', deployProgress: 25 });
    await runSudo(`mkdir -p ${remoteDir} && chown ${user}:${user} ${remoteDir}`);

    // 2. Copy/rsync build files
    if (isLocal) {
      await execAsync(`rsync -a --delete ${buildDir}/ ${remoteDir}/`);
    } else {
      await execAsync(
        `rsync -azP --delete -e "ssh " ${buildDir}/ ${user}@${host}:${remoteDir}/`
      );
    }

    // 3. Write Nginx config — only if no config exists yet (preserve SSL configs)
    await Site.findByIdAndUpdate(siteId, { deployStep: 'configuring', deployProgress: 55 });
    const configPath = `/etc/nginx/sites-available/${site.domain}`;
    const enabledPath = `/etc/nginx/sites-enabled/${site.domain}`;

    const { stdout: configExists } = await runSudo(
      `test -f ${configPath} && echo EXISTS || echo MISSING`
    );

    if (configExists.trim().includes('MISSING')) {
      const nginxConfig = generateNginxConfig(site.domain);
      await runCmd(`cat > /tmp/nginx-${site.slug}.conf << 'NGINXEOF'\n${nginxConfig}\nNGINXEOF`);
      await runSudo(`mv /tmp/nginx-${site.slug}.conf ${configPath}`);
      await runSudo(`ln -sf ${configPath} ${enabledPath}`);
      console.log('[deploy] Created new nginx config for', site.domain);
    } else {
      console.log('[deploy] Nginx config already exists, preserving (SSL safe)');
    }

    // 4. Test and reload Nginx
    await runSudo('nginx -t');
    await runSudo('systemctl reload nginx');

    // 5. SSL with Certbot — run if no cert OR if nginx config lacks SSL (fresh config)
    await Site.findByIdAndUpdate(siteId, { deployStep: 'ssl', deployProgress: 75 });
    try {
      const { stdout: certCheck } = await runSudo(
        `test -d /etc/letsencrypt/live/${site.domain} && echo EXISTS || echo MISSING`
      );
      const { stdout: sslInConfig } = await runSudo(
        `grep -q ssl_certificate ${configPath} 2>/dev/null && echo HAS_SSL || echo NO_SSL`
      );
      const needsCertbot = certCheck.trim().includes('MISSING') || sslInConfig.trim().includes('NO_SSL');

      if (needsCertbot) {
        const domainParts = site.domain.split('.');
        const isSubdomain = domainParts.length > 2;
        const certbotDomains = isSubdomain
          ? `-d ${site.domain}`
          : `-d ${site.domain} -d www.${site.domain}`;

        const { stdout, stderr } = await runSudo(
          `certbot --nginx ${certbotDomains} --non-interactive --agree-tos --email admin@swigs.ch --redirect 2>&1`,
          { timeout: 120000 }
        );
        console.log('[deploy] Certbot output:', stdout || stderr);

        // Enable HTTP/2 after Certbot configures SSL
        try {
          await runSudo(`sed -i 's/listen 443 ssl;/listen 443 ssl http2;/g' ${configPath}`);
          await runSudo('nginx -t && systemctl reload nginx');
          console.log('[deploy] HTTP/2 enabled for', site.domain);
        } catch (h2Err) {
          console.warn('[deploy] HTTP/2 setup failed:', h2Err.message);
        }
      } else {
        console.log('[deploy] SSL cert and nginx config already OK, skipping');
      }
    } catch (certErr) {
      console.error('[deploy] Certbot failed:', certErr.message);
      // Don't fail the whole deploy, but log it
    }

    // 6. Track first deployment for billing
    const isFirstDeploy = !site.lastPublishedAt;

    // 7. Update site status
    await Site.findByIdAndUpdate(siteId, {
      status: 'published',
      lastPublishedAt: new Date(),
      buildError: null,
      deployStep: null,
      deployProgress: 100,
    });

    if (isFirstDeploy) {
      await recordFirstDeployment(site);
    }

    // 8. Ping search engines with sitemap
    try {
      const sitemapUrl = `https://${site.domain}/sitemap.xml`;
      await Promise.allSettled([
        fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`),
        fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`),
      ]);
      console.log('[deploy] Pinged search engines with sitemap');
    } catch {}

    return { success: true, url: `https://${site.domain}` };
  } catch (err) {
    await Site.findByIdAndUpdate(siteId, {
      status: 'error',
      buildError: err.message,
      deployStep: null,
      deployProgress: 0,
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

export async function cleanupSiteFiles(site) {
  const { sitesDir } = getConfig();
  const buildDir = path.resolve(process.env.BUILD_OUTPUT_DIR || './builds', site.slug);
  const cleaned = { server: false, nginx: false, build: false };

  // 1. Remove deployed files from server
  if (site.domain) {
    const remoteDir = `${sitesDir}/${site.domain}`;
    try {
      await runSudo(`rm -rf ${remoteDir}`);
      cleaned.server = true;
      console.log('[cleanup] Removed server files:', remoteDir);
    } catch (err) {
      console.warn('[cleanup] Failed to remove server files:', err.message);
    }

    // 2. Remove Nginx config + symlink
    try {
      await runSudo(`rm -f /etc/nginx/sites-enabled/${site.domain}`);
      await runSudo(`rm -f /etc/nginx/sites-available/${site.domain}`);
      await runSudo('nginx -t && systemctl reload nginx');
      cleaned.nginx = true;
      console.log('[cleanup] Removed nginx config for', site.domain);
    } catch (err) {
      console.warn('[cleanup] Failed to remove nginx config:', err.message);
    }

    // 2b. Remove SSL certificate (so certbot reconfigures cleanly on next deploy)
    try {
      await runSudo(`certbot delete --cert-name ${site.domain} --non-interactive 2>/dev/null || true`);
      console.log('[cleanup] Removed SSL cert for', site.domain);
    } catch (err) {
      console.warn('[cleanup] Failed to remove SSL cert:', err.message);
    }
  }

  // 3. Remove local build directory
  try {
    const fs = await import('fs/promises');
    await fs.rm(buildDir, { recursive: true, force: true });
    cleaned.build = true;
    console.log('[cleanup] Removed local build:', buildDir);
  } catch (err) {
    console.warn('[cleanup] Failed to remove local build:', err.message);
  }

  return cleaned;
}
