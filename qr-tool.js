document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const el = {
    picker: $('typePicker'), fields: $('fields'), source: $('matrixSource'), qr: $('qr'),
    encoded: $('encoded'), status: $('status'), png: $('png'), pdf: $('pdf'),
    size: $('size'), shape: $('shape'), eye: $('eye'), frame: $('frame'), framePicker: $('framePicker'),
    caption: $('caption'), captionFont: $('captionFont'), captionField: $('captionField'), dark: $('dark'), hex: $('hex'),
    second: $('second'), secondHex: $('secondHex'), gradient: $('gradient'),
    borderColor: $('borderColor'), borderHex: $('borderHex'),
    colorError: $('colorError'), logo: $('logo'), logoName: $('logoName'),
    clearLogo: $('clearLogo'), printQr: $('printQr'), printLabel: $('printLabel')
  };
  const field = (title, name, placeholder = '', type = 'text', attrs = '') =>
    `<div class="field"><label for="field-${name}">${title}</label><input id="field-${name}" name="${name}" type="${type}" placeholder="${placeholder}" ${attrs}></div>`;
  const area = (title, name, placeholder = '') =>
    `<div class="field"><label for="field-${name}">${title}</label><textarea id="field-${name}" name="${name}" placeholder="${placeholder}"></textarea></div>`;
  const note = message => `<p class="field-note">${message}</p>`;
  const linkField = (label, noteText) => field(label, 'url', 'https://example.com/file', 'url') + note(noteText);
  const types = [
    { id: 'link', label: 'Link', group: 'Everyday', fields: field('Website address', 'url', 'https://example.com', 'url') + note('The direct URL is embedded in your QR code.') },
    { id: 'text', label: 'Text', group: 'Everyday', fields: area('Plain text', 'text', 'Type a short message') },
    { id: 'email', label: 'E-mail', group: 'Everyday', fields: field('Recipient e-mail', 'email', 'hello@example.com', 'email') + field('Subject (optional)', 'subject') + area('Message (optional)', 'body') },
    { id: 'phone', label: 'Call', group: 'Everyday', fields: field('Phone number', 'phone', '+1 416 555 0100', 'tel') },
    { id: 'sms', label: 'SMS', group: 'Everyday', fields: field('Phone number', 'phone', '+1 416 555 0100', 'tel') + area('Message (optional)', 'message') },
    { id: 'whatsapp', label: 'WhatsApp', group: 'Everyday', fields: field('Number with country code', 'phone', '14165550100', 'tel') + area('Pre-filled message (optional)', 'message') + note('Opens WhatsApp through its public wa.me link.') },
    { id: 'wifi', label: 'Wi-Fi', group: 'Everyday', fields: field('Network name (SSID)', 'ssid', 'e.g. Guest Wi-Fi', 'text', 'autocomplete="off" spellcheck="false" autocapitalize="none"') + `<div class="field"><label for="field-security">Security</label><select id="field-security" name="security"><option value="WPA">WPA / WPA2 (personal)</option><option value="WEP">WEP</option><option value="nopass">No password</option></select></div>` + field('Password', 'password', '', 'password', 'autocomplete="off" spellcheck="false" autocapitalize="none"') + `<label class="check-line"><input type="checkbox" id="showWifiPassword"> Show password</label>` + `<label class="check-line"><input type="checkbox" name="hidden"> Hidden network</label>` + note('Wi-Fi details are encoded in the QR image. Anyone who can scan it can read the password.') },
    { id: 'vcard', label: 'Contact', group: 'Everyday', fields: `<div class="field-grid">${field('First name', 'first')}${field('Last name', 'last')}</div>` + field('Organization (optional)', 'org') + field('Job title (optional)', 'title') + field('Phone (optional)', 'phone', '+1 416 555 0100', 'tel') + field('E-mail (optional)', 'email', 'name@example.com', 'email') + field('Website (optional)', 'website', 'https://example.com', 'url') + note('Produces a standard vCard contact QR code.') },
    { id: 'event', label: 'Event', group: 'More data', fields: field('Event name', 'title') + `<div class="field-grid">${field('Starts', 'start', '', 'datetime-local')}${field('Ends', 'end', '', 'datetime-local')}</div>` + field('Location (optional)', 'location') + area('Description (optional)', 'description') + note('Dates are converted from your browser’s local time into a calendar event.') },
    { id: 'location', label: 'Location', group: 'More data', fields: `<div class="field-grid">${field('Latitude', 'lat', '43.6532', 'number', 'step="any" min="-90" max="90"')}${field('Longitude', 'lng', '-79.3832', 'number', 'step="any" min="-180" max="180"')}</div>` + note('Links directly to these coordinates in Google Maps.') },
    { id: 'bitcoin', label: 'Bitcoin', group: 'More data', fields: field('Bitcoin address', 'address') + field('Amount in BTC (optional)', 'amount', '0.001', 'number', 'min="0" step="any"') },
    { id: 'paypal', label: 'PayPal', group: 'More data', fields: field('PayPal.Me username', 'username') + note('Creates a direct PayPal.Me link. Check the recipient before sharing.') },
    { id: 'product', label: 'Product data', group: 'More data', fields: area('Product or inventory text', 'text', 'SKU: 12345\nBatch: A1') + note('Plain QR text for product details; this is not a verified GS1 barcode.') },
    { id: 'pdf', label: 'PDF link', group: 'Hosted links', fields: linkField('Public PDF URL', 'The PDF must already be hosted online. Its bytes are not stored inside this QR code.') },
    { id: 'image', label: 'Image link', group: 'Hosted links', fields: linkField('Public image or gallery URL', 'Use a public page or file URL. This site does not upload or host images.') },
    { id: 'video', label: 'Video link', group: 'Hosted links', fields: linkField('Public video URL', 'Use a public video page, such as a published video link.') },
    { id: 'social', label: 'Social profile', group: 'Hosted links', fields: linkField('Social profile URL', 'For multiple profiles, use an existing public profile page or link hub.') },
    { id: 'app', label: 'App store', group: 'Hosted links', fields: linkField('App Store or Play Store URL', 'One QR code links to one store URL. Device-specific routing would require a hosted page.') }
  ];
  const typeById = Object.fromEntries(types.map(type => [type.id, type]));
  const savedFields = {};
  let typeId = 'link';
  let currentPayload = '';
  let qrModel = null;
  let logoImage = null;
  let ready = false;
  let timer;

  const pageType = document.body.dataset.qrType;
  const visibleTypes = pageType ? types.filter(type => type.id === pageType) : types;
  for (const group of [...new Set(visibleTypes.map(type => type.group))]) {
    const section = document.createElement('div');
    section.className = 'type-group';
    const heading = document.createElement('p');
    heading.className = 'type-group-title';
    heading.textContent = group;
    const list = document.createElement('div');
    list.className = 'type-list';
    for (const type of visibleTypes.filter(item => item.group === group)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'type-button';
      button.dataset.type = type.id;
      button.textContent = type.label;
      list.append(button);
    }
    section.append(heading, list);
    el.picker.append(section);
  }

  function saveFields() {
    savedFields[typeId] = {};
    for (const input of el.fields.querySelectorAll('[name]'))
      savedFields[typeId][input.name] = input.type === 'checkbox' ? input.checked : input.value;
  }
  function chooseType(id) {
    if (!typeById[id]) return;
    if (el.fields.children.length) saveFields();
    typeId = id;
    el.fields.innerHTML = typeById[id].fields;
    const defaults = id === 'link' && !savedFields[id] ? { url: 'https://example.com' } : {};
    for (const input of el.fields.querySelectorAll('[name]')) {
      const value = (savedFields[id] || defaults)[input.name];
      if (value !== undefined) input.type === 'checkbox' ? input.checked = value : input.value = value;
    }
    for (const button of el.picker.querySelectorAll('button[data-type]')) {
      const selected = button.dataset.type === id;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
    if (id === 'wifi') {
      const security = el.fields.querySelector('[name="security"]');
      const password = el.fields.querySelector('[name="password"]');
      const reveal = $('showWifiPassword');
      const syncSecurity = () => {
        password.disabled = security.value === 'nopass';
        reveal.disabled = password.disabled;
        if (password.disabled) { reveal.checked = false; password.type = 'password'; }
      };
      reveal.addEventListener('change', () => { password.type = reveal.checked ? 'text' : 'password'; });
      security.addEventListener('change', syncSecurity);
      syncSecurity();
    }
    schedule();
  }
  const raw = name => el.fields.querySelector(`[name="${name}"]`)?.value || '';
  const val = name => (el.fields.querySelector(`[name="${name}"]`)?.value || '').trim();
  const checked = name => !!el.fields.querySelector(`[name="${name}"]`)?.checked;
  const required = (name, label) => { const value = val(name); if (!value) throw Error(`Enter ${label}.`); return value; };
  const directUrl = name => {
    const value = required(name, 'a full URL beginning with https://');
    try { const url = new URL(value); if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) throw Error(); }
    catch { throw Error('Enter a valid http:// or https:// URL.'); }
    return value;
  };
  const escaped = value => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  const wifiEscaped = value => value.replace(/([\\;,:"])/g, '\\$1');
  const dateUTC = value => {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) throw Error('Enter a valid event start and end time.');
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  };
  function buildPayload() {
    switch (typeId) {
      case 'link': case 'pdf': case 'image': case 'video': case 'social': case 'app': return directUrl('url');
      case 'text': case 'product': return required('text', 'some text');
      case 'email': {
        const address = required('email', 'an e-mail address');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw Error('Enter a valid e-mail address.');
        const params = new URLSearchParams();
        if (val('subject')) params.set('subject', val('subject'));
        if (val('body')) params.set('body', val('body'));
        return 'mailto:' + address + (params.size ? '?' + params.toString() : '');
      }
      case 'phone': {
        const phone = required('phone', 'a phone number');
        if (!/^[+\d().\s-]{5,}$/.test(phone)) throw Error('Enter a valid phone number.');
        return 'tel:' + phone.replace(/[()\s-]/g, '');
      }
      case 'sms': {
        const phone = required('phone', 'a phone number').replace(/[()\s-]/g, '');
        if (!/^\+?\d{5,}$/.test(phone)) throw Error('Enter a valid phone number.');
        return 'SMSTO:' + phone + ':' + val('message');
      }
      case 'whatsapp': {
        const phone = required('phone', 'a phone number with country code').replace(/\D/g, '');
        if (phone.length < 7 || phone.length > 15) throw Error('Enter a valid international phone number.');
        return 'https://wa.me/' + phone + (val('message') ? '?text=' + encodeURIComponent(val('message')) : '');
      }
      case 'wifi': {
        const ssid = raw('ssid'), password = raw('password');
        if (!ssid) throw Error('Enter your Wi-Fi network name to create a code.');
        if (new TextEncoder().encode(ssid).length > 32) throw Error('A Wi-Fi network name can be at most 32 bytes.');
        const security = val('security');
        if (security !== 'nopass' && !password) throw Error('Enter the Wi-Fi password, or select “No password”.');
        return `WIFI:T:${security};S:${wifiEscaped(ssid)};${security === 'nopass' ? '' : 'P:' + wifiEscaped(password) + ';'}H:${checked('hidden') ? 'true' : 'false'};;`;
      }
      case 'vcard': {
        const first = val('first'), last = val('last');
        if (!first && !last) throw Error('Enter a first or last name.');
        const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${escaped(last)};${escaped(first)};;;`, `FN:${escaped([first, last].filter(Boolean).join(' '))}`];
        for (const [name, tag] of [['org', 'ORG'], ['title', 'TITLE'], ['phone', 'TEL;TYPE=CELL'], ['email', 'EMAIL'], ['website', 'URL']])
          if (val(name)) lines.push(`${tag}:${escaped(val(name))}`);
        lines.push('END:VCARD');
        return lines.join('\r\n');
      }
      case 'event': {
        const title = required('title', 'an event name');
        const start = dateUTC(val('start')), end = dateUTC(val('end'));
        if (end <= start) throw Error('The event end must be after the start.');
        const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${escaped(title)}`];
        if (val('location')) lines.push(`LOCATION:${escaped(val('location'))}`);
        if (val('description')) lines.push(`DESCRIPTION:${escaped(val('description'))}`);
        lines.push('END:VEVENT', 'END:VCALENDAR');
        return lines.join('\r\n');
      }
      case 'location': {
        const lat = Number(required('lat', 'latitude')), lng = Number(required('lng', 'longitude'));
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw Error('Enter valid latitude and longitude.');
        return `https://www.google.com/maps?q=${lat},${lng}`;
      }
      case 'bitcoin': {
        const address = required('address', 'a Bitcoin address');
        if (!/^[a-zA-Z0-9]{26,90}$/.test(address)) throw Error('Check the Bitcoin address.');
        const amount = val('amount');
        if (amount && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)) throw Error('Enter a positive BTC amount.');
        return 'bitcoin:' + address + (amount ? '?amount=' + encodeURIComponent(amount) : '');
      }
      case 'paypal': {
        const username = required('username', 'a PayPal.Me username');
        if (!/^[a-zA-Z0-9._-]+$/.test(username)) throw Error('Enter a PayPal.Me username without spaces.');
        return 'https://paypal.me/' + username;
      }
    }
    throw Error('Choose a QR type.');
  }

  function schedule() { clearTimeout(timer); timer = setTimeout(render, 180); }
  function setStatus(text) { el.status.textContent = text; }
  function pathRound(ctx, x, y, w, h, radius) {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function fillShape(ctx, x, y, w, style, color) {
    ctx.fillStyle = color;
    if (style === 'dots') { ctx.beginPath(); ctx.arc(x + w / 2, y + w / 2, w * .43, 0, Math.PI * 2); ctx.fill(); }
    else if (style === 'rounded') { pathRound(ctx, x, y, w, w, w * .27); ctx.fill(); }
    else ctx.fillRect(x, y, w, w);
  }
  function readableTextColor(hex) {
    const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
    return channels[0] * .299 + channels[1] * .587 + channels[2] * .114 > 155 ? '#173e2b' : '#ffffff';
  }
  function paint(size, frame = el.frame.value) {
    if (!qrModel) return null;
    // Frame proportions follow the actual artwork, so portrait styles export as portrait PNGs.
    const layouts = {
      none: { height: 1, qr: [.06, .06, .88] },
      outline: { height: 1.27, qr: [.07, .065, .86] },
      double: { height: 1.22, qr: [.07, .055, .86] },
      rounded: { height: 1.27, qr: [.085, .075, .83] },
      corners: { height: 1.27, qr: [.115, .125, .77] },
      ticket: { height: 1.45, qr: [.14, .255, .72] },
      caption: { height: 1.45, qr: [.10, .245, .80] },
      pill: { height: 1.25, qr: [.07, .065, .86] },
      topbar: { height: 1.27, qr: [.07, .07, .86] }
    };
    const layout = layouts[frame] || layouts.none;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = Math.round(size * layout.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const S = size, color = el.borderColor.value;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const roundFill = (x, y, w, h, r, fill) => { ctx.fillStyle = fill; pathRound(ctx, x*S, y*S, w*S, h*S, r*S); ctx.fill(); };
    const roundStroke = (x, y, w, h, r, width = .012) => { ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, width*S); pathRound(ctx, x*S, y*S, w*S, h*S, r*S); ctx.stroke(); };
    const label = (el.caption.value.trim() || 'SCAN ME').slice(0, 24);
    const font = { sans: 'Arial, sans-serif', serif: 'Georgia, serif', mono: 'monospace' }[el.captionFont.value] || 'Arial, sans-serif';
    const drawText = (y, width, onColor = true, fontSize = .061) => {
      ctx.fillStyle = onColor ? readableTextColor(color) : color;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `800 ${Math.round(S * fontSize)}px ${font}`;
      ctx.fillText(label, S*.5, S*y, S*width);
    };

    if (frame === 'outline') {
      roundStroke(.025, .025, .95, 1.20, .055, .025);
      roundFill(.255, 1.045, .49, .145, .073, color);
    } else if (frame === 'double') {
      roundStroke(.025, .02, .95, 1.18, .035, .018);
      roundFill(.025, 1.02, .95, .18, .025, color);
    } else if (frame === 'rounded') {
      roundStroke(.035, .025, .93, 1.20, .09, .017);
      roundFill(.225, 1.04, .55, .14, .07, color);
    } else if (frame === 'corners') {
      ctx.strokeStyle = color; ctx.lineWidth = S*.025; ctx.beginPath(); ctx.arc(S*.5, S*.51, S*.485, 0, Math.PI*2); ctx.stroke();
    } else if (frame === 'ticket') {
      roundFill(.055, .03, .89, 1.39, .085, color);
      roundFill(.11, .16, .78, 1.02, .025, '#ffffff');
      roundFill(.395, .075, .21, .035, .017, '#ffffff');
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(S*.5, S*1.345, S*.025, 0, Math.PI*2); ctx.fill();
    } else if (frame === 'caption') {
      roundStroke(.055, .145, .89, 1.26, .065, .02);
      roundFill(.35, .09, .30, .15, .04, color);
      roundFill(.39, .055, .22, .075, .03, color);
      roundFill(.18, 1.245, .64, .115, .055, color);
    } else if (frame === 'pill') {
      roundFill(.23, 1.045, .54, .145, .073, color);
    } else if (frame === 'topbar') {
      roundStroke(.035, .025, .93, 1.20, .045, .018);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(S*.055, S*1.02); ctx.lineTo(S*.945, S*1.02);
      ctx.lineTo(S*.955, S*1.095); ctx.lineTo(S*.945, S*1.18);
      ctx.lineTo(S*.055, S*1.18); ctx.lineTo(S*.045, S*1.095); ctx.closePath(); ctx.fill();
    }

    // Draw four modules of white quiet zone inside each QR region.
    const [qx, qy, qw] = layout.qr;
    const count = qrModel.getModuleCount();
    const unit = qw * S / (count + 8);
    const ox = qx*S + unit*4, oy = qy*S + unit*4;
    const fill = el.gradient.checked ? ctx.createLinearGradient(ox, oy, ox + count*unit, oy + count*unit) : el.dark.value;
    if (el.gradient.checked) { fill.addColorStop(0, el.dark.value); fill.addColorStop(1, el.second.value); }
    const isEye = (row, col) => (row < 7 && col < 7) || (row < 7 && col >= count - 7) || (row >= count - 7 && col < 7);
    for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) {
      if (!isEye(row, col) && qrModel.isDark(row, col))
        fillShape(ctx, ox + col*unit, oy + row*unit, unit, el.shape.value, fill);
    }
    for (const [col, row] of [[0,0],[count-7,0],[0,count-7]]) {
      const x = ox + col*unit, y = oy + row*unit, style = el.eye.value;
      fillShape(ctx, x, y, unit*7, style, fill);
      fillShape(ctx, x+unit, y+unit, unit*5, style, '#ffffff');
      fillShape(ctx, x+unit*2, y+unit*2, unit*3, style, fill);
    }
    if (logoImage) {
      const cx = ox + count*unit/2, cy = oy + count*unit/2, backing = count*unit*.22;
      pathRound(ctx, cx-backing/2, cy-backing/2, backing, backing, backing*.15);
      ctx.fillStyle = '#ffffff'; ctx.fill();
      const max = backing*.76, scale = Math.min(max/logoImage.width, max/logoImage.height);
      const w = logoImage.width*scale, h = logoImage.height*scale;
      ctx.drawImage(logoImage, cx-w/2, cy-h/2, w, h);
    }
    if (frame === 'outline') drawText(1.117, .43, true, .049);
    if (frame === 'double') drawText(1.11, .84, true, .064);
    if (frame === 'rounded') drawText(1.11, .48, true, .052);
    if (frame === 'corners') drawText(1.12, .84, false, .062);
    if (frame === 'ticket') drawText(1.275, .72, true, .068);
    if (frame === 'caption') drawText(1.303, .58, true, .047);
    if (frame === 'pill') drawText(1.117, .48, true, .052);
    if (frame === 'topbar') drawText(1.105, .83, true, .064);
    return canvas;
  }
  function renderFrameThumbnails() {
    if (!qrModel) return;
    for (const button of el.framePicker.querySelectorAll('button[data-frame]')) {
      const art = button.querySelector('.frame-art');
      art.replaceChildren(paint(100, button.dataset.frame));
    }
  }
  function render() {
    ready = false;
    currentPayload = '';
    el.png.disabled = el.pdf.disabled = true;
    el.qr.replaceChildren();
    el.source.replaceChildren();
    qrModel = null;
    try {
      currentPayload = buildPayload();
      el.encoded.textContent = typeId === 'wifi' ? 'Network: ' + raw('ssid') : currentPayload;
      if (typeof QRCode === 'undefined') throw Error('The QR library could not load. Check your connection and refresh.');
      const code = new QRCode(el.source, { text: currentPayload, width: 256, height: 256, correctLevel: logoImage ? QRCode.CorrectLevel.H : QRCode.CorrectLevel.M });
      qrModel = code._oQRCode;
      if (!qrModel || typeof qrModel.getModuleCount !== 'function') throw Error('QR generation is unavailable in this browser.');
      const preview = paint(640);
      if (!preview) throw Error('Canvas is unavailable in this browser.');
      el.qr.append(preview);
      renderFrameThumbnails();
      ready = true;
      el.png.disabled = el.pdf.disabled = false;
      setStatus('');
    } catch (error) {
      el.encoded.textContent = typeId === 'wifi' ? 'No password displayed here.' : 'Nothing yet';
      if (typeId === 'wifi') {
        const placeholder = document.createElement('p');
        placeholder.className = 'hint';
        placeholder.textContent = 'Your Wi-Fi QR will appear here.';
        el.qr.append(placeholder);
      }
      setStatus(error.message && !/overflow/i.test(error.message) ? error.message : 'This content is too long for a QR code. Try shorter text.');
    }
  }
  function bindHex(picker, input) {
    picker.addEventListener('input', () => { input.value = picker.value.toUpperCase(); el.colorError.textContent = ''; schedule(); });
    function apply(showError) {
      const match = /^#?([\da-fA-F]{6})$/.exec(input.value.trim());
      if (!match) { if (showError) el.colorError.textContent = 'Enter a 6-digit hex color.'; return; }
      picker.value = '#' + match[1].toUpperCase();
      input.value = picker.value.toUpperCase();
      el.colorError.textContent = '';
      schedule();
    }
    input.addEventListener('input', () => { el.colorError.textContent = ''; apply(false); });
    input.addEventListener('blur', () => apply(true));
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); input.blur(); } });
  }
  el.picker.addEventListener('click', event => { const button = event.target.closest('button[data-type]'); if (button) chooseType(button.dataset.type); });
  el.fields.addEventListener('input', schedule);
  el.fields.addEventListener('change', schedule);
  for (const control of [el.size, el.shape, el.eye, el.caption, el.captionFont, el.gradient]) control.addEventListener('input', schedule);
  el.framePicker.addEventListener('click', event => {
    const button = event.target.closest('button[data-frame]');
    if (!button) return;
    el.frame.value = button.dataset.frame;
    el.captionField.hidden = el.frame.value === 'none';
    for (const option of el.framePicker.querySelectorAll('button[data-frame]')) {
      const selected = option === button;
      option.classList.toggle('active', selected);
      option.setAttribute('aria-pressed', String(selected));
    }
    schedule();
  });
  bindHex(el.dark, el.hex);
  bindHex(el.second, el.secondHex);
  bindHex(el.borderColor, el.borderHex);
  el.logo.addEventListener('change', () => {
    const file = el.logo.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setStatus('Choose a PNG, JPEG, or WebP logo under 2 MB.'); el.logo.value = ''; return; }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); logoImage = image; el.logoName.textContent = file.name; el.clearLogo.hidden = false; schedule(); };
    image.onerror = () => { URL.revokeObjectURL(url); setStatus('This image could not be opened.'); };
    image.src = url;
  });
  el.clearLogo.addEventListener('click', () => { logoImage = null; el.logo.value = ''; el.logoName.textContent = ''; el.clearLogo.hidden = true; schedule(); });
  el.png.addEventListener('click', () => {
    if (!ready) return;
    const canvas = paint(Number(el.size.value));
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = `justmakeqr-${typeId}-${el.size.value}.png`;
    a.href = canvas.toDataURL('image/png');
    document.body.append(a); a.click(); a.remove();
  });
  el.pdf.addEventListener('click', () => {
    if (!ready) return;
    const canvas = paint(Number(el.size.value));
    if (!canvas) return;
    el.printQr.src = canvas.toDataURL('image/png');
    el.printLabel.textContent = typeId === 'link' ? currentPayload : '';
    window.print();
  });
  $('clearWifi')?.addEventListener('click', () => {
    for (const input of el.fields.querySelectorAll('input[name]')) {
      if (input.type === 'checkbox') input.checked = false; else input.value = '';
    }
    el.fields.querySelector('[name="security"]').value = 'WPA';
    delete savedFields.wifi;
    chooseType('wifi');
    render();
    $('field-ssid').focus();
  });
  $('wifiExample')?.addEventListener('click', () => {
    $('field-ssid').value = 'Example Guest Wi-Fi';
    $('field-password').value = 'example-password';
    el.fields.querySelector('[name="hidden"]').checked = false;
    el.fields.querySelector('[name="security"]').value = 'WPA';
    chooseType('wifi');
    render();
  });
  chooseType(pageType || 'link');
  window.addEventListener('load', render);
});
