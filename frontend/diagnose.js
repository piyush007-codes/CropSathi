// diagnose.js - Field Diagnosis Page Logic
if (!localStorage.token) location.href = 'login.html';
lucide.createIcons();

var API = CropSathiPrefs.api;
var farms = [];
var selectedFile = null;

function init() {
  loadFarms().then(function () {
    checkAlerts();
    loadActiveCases();
    loadCaseHistory();
  });
}

function loadFarms() {
  return fetch(API + '/api/fields', {
    headers: { Authorization: 'Bearer ' + localStorage.token }
  }).then(function (r) { return r.json(); }).then(function (d) {
    if (d.success) {
      farms = d.data;
      var s = document.getElementById('uploadFarmSelect');
      farms.forEach(function (f) {
        var o = document.createElement('option');
        o.value = f._id;
        o.textContent = f.name + ' (' + f.cropType + ')';
        s.appendChild(o);
      });
    }
  }).catch(function (e) { console.error('loadFarms:', e); });
}

function checkAlerts() {
  fetch(API + '/api/dashboard/health', {
    headers: { Authorization: 'Bearer ' + localStorage.token }
  }).then(function (r) { return r.json(); }).then(function (d) {
    if (d.success) {
      var alerts = d.data.fields.filter(function (f) { return f.triggeredAlert; });
      if (alerts.length > 0) {
        document.getElementById('alertBanner').classList.remove('hidden');
        document.getElementById('alertText').textContent =
          alerts.length + ' field(s) elevated: ' +
          alerts.map(function (f) { return f.farmName; }).join(', ');
      }
    }
  }).catch(function () { });
}

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
      return ['confirmed', 'false_alarm', 'resolved'].indexOf(c.status) === -1;
    });
    el.innerHTML = active.length
      ? active.map(renderCaseCard).join('')
      : '<div class="text-center py-8 text-sm text-[#6f7a71]">No active cases</div>';
    lucide.createIcons();
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
      return ['confirmed', 'false_alarm', 'resolved'].indexOf(c.status) !== -1;
    });
    el.innerHTML = hist.length
      ? hist.map(renderCaseCard).join('')
      : '<div class="text-center py-8 text-sm text-[#6f7a71]">No case history yet</div>';
    lucide.createIcons();
  });
}

function renderCaseCard(c) {
  var statusColors = {
    awaiting_photo: 'bg-[#f0eded] text-[#6f7a71]',
    pending_server_confirmation: 'bg-[#e8efe5] text-[#006038]',
    confirmed: 'bg-[#933302]/10 text-[#933302]',
    false_alarm: 'bg-[#e8efe5] text-[#006038]',
    ambiguous_recapture_requested: 'bg-[#fae8d5] text-[#c05621]',
    escalated: 'bg-[#933302]/10 text-[#933302]',
    resolved: 'bg-[#e8efe5] text-[#006038]'
  };
  var statusLabels = {
    awaiting_photo: 'Awaiting Photo',
    pending_server_confirmation: 'Processing',
    confirmed: 'Confirmed',
    false_alarm: 'False Alarm',
    ambiguous_recapture_requested: 'Recapture Needed',
    escalated: 'Escalated',
    resolved: 'Resolved'
  };
  var cls = statusColors[c.status] || statusColors.awaiting_photo;
  var lbl = statusLabels[c.status] || c.status;
  var dis = (c.finalDiseaseCode || (c.serverResult && c.serverResult.diseaseCode) || '').replace(/_/g, ' ');
  var fm = farms.find(function (f) {
    return f._id === (typeof c.farmId === 'object' ? c.farmId._id : c.farmId);
  });
  return '<div class="bg-white border border-[#e4e2e1] rounded-xl p-4 tactile-card cursor-pointer hover:border-[#006038]/30 transition" onclick="openCaseDetail(\'' + c._id + '\')">' +
    '<div class="flex items-start justify-between">' +
    '<div class="flex items-center gap-3">' +
    '<div class="w-10 h-10 rounded-xl bg-[#f6f3f2] flex items-center justify-center"><i data-lucide="file-text" class="w-5 h-5 text-[#3f4941]"></i></div>' +
    '<div><h4 class="font-bold text-sm">' + (fm ? fm.name : 'Unknown') + '</h4>' +
    '<p class="text-xs text-[#3f4941]">' + (dis || c.triggeredBy.replace(/_/g, ' ')) + '</p></div>' +
    '</div><span class="text-[10px] font-bold ' + cls + ' px-2 py-0.5 rounded">' + lbl + '</span>' +
    '</div><div class="flex items-center gap-4 mt-3 text-xs text-[#6f7a71]"><span>' +
    new Date(c.createdAt).toLocaleDateString() + '</span>' +
    (c.confidence ? '<span>Confidence: ' + Math.round(c.confidence * 100) + '%</span>' : '') +
    (c.requiresExpertReview ? '<span class="text-[#933302] font-semibold">Expert Review</span>' : '') +
    '</div></div>';
}

