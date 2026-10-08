(function () {
  'use strict';

  var STORAGE_PREFIX = 'resume_ai_';
  var DEBOUNCE_MS = 600;
  var IMAGE_MAX_WIDTH = 200;
  var IMAGE_MAX_HEIGHT = 200;

  // Contact fields that can be shown or hidden from the toolbar.
  var CONTACT_KEYS = ['email', 'phone', 'location', 'website'];
  var CONTACT_LABELS = {
    email: { en: 'Email', zh: '邮箱' },
    phone: { en: 'Phone', zh: '电话' },
    location: { en: 'Location', zh: '地区' },
    website: { en: 'Website', zh: '网站' }
  };

  var isEditMode = false;
  var isAvatarVisible = true;
  var templateId = '';
  var saveTimer = null;

  // ==================== DOM 工具 ====================

  function $(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }

  function $$(sel, ctx) {
    return Array.from((ctx || document).querySelectorAll(sel));
  }

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'className') e.className = attrs[k];
        else if (k === 'innerHTML') e.innerHTML = attrs[k];
        else if (k === 'textContent') e.textContent = attrs[k];
        else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') {
          e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else e.setAttribute(k, attrs[k]);
      });
    }
    if (children) {
      children.forEach(function (c) {
        if (typeof c === 'string') e.appendChild(document.createTextNode(c));
        else if (c) e.appendChild(c);
      });
    }
    return e;
  }

  // ==================== 工具栏 ====================

  function createToolbar() {
    templateId = computeTemplateId();

    var bar = el('div', { className: 're-toolbar' });

    var statusDot = el('span', { className: 're-status-dot', id: 're-status' });

    var btnEdit = el('button', {
      className: 're-fab re-fab-edit',
      'data-label-en': 'Edit',
      'data-label-zh': '编辑',
      'data-tip-en': 'Ctrl+E toggle edit/preview',
      'data-tip-zh': 'Ctrl+E 切换编辑/预览',
      textContent: '✏️',
      onclick: toggleEditMode
    });

    var btnPrint = el('button', {
      className: 're-fab re-fab-print',
      'data-label-en': 'Print',
      'data-label-zh': '打印',
      'data-tip-en': 'Ctrl+P print resume',
      'data-tip-zh': 'Ctrl+P 打印简历',
      textContent: '🖨️',
      onclick: function () {
        toast(t('Opening print dialog…', '正在打开打印对话框…'), t('Good luck in your interview! 🍀', '祝你面试顺利！🍀'));
        window.print();
      }
    });

    var btnReset = el('button', {
      className: 're-fab re-fab-reset',
      'data-label-en': 'Reset',
      'data-label-zh': '重置',
      'data-tip-en': 'Reset to template defaults',
      'data-tip-zh': '恢复模板默认值',
      textContent: '↩️',
      onclick: resetData
    });

    var btnLang = el('button', {
      className: 're-fab re-fab-lang',
      'data-label-en': 'EN / 中文',
      'data-label-zh': '中文 / EN',
      'data-tip-en': 'Switch to Chinese',
      'data-tip-zh': 'Switch to English',
      textContent: '🌐',
      onclick: switchLanguage
    });

    var btnContacts = el('button', {
      className: 're-fab re-fab-contacts',
      'data-label-en': 'Contact fields',
      'data-label-zh': '联系信息',
      'data-tip-en': 'Show or hide contact fields',
      'data-tip-zh': '显示 / 隐藏联系信息',
      textContent: '📇',
      onclick: openContactPanel
    });

    bar.appendChild(statusDot);
    bar.appendChild(btnEdit);
    bar.appendChild(btnPrint);
    bar.appendChild(btnReset);
    bar.appendChild(btnLang);
    bar.appendChild(btnContacts);

    var avatarEl = $('[data-editable="avatar"][data-editable-type="image"]');
    if (avatarEl) {
      var avatarKey = storageKey() + '_avatar_hidden';
      if (localStorage.getItem(avatarKey) === '1') {
        isAvatarVisible = false;
        var avatarWrapper = avatarEl.closest('.header-avatar');
        if (avatarWrapper) avatarWrapper.style.display = 'none';
      }
      var btnAvatar = el('button', {
        className: 're-fab re-fab-avatar' + (isAvatarVisible ? '' : ' re-fab-avatar-hidden'),
        'data-label-en': 'Avatar',
        'data-label-zh': '头像',
        'data-tip-en': isAvatarVisible ? 'Hide avatar' : 'Show avatar',
        'data-tip-zh': isAvatarVisible ? '隐藏头像' : '显示头像',
        textContent: '🖼️',
        onclick: function () {
          isAvatarVisible = !isAvatarVisible;
          var el = document.querySelector('[data-editable="avatar"][data-editable-type="image"]');
          var wrapper = el ? el.closest('.header-avatar') : null;
          if (!wrapper) return;
          if (isAvatarVisible) {
            wrapper.style.display = '';
            this.classList.remove('re-fab-avatar-hidden');
            this.setAttribute('data-tip-en', 'Hide avatar');
            this.setAttribute('data-tip-zh', '隐藏头像');
            localStorage.setItem(avatarKey, '0');
            toast(t('Avatar shown', '头像已显示'), t('You look sharp in this photo 📸', '这张照片很有精神 📸'));
          } else {
            wrapper.style.display = 'none';
            this.classList.add('re-fab-avatar-hidden');
            this.setAttribute('data-tip-en', 'Show avatar');
            this.setAttribute('data-tip-zh', '显示头像');
            localStorage.setItem(avatarKey, '1');
            toast(t('Avatar hidden · click again to restore', '头像已隐藏 · 再次点击恢复'), t('A low profile works too 😎', '低调也是一种自信 😎'));
          }
          updateToolbarLanguage();
        }
      });
      bar.appendChild(btnAvatar);
    }

    document.body.appendChild(bar);
    updateToolbarLanguage();
  }

  // ==================== 语言切换 ====================

  function t(en, zh) {
    return getTemplateLanguage() === 'zh' ? zh : en;
  }

  function getTemplateLanguage() {
    var stored = localStorage.getItem('resume_ai_lang');
    if (stored === 'zh') return 'zh';
    if (!stored) localStorage.setItem('resume_ai_lang', 'en');
    return 'en';
  }

  function updateToolbarLanguage() {
    var zh = getTemplateLanguage() === 'zh';
    $$('[data-label-en]').forEach(function (btn) {
      var label = zh ? btn.getAttribute('data-label-zh') : btn.getAttribute('data-label-en');
      var tip = zh ? btn.getAttribute('data-tip-zh') : btn.getAttribute('data-tip-en');
      if (label) btn.setAttribute('data-label', label);
      if (tip) btn.title = tip;
    });
  }

  function applyTemplateLanguage(lang) {
    var active = lang || getTemplateLanguage();
    var root = document.documentElement;

    document.documentElement.lang = active === 'zh' ? 'zh-CN' : 'en';

    var titleEn = root.getAttribute('data-title-en');
    var titleZh = root.getAttribute('data-title-zh');
    var titleTag = document.querySelector('title');
    if (titleTag && (titleEn || titleZh)) {
      titleTag.textContent = active === 'zh' ? (titleZh || titleEn) : (titleEn || titleZh);
    }

    // Every localizable node carries its own data-en / data-zh pair, so the
    // switch never has to guess what the original text was.
    $$('[data-en][data-zh]').forEach(function (node) {
      if (node.closest('.re-toolbar') || node.closest('.re-toast')) return;
      var value = active === 'zh' ? node.getAttribute('data-zh') : node.getAttribute('data-en');
      if (typeof value !== 'string') return;

      if (node.tagName === 'IMG') {
        node.setAttribute('alt', value);
      } else if (node.textContent !== value) {
        node.textContent = value;
      }
    });

    $$('[data-href-en][data-href-zh]').forEach(function (node) {
      var href = active === 'zh' ? node.getAttribute('data-href-zh') : node.getAttribute('data-href-en');
      if (href) node.setAttribute('href', href);
    });

    updateToolbarLanguage();
  }

  // ==================== 联系信息显示 / 隐藏 ====================

  function computeTemplateId() {
    var title = $('title');
    return title ? title.textContent.replace(/\s*[-–—|]\s*/g, '_').replace(/\s+/g, '_') : 'resume';
  }

  function contactSelector() {
    return CONTACT_KEYS.map(function (key) {
      return '[data-editable="' + key + '"]';
    }).join(',');
  }

  // Each template wraps a contact item differently (bare span, span + emoji,
  // div.kv, ...). Walk up from the editable node to the outermost element that
  // still holds only that single contact field - that element is the item.
  function setupContactEntries() {
    CONTACT_KEYS.forEach(function (key) {
      if (document.querySelector('[data-contact="' + key + '"]')) return;

      var field = document.querySelector('[data-editable="' + key + '"]');
      if (!field) return;

      var node = field;
      while (node.parentElement &&
             node.parentElement.tagName !== 'BODY' &&
             node.parentElement.querySelectorAll(contactSelector()).length === 1) {
        node = node.parentElement;
      }
      node.setAttribute('data-contact', key);
    });
  }

  function contactStoreKey() {
    return STORAGE_PREFIX + templateId + '_contacts_hidden';
  }

  function getHiddenContacts() {
    try {
      var raw = localStorage.getItem(contactStoreKey());
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function setContactVisible(key, visible) {
    var node = document.querySelector('[data-contact="' + key + '"]');
    if (node) node.style.display = visible ? '' : 'none';

    var hidden = getHiddenContacts().filter(function (item) { return item !== key; });
    if (!visible) hidden.push(key);

    try {
      localStorage.setItem(contactStoreKey(), JSON.stringify(hidden));
    } catch (e) {
      console.warn('localStorage write failed:', e);
    }
  }

  function applyContactVisibility() {
    var hidden = getHiddenContacts();
    CONTACT_KEYS.forEach(function (key) {
      var node = document.querySelector('[data-contact="' + key + '"]');
      if (node) node.style.display = hidden.indexOf(key) === -1 ? '' : 'none';
    });
  }

  function closeContactPanel() {
    var panel = document.querySelector('.re-contact-popup');
    if (panel) panel.remove();
    document.removeEventListener('click', onContactPanelOutsideClick, true);
    document.removeEventListener('keydown', onContactPanelKeydown);
  }

  function onContactPanelOutsideClick(e) {
    var panel = document.querySelector('.re-contact-popup');
    if (!panel) return;
    if (panel.contains(e.target) || e.target.closest('.re-fab-contacts')) return;
    closeContactPanel();
  }

  function onContactPanelKeydown(e) {
    if (e.key === 'Escape') closeContactPanel();
  }

  function openContactPanel() {
    if (document.querySelector('.re-contact-popup')) {
      closeContactPanel();
      return;
    }

    var hidden = getHiddenContacts();
    var lang = getTemplateLanguage();
    var panel = el('div', { className: 're-contact-popup' });

    panel.appendChild(el('div', {
      className: 're-contact-title',
      textContent: t('Contact fields', '联系信息')
    }));

    var available = CONTACT_KEYS.filter(function (key) {
      return !!document.querySelector('[data-editable="' + key + '"]');
    });

    if (!available.length) {
      panel.appendChild(el('div', { className: 're-contact-empty', textContent: t('No contact fields in this template', '该模板没有可用的联系信息') }));
    }

    available.forEach(function (key) {
      var row = el('label', { className: 're-contact-row' });
      var box = el('input', {
        type: 'checkbox',
        className: 're-contact-check',
        onchange: function () { setContactVisible(key, this.checked); }
      });
      box.checked = hidden.indexOf(key) === -1;

      row.appendChild(box);
      row.appendChild(el('span', {
        className: 're-contact-label',
        textContent: CONTACT_LABELS[key][lang === 'zh' ? 'zh' : 'en']
      }));
      panel.appendChild(row);
    });

    document.body.appendChild(panel);

    var btn = $('.re-fab-contacts');
    if (btn) {
      var rect = btn.getBoundingClientRect();
      panel.style.right = Math.max(12, window.innerWidth - rect.right) + 'px';
      panel.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
    }

    setTimeout(function () {
      document.addEventListener('click', onContactPanelOutsideClick, true);
      document.addEventListener('keydown', onContactPanelKeydown);
    }, 0);
  }

  function switchLanguage() {
    var next = getTemplateLanguage() === 'en' ? 'zh' : 'en';

    // Keep whatever the user has already typed under the current language.
    var current = getAllFieldData();
    if (Object.keys(current).length > 1) saveData(current);

    localStorage.setItem('resume_ai_lang', next);
    applyTemplateLanguage(next);

    var saved = loadData();
    if (saved.name || saved.__groups) {
      applyFieldData(saved);
      setStatus('loaded');
    }
  }

  function storageKey() {
    var lang = getTemplateLanguage();
    return STORAGE_PREFIX + templateId + (lang === 'zh' ? '_zh' : '');
  }

  function legacyStorageKey() {
    var zhTitle = document.documentElement.getAttribute('data-title-zh');
    if (!zhTitle) return '';
    return STORAGE_PREFIX + zhTitle.replace(/\s*[-–—|]\s*/g, '_').replace(/\s+/g, '_');
  }

  // The storage key is derived from <title>, which changed when the templates
  // were translated. Adopt data saved under the old Chinese title once.
  function migrateLegacyData() {
    var legacy = legacyStorageKey();
    if (getTemplateLanguage() === 'zh' || !legacy || legacy === storageKey()) return;
    try {
      var old = localStorage.getItem(legacy);
      if (!old || localStorage.getItem(storageKey())) return;

      localStorage.setItem(storageKey(), old);
      var oldAvatar = localStorage.getItem(legacy + '_avatar_hidden');
      if (oldAvatar) localStorage.setItem(storageKey() + '_avatar_hidden', oldAvatar);

      localStorage.removeItem(legacy);
      localStorage.removeItem(legacy + '_avatar_hidden');
    } catch (e) {
      console.warn('localStorage migration failed:', e);
    }
  }

  function loadData() {
    try {
      var raw = localStorage.getItem(storageKey());
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveData(data) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(data));
      setStatus('saved');
    } catch (e) {
      setStatus('error');
      console.warn('localStorage write failed:', e);
    }
  }

  function debouncedSave(data) {
    setStatus('saving');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveData(data);
    }, DEBOUNCE_MS);
  }

  function getAllFieldData() {
    var data = { __groups: {} };

    $$('[data-editable]').forEach(function (field) {
      if (field.closest('[data-removing]')) return;

      var name = field.getAttribute('data-editable');
      var type = field.getAttribute('data-editable-type') || 'text';
      var group = field.closest('[data-editable-group]');

      if (group) {
        var groupName = group.getAttribute('data-editable-group');
        if (!data.__groups[groupName]) {
          data.__groups[groupName] = [];
        }
        var item = field.closest('[data-editable-item]');
        var itemIndex = item ? Array.from(group.querySelectorAll('[data-editable-item]')).indexOf(item) : 0;

        while (data.__groups[groupName].length <= itemIndex) {
          data.__groups[groupName].push({});
        }

        if (type === 'image') {
          data.__groups[groupName][itemIndex][name] = field.src;
        } else if (type === 'link') {
          data.__groups[groupName][itemIndex][name] = { href: field.href || '', text: field.textContent || '' };
        } else {
          data.__groups[groupName][itemIndex][name] = field.textContent || '';
        }
      } else {
        if (type === 'image') {
          data[name] = field.src;
        } else if (type === 'link') {
          data[name] = { href: field.href || '', text: field.textContent || '' };
        } else {
          data[name] = field.textContent || '';
        }
      }
    });

    return data;
  }

  function applyFieldData(data) {
    $$('[data-editable]').forEach(function (field) {
      var name = field.getAttribute('data-editable');
      var type = field.getAttribute('data-editable-type') || 'text';
      var group = field.closest('[data-editable-group]');
      var value;

      if (group) {
        var groupName = group.getAttribute('data-editable-group');
        var item = field.closest('[data-editable-item]');
        var itemIndex = item ? Array.from(group.querySelectorAll('[data-editable-item]')).indexOf(item) : 0;
        if (data.__groups && data.__groups[groupName] && data.__groups[groupName][itemIndex]) {
          value = data.__groups[groupName][itemIndex][name];
        }
      } else {
        value = data[name];
      }

      if (value === undefined || value === null) return;

      if (type === 'image' && typeof value === 'string') {
        field.src = value;
      } else if (type === 'link' && typeof value === 'object') {
        if (value.href) field.href = value.href;
        if (value.text) field.textContent = value.text;
      } else if (typeof value === 'string') {
        field.textContent = value;
      }
    });

    rebindGroupItems();
  }

  function resetData() {
    if (!confirm(t('Reset all content? This clears your edits and restores the template defaults.',
                    '确定要重置所有内容吗？这将清空你编辑的所有数据，恢复为模板默认值。'))) return;
    var base = STORAGE_PREFIX + templateId;
    try {
      [base, base + '_zh', base + '_avatar_hidden', base + '_zh_avatar_hidden',
       base + '_contacts_hidden'].forEach(function (key) {
        localStorage.removeItem(key);
      });
      location.reload();
    } catch (e) {
      location.reload();
    }
  }

  // ==================== 状态指示器 ====================

  function setStatus(state) {
    var dot = $('#re-status');
    if (!dot) return;
    dot.className = 're-status-dot re-status-' + state;
  }

  var toastTimer = null;

  function toast(msg, enc) {
    var existing = document.querySelector('.re-toast');
    if (existing) existing.remove();
    if (toastTimer) clearTimeout(toastTimer);

    var t = el('div', { className: 're-toast' });

    var lineMain = el('div', { className: 're-toast-main', textContent: msg });
    t.appendChild(lineMain);

    if (enc) {
      var lineEnc = el('div', { className: 're-toast-enc', textContent: enc });
      t.appendChild(lineEnc);
    }

    document.body.appendChild(t);

    requestAnimationFrame(function () {
      t.classList.add('re-toast-show');
    });

    toastTimer = setTimeout(function () {
      t.classList.remove('re-toast-show');
      setTimeout(function () { t.remove(); }, 300);
    }, 2500);
  }

  // ==================== 编辑模式切换 ====================

  function toggleEditMode() {
    isEditMode = !isEditMode;
    var btn = $('.re-fab-edit');
    var bar = $('.re-toolbar');
    var resume = $('.resume');

    if (isEditMode) {
      if (btn) btn.textContent = '👁️';
      if (bar) bar.classList.add('re-edit-active');
      if (resume) resume.classList.add('re-edit-mode');
      enableAllEditable();
      toast(t('Edit mode enabled · click the dashed boxes to edit', '已进入编辑模式 · 点击虚线框修改内容'),
            t('A good start is half the battle ✨', '好的开始是成功的一半 ✨'));
    } else {
      if (btn) btn.textContent = '✏️';
      if (bar) bar.classList.remove('re-edit-active');
      if (resume) resume.classList.remove('re-edit-mode');
      disableAllEditable();
      toast(t('Edit mode disabled · preview is ready to print', '已退出编辑模式 · 预览可打印效果'),
            t('Every step counts 💪', '每一步努力都算数 💪'));
    }
  }

  // ==================== 文本字段 ====================

  function enableTextEditable(field) {
    field.contentEditable = 'true';
    field.classList.add('re-editable');
    field.setAttribute('tabindex', '0');

    field.addEventListener('input', onFieldChange);
    field.addEventListener('blur', onFieldChange);
  }

  function disableTextEditable(field) {
    field.contentEditable = 'false';
    field.classList.remove('re-editable');
    field.removeEventListener('input', onFieldChange);
    field.removeEventListener('blur', onFieldChange);
  }

  // ==================== 图片字段 ====================

  function createImageOverlay(imgField) {
    if (imgField.parentElement.querySelector('.re-img-overlay')) return;

    var overlay = el('div', { className: 're-img-overlay' });
    var label = el('span', { className: 're-img-label', textContent: t('📷 Click to change photo', '📷 点击换头像') });
    overlay.appendChild(label);

    var wrapper = imgField.parentElement;
    if (getComputedStyle(wrapper).position === 'static') {
      wrapper.style.position = 'relative';
    }
    wrapper.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      triggerImageUpload(imgField);
    });

    imgField._overlay = overlay;
  }

  function removeImageOverlay(imgField) {
    if (imgField._overlay && imgField._overlay.parentElement) {
      imgField._overlay.parentElement.removeChild(imgField._overlay);
      imgField._overlay = null;
    }
  }

  function triggerImageUpload(imgField) {
    var input = el('input', { type: 'file', accept: 'image/*' });
    input.addEventListener('change', function () {
      if (!input.files || !input.files[0]) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        openCropModal(imgField, e.target.result);
      };
      reader.readAsDataURL(input.files[0]);
    });
    input.click();
  }

  var CROP_SIZE = 300;
  var cropField = null;
  var cropImg = null;
  var cropScale = 1;
  var cropOffsetX = 0;
  var cropOffsetY = 0;
  var cropBaseScale = 1;
  var cropDragStart = null;

  function openCropModal(imgField, dataUrl) {
    cropField = imgField;
    cropScale = 1;
    cropOffsetX = 0;
    cropOffsetY = 0;
    cropDragStart = null;

    var existing = document.querySelector('.re-crop-overlay');
    if (existing) existing.remove();

    var overlay = el('div', { className: 're-crop-overlay' });

    var card = el('div', { className: 're-crop-card' });

    var title = el('div', { className: 're-crop-title', textContent: t('Crop Photo', '裁切头像') });

    var viewport = el('div', { className: 're-crop-viewport' });
    var viewInner = el('div', { className: 're-crop-inner' });

    cropImg = new Image();
    cropImg.style.display = 'block';
    cropImg.style.transformOrigin = '0 0';
    cropImg.onload = function () {
      cropBaseScale = Math.max(CROP_SIZE / cropImg.naturalWidth, CROP_SIZE / cropImg.naturalHeight);
      cropScale = cropBaseScale;
      updateCropPreview();
    };
    cropImg.src = dataUrl;
    viewInner.appendChild(cropImg);
    viewport.appendChild(viewInner);

    viewport.addEventListener('mousedown', onCropMouseDown);
    viewport.addEventListener('mousemove', onCropMouseMove);
    viewport.addEventListener('mouseup', onCropMouseUp);
    viewport.addEventListener('mouseleave', onCropMouseUp);
    viewport.addEventListener('touchstart', onCropTouchStart, { passive: false });
    viewport.addEventListener('touchmove', onCropTouchMove, { passive: false });
    viewport.addEventListener('touchend', onCropMouseUp);

    var controls = el('div', { className: 're-crop-controls' });
    var zoomLabel = el('span', { className: 're-crop-zoom-label', textContent: t('Zoom', '缩放') });
    var zoomSlider = el('input', {
      type: 'range',
      className: 're-crop-zoom',
      min: '50',
      max: '300',
      value: '100',
      oninput: function () {
        cropScale = cropBaseScale * (parseInt(this.value) / 100);
        updateCropPreview();
      }
    });
    controls.appendChild(zoomLabel);
    controls.appendChild(zoomSlider);

    var btnRow = el('div', { className: 're-crop-btns' });
    var btnCancel = el('button', {
      className: 're-popup-btn re-popup-btn-cancel',
      textContent: t('Cancel', '取消'),
      onclick: closeCropModal
    });
    var btnConfirm = el('button', {
      className: 're-popup-btn re-popup-btn-primary',
      textContent: t('Confirm', '确定'),
      onclick: confirmCrop
    });
    btnRow.appendChild(btnCancel);
    btnRow.appendChild(btnConfirm);

    card.appendChild(title);
    card.appendChild(viewport);
    card.appendChild(controls);
    card.appendChild(btnRow);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeCropModal();
    });
  }

  function closeCropModal() {
    var overlay = document.querySelector('.re-crop-overlay');
    if (overlay) overlay.remove();
    cropField = null;
    cropImg = null;
  }

  function updateCropPreview() {
    if (!cropImg) return;
    cropImg.style.transform = 'translate(' + cropOffsetX + 'px, ' + cropOffsetY + 'px) scale(' + cropScale + ')';
  }

  function clampCropOffset() {
    if (!cropImg) return;
    var s = cropScale;
    var w = cropImg.naturalWidth * s;
    var h = cropImg.naturalHeight * s;
    var minX = CROP_SIZE - w;
    var minY = CROP_SIZE - h;
    if (w <= CROP_SIZE) {
      cropOffsetX = (CROP_SIZE - w) / 2;
    } else {
      cropOffsetX = Math.max(minX, Math.min(0, cropOffsetX));
    }
    if (h <= CROP_SIZE) {
      cropOffsetY = (CROP_SIZE - h) / 2;
    } else {
      cropOffsetY = Math.max(minY, Math.min(0, cropOffsetY));
    }
  }

  function onCropMouseDown(e) {
    e.preventDefault();
    cropDragStart = { x: e.clientX - cropOffsetX, y: e.clientY - cropOffsetY };
  }

  function onCropMouseMove(e) {
    if (!cropDragStart) return;
    e.preventDefault();
    cropOffsetX = e.clientX - cropDragStart.x;
    cropOffsetY = e.clientY - cropDragStart.y;
    clampCropOffset();
    updateCropPreview();
  }

  function onCropMouseUp() {
    cropDragStart = null;
  }

  function onCropTouchStart(e) {
    if (e.touches.length === 1) {
      e.preventDefault();
      cropDragStart = { x: e.touches[0].clientX - cropOffsetX, y: e.touches[0].clientY - cropOffsetY };
    }
  }

  function onCropTouchMove(e) {
    if (!cropDragStart || e.touches.length !== 1) return;
    e.preventDefault();
    cropOffsetX = e.touches[0].clientX - cropDragStart.x;
    cropOffsetY = e.touches[0].clientY - cropDragStart.y;
    clampCropOffset();
    updateCropPreview();
  }

  function confirmCrop() {
    if (!cropImg || !cropField) return;

    var canvas = document.createElement('canvas');
    canvas.width = CROP_SIZE;
    canvas.height = CROP_SIZE;
    var ctx = canvas.getContext('2d');

    ctx.drawImage(
      cropImg,
      -cropOffsetX / cropScale,
      -cropOffsetY / cropScale,
      CROP_SIZE / cropScale,
      CROP_SIZE / cropScale,
      0, 0,
      CROP_SIZE, CROP_SIZE
    );

    var outputCanvas = document.createElement('canvas');
    outputCanvas.width = IMAGE_MAX_WIDTH;
    outputCanvas.height = IMAGE_MAX_HEIGHT;
    var outCtx = outputCanvas.getContext('2d');
    outCtx.drawImage(canvas, 0, 0, IMAGE_MAX_WIDTH, IMAGE_MAX_HEIGHT);

    cropField.src = outputCanvas.toDataURL('image/jpeg', 0.9);
    closeCropModal();
    onFieldChange();
  }

  // ==================== 链接字段 ====================

  function enableLinkEditable(field) {
    field.contentEditable = 'true';
    field.classList.add('re-editable');
    field.classList.add('re-editable-link');
    field.setAttribute('tabindex', '0');
    var oldHref = field.getAttribute('href');
    if (oldHref) {
      field.setAttribute('data-re-href', oldHref);
      field.removeAttribute('href');
    }
    field.addEventListener('input', onFieldChange);
    field.addEventListener('blur', onFieldChange);
    field.addEventListener('dblclick', onLinkDblClick);
  }

  function disableLinkEditable(field) {
    field.contentEditable = 'false';
    field.classList.remove('re-editable');
    field.classList.remove('re-editable-link');
    var savedHref = field.getAttribute('data-re-href');
    if (savedHref) {
      field.setAttribute('href', savedHref);
    }
    field.removeEventListener('input', onFieldChange);
    field.removeEventListener('blur', onFieldChange);
    field.removeEventListener('dblclick', onLinkDblClick);
  }

  function onLinkDblClick(e) {
    e.preventDefault();
    e.stopPropagation();
    showLinkEditor(this);
  }

  function showLinkEditor(linkField) {
    var existing = $('.re-link-popup');
    if (existing) existing.remove();

    var rect = linkField.getBoundingClientRect();

    var popup = el('div', { className: 're-link-popup' });

    var urlLabel = el('label', { textContent: t('Link URL', '链接地址') });
    var urlInput = el('input', {
      type: 'url',
      className: 're-link-input',
      value: linkField.getAttribute('data-re-href') || linkField.getAttribute('href') || ''
    });

    var textLabel = el('label', { textContent: t('Display text', '显示文字') });
    var textInput = el('input', {
      type: 'text',
      className: 're-link-input',
      value: linkField.textContent || ''
    });

    var btnRow = el('div', { className: 're-link-btns' });

    var btnSave = el('button', {
      className: 're-popup-btn re-popup-btn-primary',
      textContent: t('Confirm', '确定'),
      onclick: function () {
        var href = urlInput.value.trim();
        var text = textInput.value.trim() || href;
        if (href) {
          linkField.setAttribute('data-re-href', href);
          if (isEditMode) {
            linkField.removeAttribute('href');
          } else {
            linkField.setAttribute('href', href);
            if (linkField.tagName === 'A') linkField.href = href;
          }
        } else {
          linkField.removeAttribute('data-re-href');
        }
        if (text) linkField.textContent = text;
        popup.remove();
        onFieldChange();
      }
    });

    var btnCancel = el('button', {
      className: 're-popup-btn re-popup-btn-cancel',
      textContent: t('Cancel', '取消'),
      onclick: function () { popup.remove(); }
    });

    btnRow.appendChild(btnSave);
    btnRow.appendChild(btnCancel);

    popup.appendChild(urlLabel);
    popup.appendChild(urlInput);
    popup.appendChild(textLabel);
    popup.appendChild(textInput);
    popup.appendChild(btnRow);

    popup.style.top = (rect.bottom + window.scrollY + 6) + 'px';
    popup.style.left = (rect.left + window.scrollX) + 'px';

    document.body.appendChild(popup);
    urlInput.focus();

    setTimeout(function () {
      var closeHandler = function (ev) {
        if (!popup.contains(ev.target) && ev.target !== linkField) {
          popup.remove();
          document.removeEventListener('click', closeHandler);
        }
      };
      document.addEventListener('click', closeHandler);
    }, 10);
  }

  // ==================== 可编辑组 ====================

  function setupGroups() {
    $$('[data-editable-group]').forEach(function (group) {
      group.classList.add('re-group');

      var items = group.querySelectorAll('[data-editable-item]');
      items.forEach(function (item, index) {
        setupGroupItem(group, item, index);
      });
    });
  }

  function setupGroupItem(group, item, index) {
    if (item.querySelector('.re-group-actions')) return;

    var actions = el('div', { className: 're-group-actions' });

    var btnAdd = el('button', {
      className: 're-btn re-btn-add re-btn-sm',
      textContent: '+',
      'data-label-en': 'Add item',
      'data-label-zh': '添加一项',
      'data-tip-en': 'Add item',
      'data-tip-zh': '添加一项',
      onclick: function () { addGroupItem(group, item); }
    });

    var btnDel = el('button', {
      className: 're-btn re-btn-del re-btn-sm',
      textContent: '×',
      'data-label-en': 'Delete item',
      'data-label-zh': '删除此项',
      'data-tip-en': 'Delete this item',
      'data-tip-zh': '删除此项',
      onclick: function () { removeGroupItem(group, item); }
    });

    actions.appendChild(btnAdd);
    actions.appendChild(btnDel);
    item.appendChild(actions);

    updateToolbarLanguage();
  }

  function addGroupItem(group, afterItem) {
    var items = group.querySelectorAll('[data-editable-item]');
    if (items.length >= 10) {
      alert(t('Up to 10 items allowed', '最多支持 10 项'));
      return;
    }

    var newItem = afterItem.cloneNode(true);

    $$('[data-editable]', newItem).forEach(function (field) {
      var type = field.getAttribute('data-editable-type') || 'text';
      if (type === 'image') {
        field.src = field.src || '';
      } else {
        field.textContent = '…';
      }
    });

    var oldActions = newItem.querySelector('.re-group-actions');
    if (oldActions) oldActions.remove();

    afterItem.parentNode.insertBefore(newItem, afterItem.nextSibling);

    if (isEditMode) {
      $$('[data-editable]', newItem).forEach(function (field) {
        var type = field.getAttribute('data-editable-type') || 'text';
        if (type === 'image') {
          createImageOverlay(field);
        } else if (type === 'link') {
          enableLinkEditable(field);
        } else {
          enableTextEditable(field);
        }
      });
    }

    rebindGroupItems();
    onFieldChange();
  }

  function removeGroupItem(group, item) {
    var items = group.querySelectorAll('[data-editable-item]');
    if (items.length <= 1) {
      alert(t('At least one item is required', '至少保留一项'));
      return;
    }

    item.style.opacity = '0';
    item.style.transform = 'translateX(20px)';
    item.style.transition = 'all 0.2s ease';
    item.setAttribute('data-removing', 'true');

    setTimeout(function () {
      if (item.parentElement) {
        item.parentElement.removeChild(item);
      }
      rebindGroupItems();
      onFieldChange();
    }, 200);
  }

  function rebindGroupItems() {
    $$('.re-group-actions').forEach(function (el) { el.remove(); });

    $$('[data-editable-group]').forEach(function (group) {
      var items = group.querySelectorAll('[data-editable-item]');
      items.forEach(function (item, index) {
        setupGroupItem(group, item, index);
      });
    });
  }

  // ==================== 变更处理 ====================

  function onFieldChange() {
    var data = getAllFieldData();
    debouncedSave(data);
  }

  // ==================== 全部启用/禁用 ====================

  function enableAllEditable() {
    $$('[data-editable]').forEach(function (field) {
      var type = field.getAttribute('data-editable-type') || 'text';
      if (type === 'image') {
        createImageOverlay(field);
      } else if (type === 'link') {
        enableLinkEditable(field);
      } else {
        enableTextEditable(field);
      }
    });
    rebindGroupItems();
  }

  function disableAllEditable() {
    $$('[data-editable]').forEach(function (field) {
      var type = field.getAttribute('data-editable-type') || 'text';
      if (type === 'image') {
        removeImageOverlay(field);
      } else if (type === 'link') {
        disableLinkEditable(field);
      } else {
        disableTextEditable(field);
      }
    });
    $$('.re-group-actions').forEach(function (el) { el.remove(); });
    $$('.re-link-popup').forEach(function (el) { el.remove(); });
  }

  // ==================== 键盘快捷键 ====================

  function setupKeyboard() {
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        toggleEditMode();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        window.print();
      }
    });
  }

  // ==================== 初始化 ====================

  function injectStyles() {
    var css = '\
.re-toolbar{position:fixed;bottom:28px;right:28px;z-index:1000;display:flex;align-items:center;gap:2px;padding:6px;background:rgba(30,30,40,0.88);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-radius:28px;box-shadow:0 2px 20px rgba(0,0,0,0.18),0 0 0 1px rgba(255,255,255,0.08);transition:box-shadow .25s,transform .25s;}\
.re-toolbar:hover{box-shadow:0 4px 28px rgba(0,0,0,0.25),0 0 0 1px rgba(255,255,255,0.12);transform:translateY(-2px);}\
.re-edit-active{box-shadow:0 2px 20px rgba(52,152,219,0.3),0 0 0 2px rgba(52,152,219,0.4)!important;}\
\
.re-status-dot{width:6px;height:6px;border-radius:50%;margin:0 6px;flex-shrink:0;transition:background .3s;}\
.re-status-loaded{background:rgba(255,255,255,0.25);}\
.re-status-saved{background:#27ae60;box-shadow:0 0 6px rgba(39,174,96,0.5);}\
.re-status-saving{background:#f39c12;animation:pulse 0.6s infinite;}\
.re-status-error{background:#e74c3c;}\
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}\
\
.re-fab{width:38px;height:38px;border:none;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:all .2s;position:relative;flex-shrink:0;line-height:1;}\
.re-fab-edit{background:rgba(255,255,255,0.1);color:#fff;}\
.re-fab-edit:hover{background:#3498db;transform:scale(1.1);}\
.re-fab-print{background:rgba(255,255,255,0.1);color:#fff;}\
.re-fab-print:hover{background:#27ae60;transform:scale(1.1);}\
.re-fab-reset{background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.55);}\
.re-fab-reset:hover{background:rgba(231,76,60,0.7);color:#fff;transform:scale(1.1);}\
.re-fab-avatar{background:rgba(255,255,255,0.1);color:#fff;}\
.re-fab-avatar:hover{background:rgba(155,89,182,0.7);color:#fff;transform:scale(1.1);}\
.re-fab-avatar-hidden{background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.3);}\
.re-fab-avatar-hidden:hover{background:rgba(255,255,255,0.12);color:#fff;}\
.re-avatar-group{display:flex;align-items:center;}\
\
.re-fab::after{content:attr(data-label);position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%) translateY(4px);white-space:nowrap;font-size:11px;font-weight:600;padding:4px 10px;border-radius:6px;background:rgba(0,0,0,0.78);color:#fff;pointer-events:none;opacity:0;transition:opacity .18s,transform .18s;}\
.re-fab:hover::after{opacity:1;transform:translateX(-50%) translateY(0);}\
\
.re-btn-add{background:#27ae60;color:#fff;min-width:28px;padding:4px 8px;font-size:16px;line-height:1;border:none;border-radius:4px;cursor:pointer;}\
.re-btn-del{background:#e74c3c;color:#fff;min-width:28px;padding:4px 8px;font-size:16px;line-height:1;border:none;border-radius:4px;cursor:pointer;}\
.re-btn-sm{padding:4px 12px;font-size:12px;}\
\
.re-popup-btn{padding:6px 14px;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:500;}\
.re-popup-btn-primary{background:#3498db;color:#fff;}\
.re-popup-btn-primary:hover{background:#2980b9;}\
.re-popup-btn-cancel{background:transparent;color:#999;border:1px solid #ddd;}\
.re-popup-btn-cancel:hover{color:#333;border-color:#999;}\
\
.re-edit-mode .re-editable{cursor:text;outline:2px dashed rgba(52,152,219,0.3);outline-offset:2px;border-radius:2px;transition:outline .15s;min-width:4ch;min-height:1em;display:inline-block;}\
.re-edit-mode .re-editable:focus{outline:2px solid #3498db;background:rgba(52,152,219,0.05);}\
.re-edit-mode .re-editable-link{cursor:text;outline:2px dashed rgba(52,152,219,0.3);outline-offset:2px;border-radius:2px;}\
.re-edit-mode .re-editable-link:hover{outline:2px solid #3498db;}\
\
.re-img-overlay{position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;border-radius:inherit;cursor:pointer;opacity:0;transition:opacity .2s;}\
.re-edit-mode .header-avatar:hover .re-img-overlay,\
.re-edit-mode [style*="position: relative"]:hover .re-img-overlay{opacity:1;}\
.re-img-label{color:#fff;font-size:12px;text-align:center;pointer-events:none;}\
\
.re-group{position:relative;}\
.re-group-actions{position:absolute;top:-8px;right:-8px;display:flex;gap:4px;opacity:0;transition:opacity .2s;z-index:10;}\
.re-edit-mode [data-editable-item]{position:relative;}\
.re-edit-mode [data-editable-item]:hover > .re-group-actions{opacity:1;}\
\
.re-link-popup{position:absolute;z-index:2000;background:#fff;border:1px solid #ddd;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,0.15);padding:16px;min-width:280px;}\
.re-link-popup label{display:block;font-size:12px;color:#666;margin-bottom:4px;margin-top:8px;}\
.re-link-popup label:first-child{margin-top:0;}\
.re-link-input{width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;box-sizing:border-box;}\
.re-link-input:focus{outline:none;border-color:#3498db;}\
.re-link-btns{display:flex;gap:8px;margin-top:12px;justify-content:flex-end;}\
\
.re-contact-popup{position:fixed;z-index:2000;background:#fff;border:1px solid #ddd;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,0.18);padding:14px 16px;min-width:190px;}\
.re-contact-title{font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;}\
.re-contact-row{display:flex;align-items:center;gap:9px;padding:6px 4px;font-size:13px;color:#333;cursor:pointer;border-radius:5px;transition:background .15s;}\
.re-contact-row:hover{background:#f4f6fb;}\
.re-contact-check{width:15px;height:15px;accent-color:#3498db;cursor:pointer;margin:0;flex-shrink:0;}\
.re-contact-label{user-select:none;}\
.re-contact-empty{font-size:12px;color:#999;max-width:200px;line-height:1.5;}\
\
.re-fab-contacts{background:rgba(255,255,255,0.1);color:#fff;}\
.re-fab-contacts:hover{background:#16a085;transform:scale(1.1);}\
\
@media print{\
  .re-toolbar{display:none!important}\
  .re-toast{display:none!important}\
  .re-editable{outline:none!important}\
  .re-editable-link{outline:none!important}\
  .re-group-actions{display:none!important}\
  .re-link-popup{display:none!important}\
  .re-contact-popup{display:none!important}\
  .re-crop-overlay{display:none!important}\
}\
\
.re-crop-overlay{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;animation:re-fadeIn .2s;}\
.re-crop-card{background:#fff;border-radius:12px;padding:24px;width:380px;box-shadow:0 8px 40px rgba(0,0,0,0.25);}\
.re-crop-title{font-size:16px;font-weight:700;color:#333;margin-bottom:16px;text-align:center;}\
.re-crop-viewport{width:300px;height:300px;margin:0 auto;overflow:hidden;border:2px dashed #ccc;border-radius:4px;cursor:grab;position:relative;}\
.re-crop-viewport:active{cursor:grabbing;}\
.re-crop-inner{width:300px;height:300px;overflow:hidden;}\
.re-crop-controls{display:flex;align-items:center;gap:10px;margin:14px 0;padding:0 20px;}\
.re-crop-zoom-label{font-size:12px;color:#888;flex-shrink:0;}\
.re-crop-zoom{flex:1;height:4px;-webkit-appearance:none;appearance:none;background:#ddd;border-radius:2px;outline:none;}\
.re-crop-zoom::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;background:#3498db;border-radius:50%;cursor:pointer;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.2);}\
.re-crop-btns{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;}\
@keyframes re-fadeIn{from{opacity:0}to{opacity:1}}\
\
.re-toast{position:fixed;bottom:100px;right:28px;z-index:10000;background:rgba(0,0,0,0.82);color:#fff;font-size:13px;padding:12px 22px;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,0.2);pointer-events:none;opacity:0;transform:translateY(12px);transition:opacity .25s,transform .25s;max-width:340px;text-align:center;line-height:1.5;}\
.re-toast-main{font-weight:600;}\
.re-toast-enc{font-size:12px;color:rgba(255,255,255,0.65);margin-top:3px;font-weight:400;}\
.re-toast-show{opacity:1;transform:translateY(0);}\
\
';
    var style = el('style', { id: 're-styles', textContent: css });
    document.head.appendChild(style);
  }

  function init() {
    injectStyles();
    createToolbar();
    setupGroups();
    setupKeyboard();

    migrateLegacyData();

    var lang = getTemplateLanguage();
    applyTemplateLanguage(lang);

    setupContactEntries();
    applyContactVisibility();

    var savedData = loadData();
    if (Object.keys(savedData).length > 0 && (savedData.name || savedData.__groups)) {
      applyFieldData(savedData);
      setStatus('loaded');
    } else {
      setStatus('loaded');
    }

    console.log(
      '%c📄 Resume Editor ready %c| %cClick Edit to begin, %cCtrl+E %cto toggle edit mode, %cCtrl+P %cto print',
      'font-weight:bold', '', '', 'color:#3498db', '', 'color:#27ae60', ''
    );
  }

  // Templates are also embedded as gallery previews. Inside an iframe we skip
  // the editor chrome but still mirror the language and contact visibility
  // chosen on the gallery page.
  if (window.self !== window.top) {
    var applyPreviewState = function () {
      templateId = computeTemplateId();
      applyTemplateLanguage(getTemplateLanguage());
      setupContactEntries();
      applyContactVisibility();
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyPreviewState);
    } else {
      applyPreviewState();
    }
    return;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
