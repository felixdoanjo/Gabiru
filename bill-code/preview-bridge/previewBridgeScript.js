(function () {
  if (window.__billPreviewBridge) return;
  window.__billPreviewBridge = true;

  var inspectMode = true;
  var commentMode = false;
  var selectedEl = null;
  var isDraggingEl = false;
  var dragEl = null;
  var startX = 0;
  var startY = 0;
  var initialLeft = 0;
  var initialTop = 0;
  var hasMoved = false;
  var originalPosition = '';

  function send(type, payload) {
    window.parent.postMessage(Object.assign({ source: 'bill-preview', type: type }, payload || {}), '*');
  }

  function getPath(element) {
    var parts = [];
    var cur = element;
    while (cur && cur.tagName !== 'BODY') {
      var part = cur.tagName.toLowerCase();
      if (cur.id) {
        part += '#' + cur.id;
        parts.unshift(part);
        break;
      }
      var cls = Array.from(cur.classList).filter(function (c) {
        return c !== '__bh' && c !== '__bs' && c !== '__bc';
      });
      if (cls.length) part += '.' + cls.join('.');
      parts.unshift(part);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  function getElementInfo(el) {
    var rect = el.getBoundingClientRect();
    var computed = window.getComputedStyle(el);
    var styles = {};
    ['color', 'background-color', 'background-image', 'font-size', 'font-weight', 'padding', 'margin', 'border-radius', 'opacity'].forEach(function (p) {
      styles[p] = computed.getPropertyValue(p);
    });
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      classes: Array.from(el.classList).filter(function (c) {
        return c !== '__bh' && c !== '__bs' && c !== '__bc';
      }),
      text: (el.innerText || '').slice(0, 200),
      styles: styles,
      path: getPath(el),
      rect: {
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        left: rect.left,
        top: rect.top,
        scrollX: document.documentElement.scrollLeft || 0,
        scrollY: document.documentElement.scrollTop || 0,
      },
    };
  }

  function makeTempId(el) {
    var id = 'temp-edit-' + Date.now() + '-' + Math.random().toString(36).substring(7);
    el.setAttribute('data-temp-id', id);
    return id;
  }

  function selectElement(el) {
    document.querySelectorAll('.__bs').forEach(function (e) {
      e.classList.remove('.__bs');
    });
    el.classList.add('.__bs');
    selectedEl = el;
    send('elementSelected', { data: getElementInfo(el) });
  }

  function applyPatch(patch) {
    send('patch', { patch: patch });
  }

  var styleEl = document.createElement('style');
  styleEl.textContent = '.__bh{outline:2px solid #7c5cfc!important;outline-offset:1px!important;cursor:crosshair!important}.__bs{outline:2px solid #ff6b6b!important;outline-offset:1px!important}.__bc{cursor:help!important}';
  (document.head || document.documentElement).appendChild(styleEl);

  function onOver(e) {
    if (!inspectMode && !commentMode) return;
    document.querySelectorAll('.__bh, .__bc').forEach(function (el) {
      el.classList.remove('__bh', '__bc');
      el.style.outline = '';
    });
    var t = e.target;
    if (t && t.tagName !== 'HTML' && t.tagName !== 'BODY') {
      if (commentMode) {
        t.classList.add('__bc');
        t.style.outline = '2px dashed #22c55e';
        t.style.outlineOffset = '1px';
      } else {
        t.classList.add('__bh');
      }
    }
  }

  function onMouseDown(e) {
    if (!inspectMode || commentMode) return;
    var t = e.target;
    if (!t || t.tagName === 'HTML') return;
    if (t.classList.contains('__comment_marker') || t.closest('.__comment_marker')) return;

    e.preventDefault();
    e.stopPropagation();
    selectElement(t);

    if (t.tagName === 'BODY') {
      isDraggingEl = false;
      dragEl = null;
    } else {
      isDraggingEl = true;
      dragEl = t;
    }
    startX = e.clientX;
    startY = e.clientY;
    hasMoved = false;
    originalPosition = t.style.position;

    var computed = window.getComputedStyle(t);
    var posType = computed.position;
    if (t.tagName !== 'BODY' && (!posType || posType === 'static')) {
      t.style.position = 'relative';
    }

    initialLeft = parseFloat(t.style.left) || 0;
    initialTop = parseFloat(t.style.top) || 0;
  }

  function onMouseMove(e) {
    if (!isDraggingEl || !dragEl) return;
    var deltaX = e.clientX - startX;
    var deltaY = e.clientY - startY;
    if (!hasMoved && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
      hasMoved = true;
    }
    if (hasMoved) {
      dragEl.style.left = (initialLeft + deltaX) + 'px';
      dragEl.style.top = (initialTop + deltaY) + 'px';
      send('elementResized', { data: getElementInfo(dragEl) });
    }
  }

  function onMouseUp() {
    if (!isDraggingEl || !dragEl) return;
    isDraggingEl = false;
    if (hasMoved) {
      var tempId = makeTempId(dragEl);
      applyPatch('__STYLE__' + JSON.stringify({ tempId: tempId, prop: 'position', value: dragEl.style.position, desc: 'position → ' + dragEl.style.position }));
      applyPatch('__STYLE__' + JSON.stringify({ tempId: tempId, prop: 'left', value: dragEl.style.left, desc: 'left → ' + dragEl.style.left }));
      applyPatch('__STYLE__' + JSON.stringify({ tempId: tempId, prop: 'top', value: dragEl.style.top, desc: 'top → ' + dragEl.style.top }));
    } else {
      dragEl.style.position = originalPosition;
    }
    dragEl = null;
  }

  function onClick(e) {
    if (!inspectMode && !commentMode) return;
    var t = e.target;
    if (t.classList && (t.classList.contains('__comment_marker') || t.closest('.__comment_marker'))) return;
    e.preventDefault();
    e.stopPropagation();

    if (commentMode && t && t.tagName !== 'HTML' && t.tagName !== 'BODY') {
      var rect = t.getBoundingClientRect();
      send('commentRequest', {
        path: getPath(t),
        pos: {
          x: rect.left + rect.width / 2 + (document.documentElement.scrollLeft || 0),
          y: rect.top + rect.height / 2 + (document.documentElement.scrollTop || 0),
          viewportX: rect.left + rect.width / 2,
          viewportY: rect.top + rect.height / 2,
        },
      });
    }
  }

  document.addEventListener('mouseover', onOver);
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('click', onClick, true);

  function renderCommentMarkers(comments) {
    document.querySelectorAll('.__comment_marker').forEach(function (el) {
      el.remove();
    });
    (comments || []).forEach(function (comment, idx) {
      var marker = document.createElement('div');
      marker.className = '__comment_marker';
      marker.textContent = String(idx + 1);
      marker.setAttribute('data-comment-id', comment.id);
      marker.style.cssText = 'position:absolute;left:' + comment.position.x + 'px;top:' + comment.position.y + 'px;transform:translate(-50%,-50%);width:28px;height:28px;background:#22c55e;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(34,197,94,0.4);border:2px solid #fff;z-index:9999;pointer-events:auto;';
      marker.addEventListener('click', function (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        send('commentMarkerClick', { id: comment.id });
      });
      document.body.appendChild(marker);
    });
    document.body.style.cursor = commentMode ? 'help' : '';
  }

  window.addEventListener('message', function (e) {
    var data = e.data;
    if (!data || data.source !== 'bill-host') return;

    if (data.type === 'init' || data.type === 'setModes') {
      inspectMode = !!data.inspectMode;
      commentMode = !!data.commentMode;
      if (data.comments) renderCommentMarkers(data.comments);
      return;
    }

    if (data.type === 'updateComments') {
      renderCommentMarkers(data.comments || []);
      return;
    }

    if (data.type === 'applyStyle' && selectedEl) {
      var valueStr = data.value;
      selectedEl.style.setProperty(data.prop, valueStr);
      var tempId = makeTempId(selectedEl);
      applyPatch('__STYLE__' + JSON.stringify({ tempId: tempId, prop: data.prop, value: valueStr, desc: data.desc || (data.prop + ' → ' + valueStr) }));
      send('elementSelected', { data: getElementInfo(selectedEl) });
      return;
    }

    if (data.type === 'applyText' && selectedEl) {
      selectedEl.innerText = data.text || '';
      var textTempId = makeTempId(selectedEl);
      applyPatch('__TEXT__' + JSON.stringify({ tempId: textTempId, text: data.text || '' }));
      send('elementSelected', { data: getElementInfo(selectedEl) });
      return;
    }

    if (data.type === 'applyImage' && selectedEl) {
      var src = data.src || '';
      if (selectedEl.tagName === 'IMG') {
        selectedEl.src = src;
      } else {
        selectedEl.style.backgroundImage = 'url(' + src + ')';
        selectedEl.style.backgroundSize = 'cover';
        selectedEl.style.backgroundPosition = 'center';
        if (selectedEl.offsetHeight < 30) selectedEl.style.minHeight = '150px';
      }
      if (src.indexOf('data:') === 0) {
        var info = getElementInfo(selectedEl);
        var idx = 0;
        var all = document.querySelectorAll(info.path);
        for (var i = 0; i < all.length; i++) {
          if (all[i] === selectedEl) { idx = i; break; }
        }
        applyPatch('__IMG__' + info.path + '__' + selectedEl.tagName + '__' + idx + '__' + src);
      } else if (data.name) {
        applyPatch(info.path + ': imagem → ' + data.name);
      }
      send('elementSelected', { data: getElementInfo(selectedEl) });
      return;
    }

    if (data.type === 'clearContent' && selectedEl) {
      if (selectedEl.innerText && selectedEl.innerText.trim()) selectedEl.innerText = '';
      if (selectedEl.style.backgroundImage) {
        selectedEl.style.backgroundImage = '';
        selectedEl.style.backgroundSize = '';
        selectedEl.style.backgroundPosition = '';
      }
      if (selectedEl.tagName === 'IMG') selectedEl.src = '';
      var clearInfo = getElementInfo(selectedEl);
      applyPatch('__CLEAR_BG__' + clearInfo.path + '__' + selectedEl.tagName);
      send('elementSelected', { data: clearInfo });
      return;
    }

    if (data.type === 'getHtml') {
      document.querySelectorAll('.__bh, .__bs, .__bc').forEach(function (el) {
        el.classList.remove('.__bh', '__bs', '__bc');
        el.style.outline = '';
      });
      document.querySelectorAll('[data-temp-id]').forEach(function (el) {
        el.removeAttribute('data-temp-id');
      });
      document.querySelectorAll('.__comment_marker').forEach(function (el) {
        el.remove();
      });
      var html = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
      send('htmlContent', { html: html, requestId: data.requestId });
      return;
    }

    if (data.type === 'deselect') {
      document.querySelectorAll('.__bs').forEach(function (el) {
        el.classList.remove('.__bs');
      });
      selectedEl = null;
    }
  });

  send('ready', {});
})();
