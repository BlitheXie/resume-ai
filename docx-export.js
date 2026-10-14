/**
 * Resume Work - DOCX export
 *
 * Writes a real .docx (OOXML) file straight from the page, with no
 * dependencies and no server round-trip. A .docx is a ZIP archive holding
 * WordprocessingML parts, so this file contains a small ZIP writer (STORE,
 * i.e. no compression) plus the part builders.
 *
 * Styling is read back from the rendered page (getComputedStyle): text colour,
 * font, size, weight, letter-spacing, text-transform, alignment, backgrounds
 * and borders all carry over, and a two-column template is rebuilt as a table.
 * Raster-only effects (gradients, blur/glassmorphism, box-shadow) cannot be
 * expressed in WordprocessingML and are approximated by their first colour.
 *
 * Exposes `window.ResumeDocx`:
 *   exportDocument()            read the live page, download the .docx
 *   buildBlob(model, meta)      lower-level, used by tests
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

  /**
   * Named styles carry structure (outline levels) only. Every visible property
   * is written as direct formatting from the page's computed styles, so the
   * styles here must not set colours, borders or sizes that could win over it.
   */
  function stylesXml() {
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
        '</w:style>' +
        '<w:style w:type="paragraph" w:styleId="Subtitle">' +
          '<w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/>' +
          '<w:pPr><w:spacing w:after="140"/></w:pPr>' +
        '</w:style>' +
        '<w:style w:type="paragraph" w:styleId="Heading1">' +
          '<w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/>' +
          '<w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="0"/></w:pPr>' +
        '</w:style>' +
        '<w:style w:type="paragraph" w:styleId="Heading2">' +
          '<w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/>' +
          '<w:pPr><w:keepNext/><w:spacing w:before="280" w:after="90"/><w:outlineLvl w:val="1"/></w:pPr>' +
        '</w:style>' +
        '<w:style w:type="paragraph" w:styleId="ListParagraph">' +
          '<w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/>' +
          '<w:pPr><w:spacing w:after="40"/></w:pPr>' +
        '</w:style>' +
        '<w:style w:type="paragraph" w:styleId="Quote">' +
          '<w:name w:val="Quote"/><w:basedOn w:val="Normal"/>' +
          '<w:pPr><w:ind w:left="360"/></w:pPr>' +
        '</w:style>' +
        '<w:style w:type="character" w:styleId="Hyperlink">' +
          '<w:name w:val="Hyperlink"/>' +
          '<w:rPr><w:u w:val="single"/></w:rPr>' +
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
      '<Application>Resume Work</Application>' +
    '</Properties>';

  function runXml(run, relId) {
    var props = '';
    if (run.style) props += '<w:rStyle w:val="' + run.style + '"/>';
    var font = run.font || 'Calibri';
    var eastAsia = run.eastAsia || font;
    props += '<w:rFonts w:ascii="' + esc(font) + '" w:hAnsi="' + esc(font) +
             '" w:eastAsia="' + esc(eastAsia) + '" w:cs="' + esc(font) + '"/>';
    if (run.bold) props += '<w:b/><w:bCs/>';
    if (run.italic) props += '<w:i/><w:iCs/>';
    if (run.caps) props += '<w:caps/>';
    if (run.color) props += '<w:color w:val="' + run.color + '"/>';
    if (run.spacingTw) props += '<w:spacing w:val="' + run.spacingTw + '"/>';
    if (run.sizeHalfPt) props += '<w:sz w:val="' + run.sizeHalfPt + '"/><w:szCs w:val="' + run.sizeHalfPt + '"/>';
    if (run.underline) props += '<w:u w:val="single"/>';
    if (run.bg) props += '<w:shd w:val="clear" w:color="auto" w:fill="' + run.bg + '"/>';

    var inner = '<w:rPr>' + props + '</w:rPr><w:t xml:space="preserve">' + esc(run.text) + '</w:t>';
    if (relId) {
      return '<w:hyperlink r:id="' + relId + '"><w:r>' + inner + '</w:r></w:hyperlink>';
    }
    return '<w:r>' + inner + '</w:r>';
  }

  function paragraphXml(block, relLookup) {
    // CT_PPr child order is a sequence in the schema; keep this order.
    var pPr = '';
    if (block.style) pPr += '<w:pStyle w:val="' + block.style + '"/>';
    if (block.keepNext) pPr += '<w:keepNext/>';
    if (block.bullet) pPr += '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>';
    if (block.borders) pPr += '<w:pBdr>' + block.borders + '</w:pBdr>';
    if (block.bg) pPr += '<w:shd w:val="clear" w:color="auto" w:fill="' + block.bg + '"/>';
    if (block.spacingBefore || block.spacingAfter) {
      pPr += '<w:spacing' +
        (block.spacingBefore ? ' w:before="' + block.spacingBefore + '"' : '') +
        (block.spacingAfter ? ' w:after="' + block.spacingAfter + '"' : '') + '/>';
    }
    if (block.indent) pPr += '<w:ind w:left="' + block.indent + '"/>';
    if (block.align && block.align !== 'left') pPr += '<w:jc w:val="' + block.align + '"/>';

    var runs = (block.runs || []).map(function (run) {
      var relId = null;
      if (run.href && relLookup) relId = relLookup(run.href);
      return runXml(run, relId);
    }).join('');

    return '<w:p>' + (pPr ? '<w:pPr>' + pPr + '</w:pPr>' : '') + runs + '</w:p>';
  }

  var NO_BORDERS = '<w:tblBorders>' +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function (side) {
      return '<w:' + side + ' w:val="none" w:sz="0" w:space="0" w:color="auto"/>';
    }).join('') + '</w:tblBorders>';

  function cellMarginsXml(padding) {
    return '<w:tcMar>' +
      '<w:top w:w="' + padding.top + '" w:type="dxa"/>' +
      '<w:left w:w="' + padding.left + '" w:type="dxa"/>' +
      '<w:bottom w:w="' + padding.bottom + '" w:type="dxa"/>' +
      '<w:right w:w="' + padding.right + '" w:type="dxa"/>' +
    '</w:tcMar>';
  }

  /**
   * One table carries both the page background and the column layout: every
   * band is a row, single-column bands span the whole grid, and multi-column
   * bands contribute one cell per column. Keeping it to a single table avoids
   * nesting and lets the shading run edge to edge.
   */
  function tableXml(model, relLookup) {
    var grid = model.grid;
    var rows = model.bands.map(function (band) {
      var full = band.kind === 'full';
      var cells = band.cells.map(function (cell, index) {
        var tcPr = '<w:tcW w:w="' + (full ? model.totalWidth : grid[index]) + '" w:type="dxa"/>';
        if (full && grid.length > 1) tcPr += '<w:gridSpan w:val="' + grid.length + '"/>';
        if (cell.bg) tcPr += '<w:shd w:val="clear" w:color="auto" w:fill="' + cell.bg + '"/>';
        tcPr += cellMarginsXml(cell.padding);
        var inner = cell.blocks.map(function (block) {
          return paragraphXml(block, relLookup);
        }).join('');
        return '<w:tc><w:tcPr>' + tcPr + '</w:tcPr>' + (inner || '<w:p/>') + '</w:tc>';
      }).join('');
      return '<w:tr>' + cells + '</w:tr>';
    }).join('');

    return '<w:tbl><w:tblPr>' +
        '<w:tblW w:w="' + model.totalWidth + '" w:type="dxa"/>' +
        '<w:tblInd w:w="0" w:type="dxa"/>' +
        NO_BORDERS +
        '<w:tblLayout w:type="fixed"/>' +
      '</w:tblPr>' +
      '<w:tblGrid>' + grid.map(function (width) {
        return '<w:gridCol w:w="' + width + '"/>';
      }).join('') + '</w:tblGrid>' +
      rows +
    '</w:tbl><w:p/>';
  }

  function bodyXml(model, relLookup) {
    if (!model.table) {
      return model.bands.reduce(function (xml, band) {
        return xml + band.cells.reduce(function (cellXml, cell) {
          return cellXml + cell.blocks.map(function (block) {
            return paragraphXml(block, relLookup);
          }).join('');
        }, '');
      }, '');
    }
    return tableXml(model, relLookup);
  }

  /**
   * @param {Object} model  document model, see blocksFromDom()
   * @param {Object} meta   { title, accent }
   * @returns {Blob} a .docx archive
   */
  function buildBlob(model, meta) {
    meta = meta || {};

    // Accept a bare block array too, so callers with a flat list keep working.
    if (Array.isArray(model)) {
      model = normalizeModel({ bands: [{ kind: 'full', cells: [{ blocks: model, padding: null }] }] });
    }

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

    var page = model.page;
    var background = (model.pageBg && model.pageBg !== 'FFFFFF')
      ? '<w:background w:color="' + model.pageBg + '"/>'
      : '';

    var documentXml = XML_HEADER +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        background +
        '<w:body>' + bodyXml(model, relLookup) +
        '<w:sectPr>' +
          '<w:pgSz w:w="' + page.width + '" w:h="' + page.height + '"/>' +
          '<w:pgMar w:top="' + page.top + '" w:right="' + page.right + '" ' +
            'w:bottom="' + page.bottom + '" w:left="' + page.left + '" ' +
            'w:header="0" w:footer="0" w:gutter="0"/>' +
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
      { name: 'word/styles.xml', data: stylesXml(meta.accent) },
      { name: 'word/numbering.xml', data: NUMBERING }
    ]);
  }

  // ==================== units, colour and fonts ====================

  var DEFAULT_PADDING = { top: 340, right: 720, bottom: 340, left: 720 };

  // 1px = 0.75pt = 15 twips; w:sz is in half-points, so 1px = 1.5 half-points.
  function pxToTwips(px) {
    return Math.round((px || 0) * 15);
  }

  function pxToHalfPt(px) {
    return Math.max(2, Math.round((px || 11) * 1.5));
  }

  function parseColor(value) {
    if (!value) return null;
    var v = String(value).trim().toLowerCase();
    if (v === 'transparent' || v === 'none') return null;
    var m = v.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+%?))?\s*\)/);
    if (m) {
      var alpha = 1;
      if (m[4] !== undefined) {
        alpha = m[4].indexOf('%') !== -1 ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      }
      return { r: +m[1], g: +m[2], b: +m[3], a: isNaN(alpha) ? 1 : alpha };
    }
    if (/^#[0-9a-f]{6}$/.test(v)) {
      return { r: parseInt(v.substr(1, 2), 16), g: parseInt(v.substr(3, 2), 16), b: parseInt(v.substr(5, 2), 16), a: 1 };
    }
    if (/^#[0-9a-f]{3}$/.test(v)) {
      return {
        r: parseInt(v[1] + v[1], 16),
        g: parseInt(v[2] + v[2], 16),
        b: parseInt(v[3] + v[3], 16),
        a: 1
      };
    }
    return null;
  }

  function toHex(color) {
    function channel(value) {
      var n = Math.max(0, Math.min(255, Math.round(value)));
      return (n < 16 ? '0' : '') + n.toString(16).toUpperCase();
    }
    return channel(color.r) + channel(color.g) + channel(color.b);
  }

  function hexOf(value) {
    var color = parseColor(value);
    return color ? toHex(color) : '';
  }

  function composite(front, back) {
    var fa = front.a === undefined ? 1 : front.a;
    var ba = back.a === undefined ? 1 : back.a;
    var a = fa + ba * (1 - fa);
    if (a <= 0) return { r: 255, g: 255, b: 255, a: 0 };
    return {
      r: (front.r * fa + back.r * ba * (1 - fa)) / a,
      g: (front.g * fa + back.g * ba * (1 - fa)) / a,
      b: (front.b * fa + back.b * ba * (1 - fa)) / a,
      a: a
    };
  }

  function closeColor(a, b, tolerance) {
    var tol = tolerance === undefined ? 6 : tolerance;
    return Math.abs(a.r - b.r) <= tol && Math.abs(a.g - b.g) <= tol && Math.abs(a.b - b.b) <= tol;
  }

  function transparent(color) {
    return !color || color.a === 0;
  }

  /**
   * Background layers painted by one element, innermost (its own fill) first.
   * A gradient is reported as its first colour stop, since Word has no
   * gradient fill for text runs.
   */
  function bgLayers(el, useGradient) {
    var style = window.getComputedStyle(el);
    var layers = [];
    var solid = parseColor(style.backgroundColor);
    if (!transparent(solid)) {
      layers.push(solid);
      if (solid.a >= 1) return layers;
    }
    if (useGradient && style.backgroundImage && style.backgroundImage !== 'none') {
      var stops = style.backgroundImage.match(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}/g);
      if (stops) {
        var stop = parseColor(stops[0]);
        if (stop) {
          stop.a = 1;
          layers.push(stop);
          return layers;
        }
      }
    }
    return layers;
  }

  /**
   * The colour actually seen behind `el`, compositing translucent fills over
   * their ancestors. Returns null when nothing is painted anywhere up the
   * chain, which lets callers tell "page colour" from "no background".
   *
   * `base` is what a chain of purely translucent fills is painted onto; pass
   * the page colour, or a 5% white chip would composite to near-white even on
   * a black page.
   */
  function effectiveBg(el, stopAt, useGradient, base) {
    var chain = [];
    var node = el;
    while (node && node.nodeType === 1) {
      var layers = bgLayers(node, useGradient);
      var opaque = false;
      for (var i = 0; i < layers.length; i++) {
        chain.push(layers[i]);
        if (layers[i].a >= 1) { opaque = true; break; }
      }
      if (opaque || node === stopAt) break;
      node = node.parentElement;
    }
    if (!chain.length) return null;
    var result = chain[chain.length - 1];
    if (result.a < 1) result = composite(result, base || { r: 255, g: 255, b: 255, a: 1 });
    for (var j = chain.length - 2; j >= 0; j--) {
      result = composite(chain[j], result);
    }
    return { r: result.r, g: result.g, b: result.b };
  }

  // Web-only families need a substitute, otherwise Word falls back to a
  // serif default and the design collapses.
  var FONT_MAP = {
    '-apple-system': 'Segoe UI',
    'blinkmacsystemfont': 'Segoe UI',
    'system-ui': 'Segoe UI',
    'inter': 'Segoe UI',
    'sf mono': 'Consolas',
    'sfmono': 'Consolas',
    'pingfang sc': 'Microsoft YaHei',
    'helvetica neue': 'Helvetica',
    'ui-monospace': 'Consolas'
  };

  var CJK_FONTS = /yahei|song|hei|kai|ming|pingfang|noto sans (sc|cjk)|sans-serif cjk/i;

  function fontName(family) {
    var first = String(family || '').split(',')[0].replace(/["']/g, '').trim();
    return FONT_MAP[first.toLowerCase()] || first || 'Calibri';
  }

  function eastAsiaFont(name) {
    return CJK_FONTS.test(name) ? name : 'Microsoft YaHei';
  }

  var ALIGN_MAP = {
    start: 'left', left: 'left', end: 'right', right: 'right',
    center: 'center', justify: 'both', 'justify-all': 'both'
  };

  /** Text properties of an element (or one of its pseudo-elements). */
  function styleOf(el, pseudo) {
    var style = window.getComputedStyle(el, pseudo || null);
    var letterSpacing = parseFloat(style.letterSpacing);
    var weight = style.fontWeight === 'bold' ? 700 : parseInt(style.fontWeight, 10);
    var font = fontName(style.fontFamily);
    return {
      color: hexOf(style.color) || '000000',
      font: font,
      eastAsia: eastAsiaFont(font),
      sizeHalfPt: pxToHalfPt(parseFloat(style.fontSize)),
      bold: !isNaN(weight) && weight >= 600,
      italic: style.fontStyle === 'italic' || style.fontStyle === 'oblique',
      caps: style.textTransform === 'uppercase',
      spacingTw: isNaN(letterSpacing) ? 0 : Math.round(letterSpacing * 15),
      align: ALIGN_MAP[style.textAlign] || 'left'
    };
  }

  function runFromStyle(text, style) {
    return {
      text: text,
      color: style.color,
      font: style.font,
      eastAsia: style.eastAsia,
      sizeHalfPt: style.sizeHalfPt,
      bold: style.bold,
      italic: style.italic,
      caps: style.caps,
      spacingTw: style.spacingTw
    };
  }

  /** Decorative `::before` / `::after` text, e.g. the "> " on cyberpunk headings. */
  function pseudoRun(el, which) {
    var style = window.getComputedStyle(el, which);
    if (!style) return null;
    var content = style.content;
    if (!content || content === 'none' || content === 'normal' || content === '""' || content === "''") return null;
    if (/^url\(/i.test(content)) return null;
    var text = content.replace(/^["']/, '').replace(/["']$/, '');
    if (!text.trim()) return null;
    // CSS separates these markers with a margin rather than a literal space.
    text = which === '::before' ? text.replace(/\s*$/, ' ') : text.replace(/^\s*/, ' ');
    return runFromStyle(text, styleOf(el, which));
  }

  /**
   * Paragraph-level decoration. Shading is taken from the element or its
   * immediate parent only, so chips, tags and banner headings get their fill
   * without striping every paragraph inside a card.
   */
  function decorationOf(el, pageColor) {
    var decoration = { bg: '', borders: '' };

    var candidates = [el.parentElement, el];
    for (var i = 0; i < candidates.length && !decoration.bg; i++) {
      var node = candidates[i];
      if (!node || node.nodeType !== 1) continue;
      var bg = effectiveBg(node, node.parentElement || node, false, pageColor);
      // Slightly looser than the page comparison: a fill that is visually the
      // page colour just adds noise to the document.
      if (bg && !closeColor(bg, pageColor, 10)) decoration.bg = toHex(bg);
    }

    var style = window.getComputedStyle(el);
    var sides = [['left', 'Left'], ['top', 'Top'], ['bottom', 'Bottom'], ['right', 'Right']];
    for (var s = 0; s < sides.length; s++) {
      var borderStyle = style['border' + sides[s][1] + 'Style'];
      var width = parseFloat(style['border' + sides[s][1] + 'Width']) || 0;
      if (borderStyle && borderStyle !== 'none' && width > 0) {
        var size = Math.min(96, Math.max(2, Math.round(width * 6)));
        decoration.borders += '<w:' + sides[s][0] + ' w:val="single" w:sz="' + size +
          '" w:space="1" w:color="' + (hexOf(style['border' + sides[s][1] + 'Color']) || '000000') + '"/>';
      }
    }
    return decoration;
  }

  function paddingOf(el) {
    if (!el || el.nodeType !== 1) return DEFAULT_PADDING;
    var style = window.getComputedStyle(el);
    var left = Math.min(2880, pxToTwips(parseFloat(style.paddingLeft) || 0));
    var right = Math.min(2880, pxToTwips(parseFloat(style.paddingRight) || 0));
    // A full-bleed table reaches the page edge, so a cell with no padding at
    // all would set text flush against it.
    if (left === 0 && right === 0) { left = right = 340; }
    return {
      top: Math.min(2880, pxToTwips(parseFloat(style.paddingTop) || 0)),
      right: right,
      bottom: Math.min(2880, pxToTwips(parseFloat(style.paddingBottom) || 0)),
      left: left
    };
  }

  // ==================== page geometry ====================

  var A4 = { width: 11906, height: 16838 };
  var LETTER = { width: 12240, height: 15840 };

  function lengthToTwips(value) {
    var m = /^([\d.]+)\s*(px|mm|cm|in|pt)?$/.exec(String(value).trim());
    if (!m) return null;
    var n = parseFloat(m[1]);
    var unit = m[2] || 'px';
    if (unit === 'mm') return Math.round(n * 56.6929);
    if (unit === 'cm') return Math.round(n * 566.929);
    if (unit === 'in') return Math.round(n * 1440);
    if (unit === 'pt') return Math.round(n * 20);
    return Math.round(n * 15);
  }

  /** Collect every `@page` rule, descending into `@media`/`@supports`. */
  function pageRuleTexts() {
    var found = [];
    function collect(rules) {
      for (var i = 0; i < rules.length; i++) {
        var rule = rules[i];
        if (/^\s*@page/.test(rule.cssText || '')) found.push(rule.cssText);
        if (rule.cssRules && rule.cssRules.length) collect(rule.cssRules);
      }
    }
    var sheets = document.styleSheets;
    for (var s = 0; s < sheets.length; s++) {
      var rules;
      try { rules = sheets[s].cssRules; } catch (e) { continue; }  // cross-origin
      if (rules) collect(rules);
    }
    return found;
  }

  /** Read the template's `@page` rule so the .docx keeps its page geometry. */
  function pageSetup() {
    var setup = { width: A4.width, height: A4.height, top: 1134, right: 1134, bottom: 1134, left: 1134 };
    var texts = pageRuleTexts();

    for (var i = 0; i < texts.length; i++) {
      var text = texts[i];

      var size = text.match(/size\s*:\s*([^;}]+)/i);
      if (size) {
        if (/letter/i.test(size[1])) { setup.width = LETTER.width; setup.height = LETTER.height; }
        else if (/a4/i.test(size[1])) { setup.width = A4.width; setup.height = A4.height; }
      }

      var margin = text.match(/margin\s*:\s*([^;}]+)/i);
      if (margin) {
        var parts = margin[1].trim().split(/\s+/).map(lengthToTwips);
        if (parts.length && parts[0] !== null) {
          var top, right, bottom, left;
          if (parts.length === 1) { top = right = bottom = left = parts[0]; }
          else if (parts.length === 2) { top = bottom = parts[0]; right = left = parts[1]; }
          else if (parts.length === 3) { top = parts[0]; right = left = parts[1]; bottom = parts[2]; }
          else { top = parts[0]; right = parts[1]; bottom = parts[2]; left = parts[3]; }
          setup.top = top || 0; setup.right = right || 0;
          setup.bottom = bottom || 0; setup.left = left || 0;
        }
      }
    }
    return setup;
  }

  // ==================== page -> document model ====================

  var CONTACT_KEYS = ['email', 'phone', 'location', 'website'];

  // Editor-injected chrome must never end up in the exported text: the group
  // add/remove buttons live inside each skill/experience item.
  var CHROME = '.re-group-actions, .re-link-popup, .re-img-overlay, .re-toast, ' +
               '.re-toolbar, .re-contact-popup, .re-crop-overlay, script, style';

  var CHROME_CLASS = /(^|\s)(re-toolbar|re-toast|re-img-overlay|re-group-actions|re-contact-popup|re-crop-overlay)(\s|$)/;

  function isVisible(el) {
    var node = el;
    while (node && node.nodeType === 1) {
      var style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (node.className && CHROME_CLASS.test(node.className)) return false;
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

  /**
   * A two-column template lays its sidebar and main column out with flex/grid.
   * Requiring several children that each contain a `.section-title` avoids
   * mistaking a flex contact row or toolbar for a column layout.
   */
  function findColumns(root) {
    var found = null;

    function walk(el, depth) {
      if (found || depth > 3) return;
      var style = window.getComputedStyle(el);
      var children = Array.prototype.filter.call(el.children, function (child) {
        return !(child.className && CHROME_CLASS.test(child.className));
      });
      if ((style.display === 'flex' || style.display === 'grid') &&
          style.flexDirection !== 'column' && children.length >= 2) {
        var sized = children.filter(function (child) {
          return child.getBoundingClientRect().width > 20;
        });
        var withSections = sized.filter(function (child) {
          return child.querySelector('.section-title');
        });
        if (sized.length >= 2 && withSections.length >= 2) {
          found = { cells: sized };
          return;
        }
      }
      Array.prototype.forEach.call(children, function (child) { walk(child, depth + 1); });
    }

    walk(root, 0);
    return found;
  }

  /** The direct child of `root` that holds `node`, used for band padding. */
  function bandContainer(node, root) {
    var current = node;
    while (current && current.parentElement && current.parentElement !== root) {
      current = current.parentElement;
    }
    return current && current.parentElement === root ? current : root;
  }

  function emptyCell(padding, bg) {
    return { blocks: [], padding: padding || DEFAULT_PADDING, bg: bg || '' };
  }

  function normalizeModel(model) {
    if (!model.page) {
      model.page = { width: A4.width, height: A4.height, top: 1134, right: 1134, bottom: 1134, left: 1134 };
    }
    if (model.totalWidth === undefined) {
      model.totalWidth = Math.max(1440, model.page.width - model.page.left - model.page.right);
    }
    if (!model.pageBg) model.pageBg = 'FFFFFF';
    if (model.table === undefined) model.table = false;
    model.bands = model.bands || [];
    model.bands.forEach(function (band) {
      if (!band.kind) band.kind = band.cells && band.cells.length > 1 ? 'cols' : 'full';
      if (!band.cells || !band.cells.length) band.cells = [emptyCell(null, model.pageBg)];
      band.cells.forEach(function (cell) {
        if (!cell.padding) cell.padding = DEFAULT_PADDING;
        if (!cell.blocks) cell.blocks = [];
      });
    });
    model.grid = model.grid && model.grid.length ? model.grid : [model.totalWidth];
    return model;
  }

  /**
   * Read the rendered resume and produce a styled document model.
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
    var page = pageSetup();
    var pageColor = effectiveBg(root, null, true) || { r: 255, g: 255, b: 255 };
    var pageBg = toHex(pageColor);
    var columns = findColumns(root);

    var bands = [];
    var out = null;
    var contacts = [];
    var skills = [];
    var entry = null;
    var currentItem = null;
    var band = null;
    var lastZone = null;
    var lastIndex = -99;

    function flushContacts() {
      if (!contacts.length) return;
      var runs = [];
      contacts.forEach(function (contact, index) {
        if (index) runs.push({ text: '  \u00B7  ' });
        runs.push({ text: contact.text, href: contact.href });
      });
      out.push({ runs: runs, align: contacts[0].align, spacingAfter: 40 });
      contacts = [];
    }

    function flushSkills() {
      if (!skills.length) return;
      var runs = [];
      skills.forEach(function (skill, index) {
        if (index) runs.push({ text: '  \u00B7  ' });
        runs.push(skill.run);
      });
      out.push({ runs: runs, align: skills[0].align, spacingAfter: 40 });
      skills = [];
    }

    function flushEntry() {
      if (!entry) return;
      var labelStyle = entry.positionStyle || entry.subtitleStyle;
      var heading = [];
      var label = entry.position || entry.degree;
      if (label && labelStyle) {
        var labelRun = runFromStyle(label, labelStyle);
        labelRun.bold = true;
        heading.push(labelRun);
      }
      if (entry.duration) {
        var durationStyle = entry.durationStyle || labelStyle;
        if (durationStyle) {
          if (heading.length) heading.push(runFromStyle('  \u2014  ', durationStyle));
          heading.push(runFromStyle(entry.duration, durationStyle));
        }
      }
      if (heading.length) {
        out.push({
          runs: heading,
          style: 'ListParagraph',
          align: entry.align,
          keepNext: true,
          spacingAfter: 20
        });
      }
      if (entry.company || entry.school) {
        var subtitleRun = runFromStyle(entry.company || entry.school, entry.subtitleStyle || labelStyle);
        subtitleRun.italic = true;
        out.push({ runs: [subtitleRun], align: entry.align, spacingAfter: 40 });
      }
      (entry.description || []).forEach(function (line) {
        var run = entry.descriptionStyle ? runFromStyle(line, entry.descriptionStyle) : { text: line };
        out.push({ bullet: true, style: 'ListParagraph', runs: [run], align: entry.align });
      });
      entry = null;
    }

    function flushAll() {
      flushEntry();
      flushSkills();
      flushContacts();
    }

    function ensureEntry() {
      if (!entry) entry = { description: [] };
      return entry;
    }

    /** Start a new table row whenever the node moves to another band/column. */
    function enterZone(node) {
      var index = -1;
      if (columns) {
        for (var i = 0; i < columns.cells.length; i++) {
          if (columns.cells[i].contains(node)) { index = i; break; }
        }
      }
      var zone = index < 0 ? 'full' : 'cols';
      if (zone !== lastZone || (zone === 'cols' && index !== lastIndex && index !== lastIndex + 1)) {
        flushAll();
        band = { kind: zone, cells: [] };
        bands.push(band);
      }
      lastZone = zone;
      lastIndex = index;

      if (zone === 'full') {
        if (!band.cells[0]) {
          band.cells[0] = emptyCell(paddingOf(bandContainer(node, root)), pageBg);
        }
      } else if (!band.cells[index]) {
        var column = columns.cells[index];
        var columnBg = effectiveBg(column, root, false, pageColor) || pageColor;
        band.cells[index] = emptyCell(paddingOf(column), toHex(columnBg));
      }
      out = band.cells[zone === 'full' ? 0 : index].blocks;
    }

    /** Build a paragraph from an element, carrying its rendered text style. */
    function push(el, options) {
      var style = styleOf(el);
      var decoration = decorationOf(el, pageColor);
      var block = {
        style: options.style || null,
        align: options.align || style.align,
        bg: decoration.bg,
        borders: decoration.borders,
        keepNext: !!options.keepNext,
        spacingAfter: options.spacingAfter,
        runs: [runFromStyle(options.text, style)]
      };
      out.push(block);
    }

    var nodes = root.querySelectorAll('.section-title, [data-editable]');

    Array.prototype.forEach.call(nodes, function (node) {
      if (!isVisible(node)) return;
      enterZone(node);

      if (node.classList.contains('section-title')) {
        flushEntry();
        flushSkills();
        flushContacts();
        currentItem = null;
        var heading = textOf(node);
        if (!heading) return;
        var runs = [];
        var before = pseudoRun(node, '::before');
        if (before) runs.push(before);
        runs.push(runFromStyle(heading, styleOf(node)));
        var after = pseudoRun(node, '::after');
        if (after) runs.push(after);
        var decoration = decorationOf(node, pageColor);
        out.push({
          style: 'Heading2',
          align: styleOf(node).align,
          bg: decoration.bg,
          borders: decoration.borders,
          keepNext: true,
          runs: runs
        });
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
        if (skill) {
          var skillStyle = styleOf(node);
          var run = runFromStyle(skill, skillStyle);
          // Chip fills are usually a translucent tint, so composite them over
          // the page rather than over white.
          var chip = effectiveBg(node, node.parentElement, false, pageColor);
          if (chip && !closeColor(chip, pageColor, 10)) run.bg = toHex(chip);
          skills.push({ run: run, align: skillStyle.align });
        }
        return;
      }

      // Entering a different repeatable item closes the previous entry.
      var item = node.closest('[data-editable-item]');
      if (item !== currentItem) {
        flushEntry();
        currentItem = item;
      }

      var text = textOf(node);
      var style = styleOf(node);

      if (key === 'name') {
        flushSkills(); flushContacts();
        if (text) push(node, { text: text, style: 'Title', spacingAfter: 20 });
        return;
      }

      if (key === 'title') {
        flushSkills(); flushContacts();
        if (text) push(node, { text: text, style: 'Subtitle', spacingAfter: 60 });
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
        contacts.push({ text: text, href: href, align: style.align });
        return;
      }

      if (key === 'summary' || key === 'language') {
        flushEntry();
        flushSkills();
        flushContacts();
        currentItem = null;
        if (text) push(node, { text: text });
        return;
      }

      if (key === 'quote-motto') {
        flushEntry();
        flushSkills();
        flushContacts();
        currentItem = null;
        if (text) push(node, { text: text, style: 'Quote' });
        return;
      }

      if (key === 'position' || key === 'degree') {
        flushSkills(); flushContacts();
        var positionEntry = ensureEntry();
        positionEntry[key] = text;
        positionEntry.positionStyle = style;
        positionEntry.align = style.align;
        return;
      }

      if (key === 'duration') {
        if (text) {
          var durationEntry = ensureEntry();
          durationEntry.duration = text;
          durationEntry.durationStyle = style;
        }
        return;
      }

      if (key === 'company' || key === 'school') {
        if (text) {
          var companyEntry = ensureEntry();
          companyEntry[key] = text;
          companyEntry.subtitleStyle = style;
        }
        return;
      }

      if (key === 'description' || key === 'deal-highlight') {
        var lines = linesOf(node);
        var target = ensureEntry();
        target.description = target.description.concat(lines);
        if (!target.descriptionStyle) target.descriptionStyle = style;
        return;
      }

      // Unknown field inside an item belongs to that item's description;
      // elsewhere keep the content rather than dropping it.
      if (currentItem) {
        if (text) ensureEntry().description.push(text);
      } else {
        flushSkills(); flushContacts();
        if (text) push(node, { text: text });
      }
    });

    flushAll();

    bands = bands.filter(function (item) {
      return item.cells.some(function (cell) { return cell.blocks.length; });
    });

    var columnWidths = columns ? columns.cells.map(function (cell) {
      return cell.getBoundingClientRect().width;
    }) : null;
    var totalPx = columnWidths ? columnWidths.reduce(function (sum, w) { return sum + w; }, 0) : 0;

    var model = {
      bands: bands,
      pageBg: pageBg,
      page: page,
      totalWidth: Math.max(1440, page.width - page.left - page.right),
      grid: null,
      table: false
    };

    if (columns && totalPx > 0) {
      model.grid = columnWidths.map(function (width) {
        return Math.max(360, Math.round(width / totalPx * model.totalWidth));
      });
      // Absorb rounding drift so the grid always adds up to the text width.
      var drift = model.totalWidth - model.grid.reduce(function (sum, w) { return sum + w; }, 0);
      model.grid[model.grid.length - 1] = Math.max(360, model.grid[model.grid.length - 1] + drift);
    }

    model.table = !!columns || pageBg !== 'FFFFFF' || page.left === 0;
    model.grid = model.grid || [model.totalWidth];
    return normalizeModel(model);
  }

  function defaultFilename() {
    var name = document.querySelector('[data-editable="name"]');
    var stem = (location.pathname.split('/').pop() || 'resume').replace(/\.html?$/i, '');
    var label = name ? textOf(name) : '';
    var base = label ? label + ' - ' + stem : stem;
    return base.replace(/[\\/:*?"<>|]+/g, '').trim() + '.docx';
  }

  function accentColor() {
    var rootStyle = window.getComputedStyle(document.documentElement);
    var raw = rootStyle.getPropertyValue('--accent') || rootStyle.getPropertyValue('--primary');
    return hexOf(raw) || '2F5496';
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
    var model = blocksFromDom();
    var hasContent = model.bands.some(function (band) {
      return band.cells.some(function (cell) { return cell.blocks.length; });
    });
    if (!hasContent) return null;
    var blob = buildBlob(model, { title: document.title, accent: accentColor() });
    var filename = defaultFilename();
    download(blob, filename);
    return { blob: blob, filename: filename, model: model, blocks: model.bands[0].cells[0].blocks };
  }

  window.ResumeDocx = {
    exportDocument: exportDocument,
    blocksFromDom: blocksFromDom,
    buildBlob: buildBlob,
    defaultFilename: defaultFilename
  };
})();