function showUploadModal() {
  document.getElementById('uploadModal').classList.remove('hidden');
  document.getElementById('uploadStep1').classList.remove('hidden');
  document.getElementById('uploadStep2').classList.add('hidden');
  document.getElementById('uploadStep3').classList.add('hidden');
  selectedFile = null;
  document.getElementById('photoPreview').classList.add('hidden');
  document.getElementById('submitPhotoBtn').disabled = true;
  lucide.createIcons();
}

function closeUploadModal() {
  document.getElementById('uploadModal').classList.add('hidden');
}

document.getElementById('photoDropZone').addEventListener('click', function () {
  document.getElementById('photoInput').click();
});

document.getElementById('photoInput').addEventListener('change', function (e) {
  selectedFile = e.target.files[0];
  if (selectedFile) {
    var reader = new FileReader();
    reader.onload = function (ev) {
      document.getElementById('previewImg').src = ev.target.result;
      document.getElementById('photoPreview').classList.remove('hidden');
      document.getElementById('submitPhotoBtn').disabled = false;
    };
    reader.readAsDataURL(selectedFile);
  }
});

function submitPhoto() {
  var farmId = document.getElementById('uploadFarmSelect').value;
  if (!farmId || !selectedFile) return;
  document.getElementById('uploadStep1').classList.add('hidden');
  document.getElementById('uploadStep2').classList.remove('hidden');

  // Step 1: Create diagnosis case
  fetch(API + '/api/diagnosis/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.token },
    body: JSON.stringify({ farmId: farmId, triggeredBy: 'farmer_initiated' })
  }).then(function (r) { return r.json(); })
    .then(function (caseData) {
      if (!caseData.success) throw new Error(caseData.message);
      // Step 2: Upload photo to the case
      var fd = new FormData();
      fd.append('photo', selectedFile);
      return fetch(API + '/api/diagnosis/cases/' + caseData.data._id + '/photos', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + localStorage.token },
        body: fd
      }).then(function (r) { return r.json(); });
    })
    .then(function (photoData) {
      if (!photoData.success) throw new Error(photoData.message);
      var res = photoData.data.diagnosisCase;
      document.getElementById('uploadStep2').classList.add('hidden');
      document.getElementById('uploadStep3').classList.remove('hidden');

      if (res.status === 'confirmed') {
        document.getElementById('resultIcon').innerHTML = '<i data-lucide="check-circle" class="w-8 h-8 text-[#006038]"></i>';
        document.getElementById('resultIcon').className = 'w-16 h-16 rounded-full bg-[#e8efe5] flex items-center justify-center mx-auto mb-4';
        document.getElementById('resultTitle').textContent = 'Diagnosis Confirmed';
        document.getElementById('resultText').textContent =
          (res.finalDiseaseCode || '').replace(/_/g, ' ') + ' - ' +
          Math.round((res.confidence || 0) * 100) + '% confidence';
      } else if (res.status === 'false_alarm') {
        document.getElementById('resultIcon').innerHTML = '<i data-lucide="check-circle" class="w-8 h-8 text-[#006038]"></i>';
        document.getElementById('resultIcon').className = 'w-16 h-16 rounded-full bg-[#e8efe5] flex items-center justify-center mx-auto mb-4';
        document.getElementById('resultTitle').textContent = 'False Alarm';
        document.getElementById('resultText').textContent = 'No disease detected. The alert was a false positive.';
      } else if (res.status === 'ambiguous_recapture_requested') {
        document.getElementById('resultIcon').innerHTML = '<i data-lucide="help-circle" class="w-8 h-8 text-[#c05621]"></i>';
        document.getElementById('resultIcon').className = 'w-16 h-16 rounded-full bg-[#fae8d5] flex items-center justify-center mx-auto mb-4';
        document.getElementById('resultTitle').textContent = 'Needs Another Photo';
        document.getElementById('resultText').textContent = 'The image was ambiguous. Please try again with better lighting/focus.';
      } else {
        document.getElementById('resultIcon').innerHTML = '<i data-lucide="clock" class="w-8 h-8 text-[#6f7a71]"></i>';
        document.getElementById('resultIcon').className = 'w-16 h-16 rounded-full bg-[#f0eded] flex items-center justify-center mx-auto mb-4';
        document.getElementById('resultTitle').textContent = 'Processing';
        document.getElementById('resultText').textContent = 'Your submission is being reviewed.';
      }
      lucide.createIcons();
      // Refresh case lists
      loadActiveCases();
      loadCaseHistory();
    })
    .catch(function (err) {
      console.error('submitPhoto:', err);
      document.getElementById('uploadStep2').classList.add('hidden');
      document.getElementById('uploadStep1').classList.remove('hidden');
      alert('Error: ' + err.message);
    });
}

