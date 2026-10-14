/**
 * Resume AI - DOCX export
 *
 * Writes a real .docx (OOXML) file straight from the page, with no
 * dependencies and no server round-trip. A .docx is a ZIP archive holding
 * WordprocessingML parts, so this file contains a small ZIP writer (STORE,
 * i.e. no compression) plus the part builders.
 *
 * Layout fidelity is intentionally limited: Word is a word processor, so the
 * neon/gradient/glassmorphism visuals cannot carry over. Content, order,
 * section headings, contact links and bullet lists are preserved, and the
 * result stays fully editable in Word / Pages / Google Docs.
 *
 * Exposes `window.ResumeDocx`:
 *   exportDocument()            read the live page, download the .docx
 *   buildBlob(blocks, meta)     lower-level, used by tests
 *   blocksFromDom()             extract the document model from the page
 */
(function () {
  'use strict';

  var DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  // Standard CRC-32 (IEEE 802.3) used by the ZIP format.
  var CRC_TABLE = (function () {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) {
      c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  var encoder = new TextEncoder();

  function utf8(str) {
    return encoder.encode(str);
  }

  // ==================== ZIP ====================

  function dosDateTime(date) {
    var time = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() / 2)) & 0xFFFF;
    var day = (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xFFFF;
    return { time: time, date: day };
  }

  function writeU16(view, offset, value) {
    view.setUint16(offset, value & 0xFFFF, true);
  }

  function writeU32(view, offset, value) {
    view.setUint32(offset, value >>> 0, true);
  }

  function zip(files) {
    var stamp = dosDateTime(new Date());
    var localParts = [];
    var centralParts = [];
    var offset = 0;

    files.forEach(function (file) {
      var nameBytes = utf8(file.name);
      var data = typeof file.data === 'string' ? utf8(file.data) : file.data;
      var crc = crc32(data);

      var local = new Uint8Array(30 + nameBytes.length);
      var lv = new DataView(local.buffer);
      writeU32(lv, 0, 0x04034b50);
      writeU16(lv, 4, 20);            // version needed
      writeU16(lv, 6, 0x0800);        // UTF-8 filenames
      writeU16(lv, 8, 0);             // stored, no compression
      writeU16(lv, 10, stamp.time);
      writeU16(lv, 12, stamp.date);
      writeU32(lv, 14, crc);
      writeU32(lv, 18, data.length);
      writeU32(lv, 22, data.length);
      writeU16(lv, 26, nameBytes.length);
      writeU16(lv, 28, 0);
      local.set(nameBytes, 30);
      localParts.push(local, data);

      var central = new Uint8Array(46 + nameBytes.length);
      var cv = new DataView(central.buffer);
      writeU32(cv, 0, 0x02014b50);
      writeU16(cv, 4, 20);            // version made by
      writeU16(cv, 6, 20);            // version needed
      writeU16(cv, 8, 0x0800);
      writeU16(cv, 10, 0);
      writeU16(cv, 12, stamp.time);
      writeU16(cv, 14, stamp.date);
      writeU32(cv, 16, crc);
      writeU32(cv, 20, data.length);
      writeU32(cv, 24, data.length);
      writeU16(cv, 28, nameBytes.length);
      writeU16(cv, 30, 0);            // extra
      writeU16(cv, 32, 0);            // comment
      writeU16(cv, 34, 0);            // disk
      writeU16(cv, 36, 0);            // internal attrs
      writeU32(cv, 38, 0);            // external attrs
      writeU32(cv, 42, offset);
      central.set(nameBytes, 46);
      centralParts.push(central);

      offset += local.length + data.length;
    });

    var centralSize = centralParts.reduce(function (sum, part) { return sum + part.length; }, 0);

    var end = new Uint8Array(22);
    var ev = new DataView(end.buffer);
    writeU32(ev, 0, 0x06054b50);
    writeU16(ev, 4, 0);
    writeU16(ev, 6, 0);
    writeU16(ev, 8, files.length);
    writeU16(ev, 10, files.length);
    writeU32(ev, 12, centralSize);
    writeU32(ev, 16, offset);
    writeU16(ev, 20, 0);

    return new Blob(localParts.concat(centralParts, [end]), { type: DOCX_MIME });
  }

  // ==================== WordprocessingML ====================

  function esc(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      // strip characters that are invalid in XML 1.0
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  }

  var XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';

  var CONTENT_TYPES = XML_HEADER +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    '</Types>';

  var ROOT_RELS = XML_HEADER +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
    '</Relationships>';

  function stylesXml(accent) {
    return XML_HEADER +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        '<w:docDefaults>' +
          '<w:rPrDefault><w:rPr>' +
            '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Microsoft YaHei" w:cs="Calibri"/>' +
            '<w:sz w:val="21"/><w:szCs w:val="21"/>' +
          '</w:rPr></w:rPrDefault>' +
          '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault>' +
        '</w:docDefaults>' +
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
        '<w:style w:type="paragraph" w:styleId="Title">' +
          '<w:name w:val="Title"/><w:basedOn w:val="Normal"/>' +
          '<w:pPr><w:spacing w:after="20"/></w:pPr>' +
          '<w:rPr><w:b/><w:sz w:val="52"/><w:szCs w:val="52"/></w:rPr>' +
        '</w:style>' +
        '<w:style w:type="paragraph" w:styleId="Subtitle">' +
          '<w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/>' +
          '<w:pPr><w:spacing w:after="140"/></w:pPr>' +
          '<w:rPr><w:sz w:val="26"/><w:szCs w:val="26"/><w:color w:val="595959"/></w:rPr>' +
        '</w:style>' +
        '<w:style w:type="paragraph" w:styleId="Heading1">' +
          '<w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/>' +
          '<w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="0"/></w:pPr>' +
          '<w:rPr><w:b/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr>' +
        '</w:style>' +
        '<w:style w:type="paragraph" w:styleId="Heading2">' +
          '<w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/>' +
          '<w:pPr>' +
            '<w:keepNext/><w:spacing w:before="280" w:after="90"/>' +
            '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="3" w:color="D0D0D0"/></w:pBdr>' +
            '<w:outlineLvl w:val="1"/>' +
          '</w:pPr>' +
          '<w:rPr><w:b/><w:color w:val="' + accent + '"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>' +
        '</w:style>' +
        '<w:style w:type="paragraph" w:styleId="ListParagraph">' +
          '<w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/>' +
          '<w:pPr><w:spacing w:after="40"/></w:pPr>' +
        '</w:style>' +
        '<w:style w:type="paragraph" w:styleId="Quote">' +
          '<w:name w:val="Quote"/><w:basedOn w:val="Normal"/>' +
          '<w:pPr><w:ind w:left="360"/></w:pPr>' +
          '<w:rPr><w:i/><w:color w:val="595959"/></w:rPr>' +
        '</w:style>' +
        '<w:style w:type="character" w:styleId="Hyperlink">' +
          '<w:name w:val="Hyperlink"/>' +
          '<w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr>' +
        '</w:style>' +
      '</w:styles>';
  }

  var NUMBERING = XML_HEADER +
    '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:abstractNum w:abstractNumId="0">' +
        '<w:multiLevelType w:val="hybridMultilevel"/>' +
        '<w:lvl w:ilvl="0">' +
          '<w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="\u2022"/><w:lvlJc w:val="left"/>' +
          '<w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr>' +
          '<w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr>' +
        '</w:lvl>' +
      '</w:abstractNum>' +
      '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' +
    '</w:numbering>';

  function coreXml(title) {
    var now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    return XML_HEADER +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
        'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
        '<dc:title>' + esc(title) + '</dc:title>' +
        '<cp:revision>1</cp:revision>' +
        '<dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created>' +
        '<dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified>' +
      '</cp:coreProperties>';
  }

  var APP_XML = XML_HEADER +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
      'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
      '<Application>Resume AI</Application>' +
    '</Properties>';

  function runXml(run, relId) {
    var props = '';
    if (run.bold) props += '<w:b/>';
    if (run.italic) props += '<w:i/>';
    if (run.color) props += '<w:color w:val="' + run.color + '"/>';
    if (run.style) props += '<w:rStyle w:val="' + run.style + '"/>';
    var rPr = props ? '<w:rPr>' + props + '</w:rPr>' : '';
    var text = '<w:t xml:space="preserve">' + esc(run.text) + '</w:t>';
    var inner = rPr + text;
    if (relId) {
      return '<w:hyperlink r:id="' + relId + '"><w:r>' + inner + '</w:r></w:hyperlink>';
    }
    return '<w:r>' + inner + '</w:r>';
  }

  function paragraphXml(block, relLookup) {
    var pPr = '';
    if (block.style) pPr += '<w:pStyle w:val="' + block.style + '"/>';
    if (block.bullet) pPr += '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>';
    if (block.align) pPr += '<w:jc w:val="' + block.align + '"/>';
    if (block.spacingBefore) pPr += '<w:spacing w:before="' + block.spacingBefore + '"/>';

    var runs = (block.runs || []).map(function (run) {
      var relId = null;
      if (run.href && relLookup) relId = relLookup(run.href);
      return runXml(run, relId);
    }).join('');

    return '<w:p>' + (pPr ? '<w:pPr>' + pPr + '</w:pPr>' : '') + runs + '</w:p>';
  }

  /**
   * @param {Array} blocks  document model, see blocksFromDom()
   * @param {Object} meta   { title, accent }
   * @returns {Blob} a .docx archive
   */
  function buildBlob(blocks, meta) {
    meta = meta || {};
    var relationships = [{
      id: 'rIdStyles',
      type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles',
      target: 'styles.xml'
    }, {
      id: 'rIdNumbering',
      type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering',
      target: 'numbering.xml'
    }];
    var relIds = {};

    // One relationship per distinct hyperlink target.
    function relLookup(href) {
      if (relIds[href]) return relIds[href];
      var id = 'rIdLink' + (relationships.length + 1);
      relationships.push({
        id: id,
        type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
        target: href,
        external: true
      });
      relIds[href] = id;
      return id;
    }

    var body = blocks.map(function (block) {
      return paragraphXml(block, relLookup);
    }).join('');

    var documentXml = XML_HEADER +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<w:body>' + body +
        '<w:sectPr>' +
          '<w:pgSz w:w="11906" w:h="16838"/>' +
          '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" ' +
            'w:header="709" w:footer="709" w:gutter="0"/>' +
        '</w:sectPr>' +
        '</w:body>' +
      '</w:document>';

    var documentRels = XML_HEADER +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      relationships.map(function (rel) {
        return '<Relationship Id="' + rel.id + '" Type="' + rel.type + '" Target="' + esc(rel.target) + '"' +
          (rel.external ? ' TargetMode="External"' : '') + '/>';
      }).join('') +
      '</Relationships>';

    return zip([
      { name: '[Content_Types].xml', data: CONTENT_TYPES },
      { name: '_rels/.rels', data: ROOT_RELS },
      { name: 'docProps/core.xml', data: coreXml(meta.title || 'Resume') },
      { name: 'docProps/app.xml', data: APP_XML },
      { name: 'word/document.xml', data: documentXml },
      { name: 'word/_rels/document.xml.rels', data: documentRels },
      { name: 'word/styles.xml', data: stylesXml(meta.accent || '2F5496') },
      { name: 'word/numbering.xml', data: NUMBERING }
    ]);
  }

  // ==================== page -> document model ====================

  var CONTACT_KEYS = ['email', 'phone', 'location', 'website'];

  // Editor-injected chrome must never end up in the exported text: the group
  // add/remove buttons live inside each skill/experience item.
  var CHROME = '.re-group-actions, .re-link-popup, .re-img-overlay, .re-toast, ' +
               '.re-toolbar, .re-contact-popup, .re-crop-overlay, script, style';

  function isVisible(el) {
    var node = el;
    while (node && node.nodeType === 1) {
      var style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (node.classList && (node.classList.contains('re-toolbar') ||
          node.classList.contains('re-toast') ||
          node.classList.contains('re-img-overlay') ||
          node.classList.contains('re-group-actions'))) {
        return false;
      }
      node = node.parentElement;
    }
    return true;
  }

  function cleanClone(el) {
    var clone = el.cloneNode(true);
    Array.prototype.forEach.call(clone.querySelectorAll(CHROME), function (node) {
      if (node.parentNode) node.parentNode.removeChild(node);
    });
    return clone;
  }

  function textOf(el) {
    if (!el) return '';
    return (cleanClone(el).textContent || '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Multi-line fields. Templates author line breaks either as real newlines or
   * as a literal "\n" escape, so accept both and normalise to an array of lines.
   */
  function linesOf(el) {
    if (!el) return [];
    var clone = cleanClone(el);
    Array.prototype.forEach.call(clone.querySelectorAll('br'), function (br) {
      br.parentNode.replaceChild(document.createTextNode('\n'), br);
    });
    var raw = (clone.textContent || '').replace(/\\n/g, '\n');
    return raw.split('\n').map(function (line) {
      return line.replace(/^[\s\u2022\u00B7*-]+/, '').trim();
    }).filter(function (line) { return !!line; });
  }

  function hexColor(value) {
    if (!value) return '';
    var v = value.trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) return v.slice(1).toUpperCase();
    if (/^#[0-9a-f]{3}$/i.test(v)) {
      return (v[1] + v[1] + v[2] + v[2] + v[3] + v[3]).toUpperCase();
    }
    var m = v.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    if (m) {
      return [m[1], m[2], m[3]].map(function (n) {
        var h = parseInt(n, 10).toString(16).toUpperCase();
        return h.length === 1 ? '0' + h : h;
      }).join('');
    }
    return '';
  }

  /**
   * Read the rendered resume and produce a flat list of paragraph blocks.
   *
   * Works from the live DOM (read-only), so the export automatically reflects
   * the user's edits, hidden contact fields and the active language.
   *
   * Repeatable entries are keyed by their `[data-editable-item]` element rather
   * than by field order: templates order the fields differently (terminal-cli
   * puts `duration` before `position`), and sequence-based accumulation would
   * attach a date to the wrong job.
   */
  function blocksFromDom() {
    var root = document.querySelector('.resume') || document.body;
    var blocks = [];
    var contacts = [];
    var skills = [];
    var entry = null;
    var currentItem = null;

    function flushContacts() {
      if (!contacts.length) return;
      var runs = [];
      contacts.forEach(function (contact, index) {
        if (index) runs.push({ text: '  \u00B7  ' });
        runs.push({ text: contact.text, href: contact.href });
      });
      blocks.push({ runs: runs });
      contacts = [];
    }

    function flushSkills() {
      if (!skills.length) return;
      blocks.push({ runs: [{ text: skills.join('  \u00B7  ') }] });
      skills = [];
    }

    function flushEntry() {
      if (!entry) return;
      var heading = [];
      var label = entry.position || entry.degree;
      if (label) heading.push({ text: label, bold: true });
      if (entry.duration) {
        if (heading.length) heading.push({ text: '  \u2014  ', color: '808080' });
        heading.push({ text: entry.duration, color: '808080' });
      }
      if (heading.length) blocks.push({ runs: heading });

      var subtitle = entry.company || entry.school;
      if (subtitle) blocks.push({ runs: [{ text: subtitle, italic: true, color: '404040' }] });

      (entry.description || []).forEach(function (line) {
        blocks.push({ bullet: true, style: 'ListParagraph', runs: [{ text: line }] });
      });
      entry = null;
    }

    function ensureEntry() {
      if (!entry) entry = { description: [] };
      return entry;
    }

    var nodes = root.querySelectorAll('.section-title, [data-editable]');

    Array.prototype.forEach.call(nodes, function (node) {
      if (!isVisible(node)) return;

      if (node.classList.contains('section-title')) {
        flushEntry();
        flushSkills();
        flushContacts();
        currentItem = null;
        var heading = textOf(node);
        if (heading) blocks.push({ style: 'Heading2', runs: [{ text: heading }] });
        return;
      }

      var key = node.getAttribute('data-editable');
      if (!key || key === 'avatar') return;

      // Skills are repeatable items of their own; collect them separately.
      if (key === 'skill') {
        flushEntry();
        flushContacts();
        currentItem = null;
        var skill = textOf(node);
        if (skill) skills.push(skill);
        return;
      }

      // Entering a different repeatable item closes the previous entry.
      var item = node.closest('[data-editable-item]');
      if (item !== currentItem) {
        flushEntry();
        currentItem = item;
      }

      var text = textOf(node);

      if (key === 'name') {
        flushSkills(); flushContacts();
        if (text) blocks.push({ style: 'Title', runs: [{ text: text }] });
        return;
      }

      if (key === 'title') {
        flushSkills(); flushContacts();
        if (text) blocks.push({ style: 'Subtitle', runs: [{ text: text }] });
        return;
      }

      if (CONTACT_KEYS.indexOf(key) !== -1) {
        flushEntry();
        flushSkills();
        currentItem = null;
        if (!text) return;
        var href = '';
        if (key === 'email') href = 'mailto:' + text;
        if (key === 'website') href = /^https?:\/\//i.test(text) ? text : 'https://' + text;
        contacts.push({ text: text, href: href });
        return;
      }

      if (key === 'summary' || key === 'language') {
        flushEntry();
        flushSkills();
        flushContacts();
        currentItem = null;
        if (text) blocks.push({ runs: [{ text: text }] });
        return;
      }

      if (key === 'quote-motto') {
        flushEntry();
        flushSkills();
        flushContacts();
        currentItem = null;
        if (text) blocks.push({ style: 'Quote', runs: [{ text: text, italic: true }] });
        return;
      }

      if (key === 'position' || key === 'degree') {
        flushSkills(); flushContacts();
        ensureEntry()[key] = text;
        return;
      }

      if (key === 'duration') {
        if (text) ensureEntry().duration = text;
        return;
      }

      if (key === 'company' || key === 'school') {
        if (text) ensureEntry()[key] = text;
        return;
      }

      if (key === 'description' || key === 'deal-highlight') {
        var lines = linesOf(node);
        var target = ensureEntry();
        target.description = target.description.concat(lines);
        return;
      }

      // Unknown field inside an item belongs to that item's description;
      // elsewhere keep the content rather than dropping it.
      if (currentItem) {
        if (text) ensureEntry().description.push(text);
      } else {
        flushSkills(); flushContacts();
        if (text) blocks.push({ runs: [{ text: text }] });
      }
    });

    flushEntry();
    flushSkills();
    flushContacts();
    return blocks;
  }

  function defaultFilename() {
    var name = document.querySelector('[data-editable="name"]');
    var stem = (location.pathname.split('/').pop() || 'resume').replace(/\.html?$/i, '');
    var label = name ? textOf(name) : '';
    var base = label ? label + ' - ' + stem : stem;
    return base.replace(/[\\/:*?"<>|]+/g, '').trim() + '.docx';
  }

  function accentColor() {
    var raw = window.getComputedStyle(document.documentElement).getPropertyValue('--accent') ||
              window.getComputedStyle(document.documentElement).getPropertyValue('--primary');
    return hexColor(raw) || '2F5496';
  }

  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function exportDocument() {
    var blocks = blocksFromDom();
    if (!blocks.length) return null;
    var blob = buildBlob(blocks, { title: document.title, accent: accentColor() });
    var filename = defaultFilename();
    download(blob, filename);
    return { blob: blob, filename: filename, blocks: blocks };
  }

  window.ResumeDocx = {
    exportDocument: exportDocument,
    blocksFromDom: blocksFromDom,
    buildBlob: buildBlob,
    defaultFilename: defaultFilename
  };
})();
