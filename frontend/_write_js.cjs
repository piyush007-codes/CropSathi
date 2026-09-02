const fs = require('fs');
const js = `// diagnose.js - AI-Powered Diagnosis Page
if (!localStorage.token) location.href = 'login.html';
lucide.createIcons();

var API = CropSathiPrefs.api;
var farms = [];
var uploadedFiles = [];
var uploadedPreviews = [];
var pendingDeleteId = null;
var alertFarmId = null;
var pollTimer = null;

function init() {
  loadFarms().then(function () {
    checkAlerts();
    loadActiveCases();
    loadCaseHistory();
  });
}

// ─── Farm Loading ───
function loadFarms() {
  return fetch(API + '/api/fields', {
    headers: { Authorization: 'Bearer ' + localStorage.token }
  }).then(function (r) { return r.json(); }).then(function (d) {
    if (d.success) {
      farms = d.data;
      var s = document.getElementById('uploadFarmSelect');
      // Keep first option
      s.innerHTML = '<option value="">Select a field...</option>';
      farms.forEach(function (f) {
        var o = document.createElement('option');
        o.value = f._id;
        o.textContent = f.name + ' (' + f.cropType + ')';
        s.appendChild(o);
      });
    }
  }).catch(function (e) { console.error('loadFarms:', e); });
}

// ─── Alert Detection ───
function checkAlerts() {
  fetch(API + '/api/dashboard/health', {
    headers: { Authorization: 'Bearer ' + localStorage.token }
  }).then(function (r) { return r.json(); }).then(function (d) {
    if (d.success) {
      var alerts = d.data.fields.filter(function (f) { return f.triggeredAlert; });
      if (alerts.length > 0) {
        document.getElementById('alertBanner').classList.remove('hidden');
        alertFarmId = alerts[0].farmId;
        document.getElementById('alertText').textContent =
          alerts.length + ' field(s) elevated: ' +
          alerts.map(function (f) { return f.farmName; }).join(', ');
      }
    }
  }).catch(function () { });
}

// ─── Case Loading ───
function loadActiveCases() {
  var el = document.getElementById('activeCases');
  var promises = farms.map(function (f) {
    return fetch(API + '/api/diagnosis/farms/' + f._id + '/cases', {
      headers: { Authorization: 'Bearer ' + localStorage.token }
    }).then(function (r) { return r.json(); })
      .then(function (d) { return d.success ? d.data : []; })
      .catch(function () { return []; });
  });
  Promise.all(promises).then(function (results) {
    var all = [].concat.apply([], results);
    var active = all.filter(function (c) {
      return c.status === 'awaiting_photo' || c.status === 'diagnosing' || c.status === 'retry_failed';
    });
    el.innerHTML = active.length
      ? active.map(renderCaseCard).join('')
      : '<div class="text-center py-8 text-sm text-[#6f7a71]">No active cases</div>';
    lucide.createIcons();
    // Start polling if any cases are diagnosing
    startPollingIfNeeded(active);
  });
}

function loadCaseHistory() {
  var el = document.getElementById('caseHistory');
  var promises = farms.map(function (f) {
    return fetch(API + '/api/diagnosis/farms/' + f._id + '/cases?limit=10', {
      headers: { Authorization: 'Bearer ' + localStorage.token }
    }).then(function (r) { return r.json(); })
      .then(function (d) { return d.success ? d.data : []; })
      .catch(function () { return []; });
  });
  Promise.all(promises).then(function (results) {
    var all = [].concat.apply([], results);
    var hist = all.filter(function (c) {
      return c.status === 'report_ready';
    });
    el.innerHTML = hist.length
      ? hist.map(renderCaseCard).join('')
      : '<div class="text-center py-8 text-sm text-[#6f7a71]">No case history yet</div>';
    lucide.createIcons();
  });
}

// ─── Polling ───
function startPollingIfNeeded(activeCases) {
  var hasDiagnosing = activeCases.some(function (c) { return c.status === 'diagnosing'; });
  if (hasDiagnosing && !pollTimer) {
    pollTimer = setInterval(function () {
      loadActiveCases();
      loadCaseHistory();
    }, 3000);
  } else if (!hasDiagnosing && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// ─── Case Card Rendering ───
function renderCaseCard(c) {
  var fm = farms.find(function (f) {
    return f._id === (typeof c.farmId === 'object' ? c.farmId._id : c.farmId);
  });
  var farmName = fm ? fm.name : 'Unknown';
  var disease = (c.finalDiseaseCode || '').replace(/_/g, ' ');
  var statusBadge = getStatusBadge(c);
  var bottomInfo = getBottomInfo(c);

  return '<div class="bg-white border border-[#e4e2e1] rounded-xl p-4 tactile-card relative group">' +
    '<div class="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">' +
    '<button onclick="event.stopPropagation(); showDeleteModal(\'' + c._id + '\')" class="w-7 h-7 rounded-full bg-[#f0eded] flex items-center justify-center hover:bg-[#ba1a1a]/10 transition" title="Delete">' +
    '<i data-lucide="trash-2" class="w-3.5 h-3.5 text-[#ba1a1a]"></i></button></div>' +
    '<div class="cursor-pointer" onclick="openCaseDetail(\'' + c._id + '\')">' +
    '<div class="flex items-start gap-3">' +
    '<div class="w-10 h-10 rounded-xl bg-[#f6f3f2] flex items-center justify-center flex-shrink-0">' +
    getStatusIcon(c) + '</div>' +
    '<div class="flex-1 min-w-0">' +
    '<div class="flex items-center gap-2"><h4 class="font-bold text-sm truncate">' + farmName + '</h4>' + statusBadge + '</div>' +
    '<p class="text-xs text-[#3f4941] mt-0.5">' + (disease || c.triggeredBy.replace(/_/g, ' ')) + '</p>' +
    '</div></div>' +
    '<div class="flex items-center gap-4 mt-3 text-xs text-[#6f7a71]">' + bottomInfo + '</div>' +
    '</div></div>';
}

function getStatusBadge(c) {
  if (c.status === 'diagnosing') return '<span class="text-[10px] font-bold bg-[#e8efe5] text-[#006038] px-2 py-0.5 rounded animate-pulse">Diagnosing...</span>';
  if (c.status === 'retry_failed') return '<span class="text-[10px] font-bold bg-[#ba1a1a]/10 text-[#ba1a1a] px-2 py-0.5 rounded">Retry</span>';
  if (c.status === 'report_ready') {
    if (c.outcome === 'confirmed') return '<span class="text-[10px] font-bold bg-[#933302]/10 text-[#933302] px-2 py-0.5 rounded">Report Ready</span>';
    if (c.outcome === 'false_alarm') return '<span class="text-[10px] font-bold bg-[#e8efe5] text-[#006038] px-2 py-0.5 rounded">Healthy</span>';
    if (c.outcome === 'expert_review') return '<span class="text-[10px] font-bold bg-[#fae8d5] text-[#c05621] px-2 py-0.5 rounded">Expert Review</span>';
    return '<span class="text-[10px] font-bold bg-[#e8efe5] text-[#006038] px-2 py-0.5 rounded">Report Ready</span>';
  }
  if (c.status === 'awaiting_photo') return '<span class="text-[10px] font-bold bg-[#f0eded] text-[#6f7a71] px-2 py-0.5 rounded">Awaiting</span>';
  return '';
}

function getStatusIcon(c) {
  if (c.status === 'diagnosing') return '<i data-lucide="loader-2" class="w-5 h-5 text-[#006038] animate-spin"></i>';
  if (c.status === 'retry_failed') return '<i data-lucide="refresh-cw" class="w-5 h-5 text-[#ba1a1a]"></i>';
  if (c.outcome === 'confirmed') return '<i data-lucide="alert-triangle" class="w-5 h-5 text-[#933302]"></i>';
  if (c.outcome === 'false_alarm') return '<i data-lucide="check-circle" class="w-5 h-5 text-[#006038]"></i>';
  if (c.outcome === 'expert_review') return '<i data-lucide="help-circle" class="w-5 h-5 text-[#c05621]"></i>';
  return '<i data-lucide="camera" class="w-5 h-5 text-[#6f7a71]"></i>';
}

function getBottomInfo(c) {
  var parts = ['<span>' + new Date(c.createdAt).toLocaleDateString() + '</span>'];
  if (c.confidence) parts.push('<span>Confidence: ' + Math.round(c.confidence * 100) + '%</span>');
  if (c.requiresExpertReview) parts.push('<span class="text-[#933302] font-semibold">Expert Review</span>');
  if (c.status === 'retry_failed') parts.push('<button onclick="event.stopPropagation(); retryCase(\'' + c._id + '\')" class="text-[#ba1a1a] font-semibold hover:underline">Tap to retry</button>');
  return parts.join('');
}

// ─── Delete Flow ───
function showDeleteModal(caseId) {
  pendingDeleteId = caseId;
  document.getElementById('deleteModal').classList.remove('hidden');
  lucide.createIcons();
}

function closeDeleteModal() {
  pendingDeleteId = null;
  document.getElement