function openCaseDetail(caseId) {
  document.getElementById('caseDetailModal').classList.remove('hidden');
  document.getElementById('caseDetailContent').innerHTML = '<div class="text-center py-8 text-sm text-[#6f7a71]">Loading...</div>';
  lucide.createIcons();

  fetch(API + '/api/diagnosis/cases/' + caseId, {
    headers: { Authorization: 'Bearer ' + localStorage.token }
  }).then(function (r) { return r.json(); }).then(function (d) {
    if (!d.success) throw new Error(d.message);
    var c = d.data;
    var fm = farms.find(function (f) {
      return f._id === (typeof c.farmId === 'object' ? c.farmId._id : c.farmId);
    });
    var disease = (c.finalDiseaseCode || (c.serverResult && c.serverResult.diseaseCode) || 'N/A').replace(/_/g, ' ');
    var confidence = c.confidence ? Math.round(c.confidence * 100) + '%' : 'N/A';
    var severity = c.finalSeverity || (c.serverResult && c.serverResult.severity) || 'N/A';

    var photosHtml = '';
    if (c.photos && c.photos.length > 0) {
      photosHtml = '<div class="mt-4"><h4 class="font-bold text-sm mb-2">Photos</h4>' +
        c.photos.map(function (p) {
          return '<div class="bg-[#f6f3f2] rounded-xl p-3 mb-2 text-xs text-[#3f4941]">' +
            '<span>' + p.filename + '</span> <span class="text-[#6f7a71]">(' + new Date(p.uploadedAt).toLocaleDateString() + ')</span>' +
            (p.isRecapture ? ' <span class="text-[#c05621] font-bold">Recapture</span>' : '') +
            '</div>';
        }).join('') + '</div>';
    }

    var advisoryHtml = '';
    if (c.advisory) {
      var a = c.advisory;
      advisoryHtml = '<div class="mt-4 bg-[#f6f3f2] rounded-xl p-4">' +
        '<h4 class="font-bold text-sm mb-2">Advisory</h4>' +
        (a.summary ? '<p class="text-xs text-[#3f4941] mb-2">' + a.summary + '</p>' : '') +
        (a.cultural ? '<div class="mb-2"><span class="text-[10px] font-bold text-[#006038] bg-[#e8efe5] px-2 py-0.5 rounded">Cultural</span><p class="text-xs text-[#3f4941] mt-1">' + a.cultural + '</p></div>' : '') +
        (a.biological ? '<div class="mb-2"><span class="text-[10px] font-bold text-[#006038] bg-[#e8efe5] px-2 py-0.5 rounded">Biological</span><p class="text-xs text-[#3f4941] mt-1">' + a.biological + '</p></div>' : '') +
        (a.chemical ? '<div class="mb-2"><span class="text-[10px] font-bold text-[#933302] bg-[#933302]/10 px-2 py-0.5 rounded">Chemical</span><p class="text-xs text-[#3f4941] mt-1">' + a.chemical + '</p></div>' : '') +
        '</div>';
    }

    var recaptureBtn = c.status === 'ambiguous_recapture_requested'
      ? '<button onclick="requestRecapture(\'' + c._id + '\')" class="mt-4 w-full px-4 py-2.5 bg-[#c05621] text-white font-semibold rounded-full hover:bg-[#a04a1c] transition">Request Recapture</button>'
      : '';

    document.getElementById('caseDetailContent').innerHTML =
      '<div class="space-y-3">' +
      '<div class="flex items-center justify-between"><span class="text-xs text-[#6f7a71]">Field</span><span class="text-sm font-bold">' + (fm ? fm.name : 'Unknown') + '</span></div>' +
      '<div class="flex items-center justify-between"><span class="text-xs text-[#6f7a71]">Triggered By</span><span class="text-sm font-medium">' + c.triggeredBy.replace(/_/g, ' ') + '</span></div>' +
      '<div class="flex items-center justify-between"><span class="text-xs text-[#6f7a71]">Status</span><span class="text-sm font-medium">' + c.status.replace(/_/g, ' ') + '</span></div>' +
      '<div class="flex items-center justify-between"><span class="text-xs text-[#6f7a71]">Disease</span><span class="text-sm font-bold">' + disease + '</span></div>' +
      '<div class="flex items-center justify-between"><span class="text-xs text-[#6f7a71]">Confidence</span><span class="text-sm font-medium">' + confidence + '</span></div>' +
      '<div class="flex items-center justify-between"><span class="text-xs text-[#6f7a71]">Severity</span><span class="text-sm font-medium">' + severity + '</span></div>' +
      '<div class="flex items-center justify-between"><span class="text-xs text-[#6f7a71]">Date</span><span class="text-sm">' + new Date(c.createdAt).toLocaleDateString() + '</span></div>' +
      (c.requiresExpertReview ? '<div class="bg-[#933302]/10 rounded-xl p-3 text-xs text-[#933302] font-semibold">Requires Expert Review</div>' : '') +
      photosHtml + advisoryHtml + recaptureBtn +
      '</div>';
    lucide.createIcons();
  }).catch(function (err) {
    document.getElementById('caseDetailContent').innerHTML =
      '<div class="text-center py-8 text-sm text-[#ba1a1a]">Error loading case: ' + err.message + '</div>';
  });
}

function closeCaseDetail() {
  document.getElementById('caseDetailModal').classList.add('hidden');
}

function requestRecapture(caseId) {
  fetch(API + '/api/diagnosis/cases/' + caseId + '/recapture', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + localStorage.token }
  }).then(function (r) { return r.json(); }).then(function (d) {
    if (d.success) {
      closeCaseDetail();
      loadActiveCases();
      loadCaseHistory();
    } else {
      alert(d.message);
    }
  }).catch(function (err) {
    alert('Error: ' + err.message);
  });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
