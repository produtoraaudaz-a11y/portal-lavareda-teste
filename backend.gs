const SPREADSHEET_ID = '1bsTd2_vgxphWvKzTulDhtOoFCdel_4Z96j5pvR2YZDg';
const ACTIONS_SHEET = 'AÇÕES';
const CONTENTS_SHEET = 'CONTEÚDOS';
const CONFIG_SHEET = 'CONFIG';
const PORTAL_URL = 'https://produtoraaudaz-a11y.github.io/portal-lavareda-teste/';

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getConfig_() {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(CONFIG_SHEET);
  const rows = sh.getDataRange().getDisplayValues();
  const out = {};
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0]) out[rows[i][0]] = rows[i][1];
  }
  return out;
}

function getContents_() {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(CONTENTS_SHEET);
  const rows = sh.getDataRange().getDisplayValues();
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    const active = String(rows[i][10]).toLowerCase();
    if (active === 'false' || active === 'não' || active === 'nao' || active === '0') continue;
    out.push({
      id: rows[i][0],
      person: rows[i][1],
      area: rows[i][2],
      title: rows[i][3],
      date: rows[i][4],
      videoId: rows[i][5],
      coverId: rows[i][6] || rows[i][5],
      caption: rows[i][7] || '',
      version: rows[i][8] || '1',
      initialStatus: rows[i][9] || 'aguardando'
    });
  }
  return out;
}

function getActions_() {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(ACTIONS_SHEET);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const rows = sh.getRange(2, 1, last - 1, 15).getDisplayValues();
  return rows.filter(r => r[0]).map(r => ({
    eventId: r[0],
    timestamp: r[1],
    client: r[2],
    lot: r[3],
    contentId: r[4],
    person: r[5],
    title: r[6],
    action: r[7],
    feedback: r[8],
    plannedDate: r[9],
    requestedDate: r[10],
    reason: r[11],
    origin: r[12],
    version: r[13],
    statusAfter: r[14]
  }));
}

function doGet(e) {
  try {
    const cfg = getConfig_();
    const key = (e && e.parameter && e.parameter.key) || '';
    if (key !== cfg.project_key) return json_({ ok: false, error: 'unauthorized' });

    return json_({
      ok: true,
      client: cfg.cliente || 'Lavareda',
      lot: cfg.lote || '',
      contents: getContents_(),
      actions: getActions_()
    });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function findContent_(id) {
  return getContents_().find(c => c.id === id) || null;
}

function latestReviewState_(actions, contentId, fallback) {
  let state = fallback || 'aguardando';
  actions.forEach(a => {
    if (a.contentId !== contentId) return;
    if (a.action === 'APROVADO') state = 'aprovado';
    if (a.action === 'ALTERACAO') state = 'alteracao';
  });
  return state;
}

function allApproved_() {
  const contents = getContents_();
  const actions = getActions_();
  return contents.length > 0 && contents.every(c =>
    latestReviewState_(actions, c.id, c.initialStatus) === 'aprovado'
  );
}

function sendAlert_(cfg, content, payload) {
  const to = cfg.email_notificacao;
  if (!to) return;

  let subject = '';
  let body = '';

  if (payload.action === 'ALTERACAO') {
    subject = `[${cfg.cliente || 'Lavareda'}] Alteração solicitada — ${content.id}`;
    body =
      `Nova alteração solicitada\n\n` +
      `Conteúdo: ${content.id} — ${content.title}\n` +
      `Responsável do conteúdo: ${content.person}\n\n` +
      `Feedback:\n${payload.feedback || '-'}\n\n` +
      `Portal: ${PORTAL_URL}`;
  }

  if (payload.action === 'MUDANCA_DATA') {
    subject = `[${cfg.cliente || 'Lavareda'}] Mudança de data — ${content.id}`;
    body =
      `Nova solicitação de mudança de data\n\n` +
      `Conteúdo: ${content.id} — ${content.title}\n` +
      `Responsável do conteúdo: ${content.person}\n` +
      `Data planejada: ${content.date}\n` +
      `Data solicitada: ${payload.requestedDate || '-'}\n` +
      `Motivo: ${payload.reason || '-'}\n\n` +
      `Portal: ${PORTAL_URL}`;
  }

  if (subject) MailApp.sendEmail(to, subject, body);
}

function maybeNotifyAllApproved_(cfg) {
  const props = PropertiesService.getScriptProperties();
  const marker = `all-approved:${cfg.lote || 'current'}`;
  const already = props.getProperty(marker) === '1';

  if (allApproved_() && !already) {
    MailApp.sendEmail(
      cfg.email_notificacao,
      `[${cfg.cliente || 'Lavareda'}] Lote aprovado ✅`,
      `Todos os conteúdos do lote "${cfg.lote || 'atual'}" foram aprovados.\n\n${PORTAL_URL}`
    );
    props.setProperty(marker, '1');
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const cfg = getConfig_();
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    if (payload.projectKey !== cfg.project_key) {
      return json_({ ok: false, error: 'unauthorized' });
    }

    const allowed = ['APROVADO', 'ALTERACAO', 'MUDANCA_DATA'];
    if (!allowed.includes(payload.action)) {
      return json_({ ok: false, error: 'invalid_action' });
    }

    const content = findContent_(payload.contentId);
    if (!content) return json_({ ok: false, error: 'content_not_found' });

    if (payload.action === 'ALTERACAO' && !String(payload.feedback || '').trim()) {
      return json_({ ok: false, error: 'feedback_required' });
    }

    if (payload.action === 'MUDANCA_DATA' && !payload.requestedDate) {
      return json_({ ok: false, error: 'requested_date_required' });
    }

    const now = new Date();
    const eventId = Utilities.getUuid();
    const tz = Session.getScriptTimeZone() || 'America/Belem';
    const timestamp = Utilities.formatDate(now, tz, 'dd/MM/yyyy HH:mm:ss');

    let statusAfter = '';
    if (payload.action === 'APROVADO') statusAfter = 'aprovado';
    if (payload.action === 'ALTERACAO') statusAfter = 'alteracao';
    if (payload.action === 'MUDANCA_DATA') statusAfter = 'data_solicitada';

    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(ACTIONS_SHEET);
    sh.appendRow([
      eventId,
      timestamp,
      cfg.cliente || 'Lavareda',
      cfg.lote || '',
      content.id,
      content.person,
      content.title,
      payload.action,
      String(payload.feedback || '').trim(),
      content.date,
      payload.requestedDate || '',
      String(payload.reason || '').trim(),
      'Portal',
      content.version,
      statusAfter
    ]);

    if (payload.action === 'ALTERACAO') {
      PropertiesService.getScriptProperties().deleteProperty(`all-approved:${cfg.lote || 'current'}`);
      sendAlert_(cfg, content, payload);
    }

    if (payload.action === 'MUDANCA_DATA') {
      sendAlert_(cfg, content, payload);
    }

    if (payload.action === 'APROVADO') {
      maybeNotifyAllApproved_(cfg);
    }

    return json_({ ok: true, eventId, timestamp, statusAfter });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
