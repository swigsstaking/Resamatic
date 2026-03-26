import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

export async function sendEmail({ to, subject, html }) {
  const transport = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  const info = await transport.sendMail({ from, to, subject, html });
  console.log('[email] Sent:', subject, '→', to, '| messageId:', info.messageId);
  return info;
}

export async function sendBillingReport(data) {
  const { month, year, standardCount, posthogCount, deployments, totalStandard, totalPosthog } = data;

  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const monthName = monthNames[month - 1];

  const rows = deployments.map(d => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${d.siteName}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${d.domain}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${d.type === 'posthog' ? 'PostHog' : 'Standard'}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${new Date(d.firstPublishedAt).toLocaleDateString('fr-FR')}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${d.deletedAt ? 'Supprime' : 'Actif'}</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family:Inter,sans-serif;max-width:700px;margin:0 auto">
      <h1 style="color:#12203e">Resamatic — Rapport de facturation</h1>
      <h2 style="color:#666">${monthName} ${year}</h2>

      <div style="display:flex;gap:20px;margin:20px 0">
        <div style="background:#f0f4ff;padding:20px;border-radius:12px;flex:1;text-align:center">
          <div style="font-size:36px;font-weight:700;color:#12203e">${standardCount}</div>
          <div style="color:#666">Sites Standard ce mois</div>
        </div>
        <div style="background:#f0fff4;padding:20px;border-radius:12px;flex:1;text-align:center">
          <div style="font-size:36px;font-weight:700;color:#12203e">${posthogCount}</div>
          <div style="color:#666">Sites PostHog ce mois</div>
        </div>
      </div>

      <h3 style="color:#12203e">Détail des déploiements ce mois</h3>
      ${deployments.length ? `
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr style="background:#f5f5f5">
              <th style="padding:8px;text-align:left">Nom</th>
              <th style="padding:8px;text-align:left">Domaine</th>
              <th style="padding:8px;text-align:left">Type</th>
              <th style="padding:8px;text-align:left">Déployé le</th>
              <th style="padding:8px;text-align:left">Statut</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      ` : '<p style="color:#999">Aucun nouveau déploiement ce mois.</p>'}

      <hr style="margin:30px 0;border:none;border-top:1px solid #eee">

      <h3 style="color:#12203e">Total cumulé (depuis le début)</h3>
      <p><strong>${totalStandard}</strong> sites Standard | <strong>${totalPosthog}</strong> sites PostHog | <strong>${totalStandard + totalPosthog}</strong> total</p>

      <p style="color:#999;font-size:12px;margin-top:30px">
        Rapport généré automatiquement par Resamatic le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}
      </p>
    </div>
  `;

  await sendEmail({
    to: process.env.BILLING_EMAIL || 'corentin.flaction@gmail.com',
    subject: `Resamatic — Facturation ${monthName} ${year}`,
    html,
  });
}
