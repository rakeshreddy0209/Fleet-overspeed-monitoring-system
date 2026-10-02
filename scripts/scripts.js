/**
 * CAUTIO GEOSPATIAL RADAR & FLEET TELEMETRY PLATFORM
 * High-Performance Liquid Glass Map Engine (Vite ESM)
 * Leaflet.js + PapaParse + Esri World Navigation & OSM Basemaps
 */

// Application Reactive State
const state = {
  statutoryThreshold: 90,
  cleansedRecords: [],
  selectedOrg: 'ALL',
  map: null,
  markerCluster: null,
  markers: [],
  logoOverlay: null,
  fastestRecord: null
};

// Interactive Helper: Focus Marker and Open Alert Details Popup
function focusAndOpenMarker(item) {
  if (!item || !state.map) return;
  const target = (state.markers || []).find(m => {
    return m._record && m._record.vehicle === item.vehicle && Math.abs(m._record.lat - item.lat) < 0.0001;
  }) || (state.markers || []).find(m => m._record && m._record.vehicle === item.vehicle);

  if (target) {
    if (state.markerCluster && typeof state.markerCluster.zoomToShowLayer === 'function') {
      state.markerCluster.zoomToShowLayer(target, () => {
        target.openPopup();
      });
    } else {
      state.map.flyTo([item.lat, item.lon], 14, { animate: true, duration: 0.8 });
      setTimeout(() => target.openPopup(), 850);
    }
  } else {
    state.map.flyTo([item.lat, item.lon], 14, { animate: true, duration: 0.8 });
  }
}

// DOM References - Top Executive Insights Island
const activeFleetCountEl = document.getElementById('activeFleetCount');
const complianceRateDisplayEl = document.getElementById('complianceRateDisplay');
const infractionsCountEl = document.getElementById('infractionsCount');
const meanSpeedDisplayEl = document.getElementById('meanSpeedDisplay');
const peakSpeedDisplayEl = document.getElementById('peakSpeedDisplay');
const topOffenderDisplayEl = document.getElementById('topOffenderDisplay');
const topRiskOrgDisplayEl = document.getElementById('topRiskOrgDisplay');
const btnToggleTopInsights = document.getElementById('btnToggleTopInsights');
const btnCloseTopInsights = document.getElementById('btnCloseTopInsights');
const topInsightsDrawer = document.getElementById('topInsightsDrawer');
const chipTopOffender = document.getElementById('chipTopOffender');

// Drawer Elements
const drawerTotalUnits = document.getElementById('drawerTotalUnits');
const drawerCompliantUnits = document.getElementById('drawerCompliantUnits');
const drawerCompliancePct = document.getElementById('drawerCompliancePct');
const drawerInfractionsUnits = document.getElementById('drawerInfractionsUnits');
const drawerInfractionThreshold = document.getElementById('drawerInfractionThreshold');
const drawerMeanSpeed = document.getElementById('drawerMeanSpeed');
const drawerPeakSpeed = document.getElementById('drawerPeakSpeed');
const drawerFastestVehicle = document.getElementById('drawerFastestVehicle');
const specCompliantSeg = document.getElementById('specCompliantSeg');
const specWarningSeg = document.getElementById('specWarningSeg');
const specCriticalSeg = document.getElementById('specCriticalSeg');
const spectrumStatsText = document.getElementById('spectrumStatsText');
const topSpeedersList = document.getElementById('topSpeedersList');
const operatorRiskList = document.getElementById('operatorRiskList');

// Controls & Modal References
const speedThresholdSlider = document.getElementById('speedThresholdSlider');
const threshDisplay = document.getElementById('threshDisplay');
const orgFilterSelect = document.getElementById('orgFilterSelect');
const uploadCsvBtn = document.getElementById('uploadCsvBtn');
const csvFileInput = document.getElementById('csvFileInput');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportCsvBottomBtn = document.getElementById('exportCsvBottomBtn');
const reloadZingbusBtn = document.getElementById('reloadZingbusBtn');

const cardTotalUnits = document.getElementById('cardTotalUnits');
const cardViolatingUnits = document.getElementById('cardViolatingUnits');
const cardMeanSpeed = document.getElementById('cardMeanSpeed');
const cardPeakSpeed = document.getElementById('cardPeakSpeed');
const speedSvgRing = document.getElementById('speedSvgRing');
const gaugeSpeedNum = document.getElementById('gaugeSpeedNum');
const fastestUnitLabel = document.getElementById('fastestUnitLabel');
const violationsBadge = document.getElementById('violationsBadge');
const violationsList = document.getElementById('violationsList');

/* ==========================================================================
   LEAFLET MAP INITIALIZATION (MAP2 CELL 6 SPECIFICATION)
   ========================================================================== */
function initLeafletMap() {
  if (state.map) {
    state.map.invalidateSize();
    return;
  }

  if (typeof L === 'undefined') {
    setTimeout(initLeafletMap, 50);
    return;
  }

  const mapEl = document.getElementById('cautioMap');
  if (!mapEl) return;

  try {
    state.map = L.map('cautioMap', {
      center: [21.7679, 78.8718],
      zoom: 5,
      zoomControl: true,
      preferCanvas: true
    });

    const esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19
    }).addTo(state.map);

    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    });

    L.control.layers({
      'Esri World Navigation': esri,
      'OpenStreetMap (OSM)': osm
    }, null, { position: 'topright' }).addTo(state.map);

    // Watermark Overlay
    const INLAND_CENTRAL_INDIA_BOUNDS = [[20.2, 73.2], [23.7, 84.1]];
    try {
      state.logoOverlay = L.imageOverlay('/cautio-logo.svg', INLAND_CENTRAL_INDIA_BOUNDS, {
        opacity: 0.22,
        interactive: false,
        zIndex: 1
      }).addTo(state.map);
    } catch (e) {}

    // Marker Cluster Group
    state.markerCluster = typeof L.markerClusterGroup === 'function'
      ? L.markerClusterGroup({ maxClusterRadius: 35, spiderfyOnMaxZoom: true, showCoverageOnHover: false })
      : L.layerGroup();
    state.map.addLayer(state.markerCluster);

    [50, 150, 300, 600].forEach(d => setTimeout(() => state.map?.invalidateSize(), d));
  } catch (err) {
    console.error("Leaflet init error:", err);
  }
}

/* ==========================================================================
   DATA INGESTION & WKT POINT COORDINATE EXTRACTION
   ========================================================================== */
function processTelemetryData(records) {
  if (!records || records.length === 0) return;

  state.cleansedRecords = [];
  const pointRegex = /POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i;

  const sample = records[0];
  const keys = Object.keys(sample).map(k => k.trim());
  const speedKey = keys.find(k => k.toLowerCase().includes('speed')) || 'Vehicle Speed (km/h)';
  const vehKey = keys.find(k => k.toLowerCase().includes('vehicle')) || 'Vehicle Number';
  const orgKey = keys.find(k => k.toLowerCase().includes('org')) || 'L1-Org';
  const locKey = keys.find(k => k.toLowerCase().includes('location')) || 'Alert location';
  const dateKey = keys.find(k => k.toLowerCase().includes('date')) || 'Date';
  const timeKey = keys.find(k => k.toLowerCase().includes('time')) || 'Alert time';
  const typeKey = keys.find(k => k.toLowerCase().includes('type')) || 'Alert type';

  records.forEach(row => {
    const rawLoc = row[locKey] || '';
    const match = rawLoc.match(pointRegex);
    let lon = null, lat = null;

    if (match) {
      lon = parseFloat(match[1]);
      lat = parseFloat(match[2]);
    } else if (row.Latitude && row.Longitude) {
      lat = parseFloat(row.Latitude);
      lon = parseFloat(row.Longitude);
    } else if (row.lat && row.lon) {
      lat = parseFloat(row.lat);
      lon = parseFloat(row.lon);
    }

    const rawSpeed = parseFloat(row[speedKey]);
    // STRICT REQUIREMENT: Only vehicles with speeds HIGHER than 90 km/h (> 90).
    // Discard any record with speed <= 90 completely, treating it as if it's not even there!
    if (isNaN(rawSpeed) || rawSpeed <= 90.0) return;

    if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
      state.cleansedRecords.push({
        vehicle: String(row[vehKey] || 'UNKNOWN').trim(),
        org: String(row[orgKey] || 'General Fleet').trim(),
        date: String(row[dateKey] || '2026-09-02').trim(),
        time: String(row[timeKey] || '00:00:00').trim(),
        alert: String(row[typeKey] || 'Overspeeding').trim(),
        speed: rawSpeed,
        lat: lat,
        lon: lon
      });
    }
  });

  // Populate L1-Org Dropdown
  const orgs = Array.from(new Set(state.cleansedRecords.map(r => r.org))).sort();
  if (orgFilterSelect) {
    orgFilterSelect.innerHTML = '<option value="ALL">All Fleets</option>' +
      orgs.map(o => `<option value="${o}">${o}</option>`).join('');
    orgFilterSelect.value = state.selectedOrg;
  }

  renderRadarMap();
}

/* ==========================================================================
   RADAR MAP & EXECUTIVE INSIGHTS RENDERING ENGINE
   ========================================================================== */
function renderRadarMap() {
  if (!state.map || !state.markerCluster) return;

  state.markerCluster.clearLayers();

  // Enforce threshold is strictly >= 90.0 km/h
  const threshold = Math.max(90.0, state.statutoryThreshold || 90.0);

  let filtered = state.cleansedRecords;
  if (state.selectedOrg !== 'ALL') {
    filtered = filtered.filter(r => r.org === state.selectedOrg);
  }

  // Filter ONLY vehicles strictly exceeding statutory threshold (> threshold, where threshold >= 90)
  // Speeds <= 90 are treated as if they don't even exist!
  const infractions = filtered.filter(item => item.speed > threshold);

  let totalSpeed = 0;
  let peakSpeed = 0;
  let fastestItem = null;
  const markers = [];
  const orgStats = {};

  infractions.forEach(item => {
    totalSpeed += item.speed;
    if (item.speed > peakSpeed) {
      peakSpeed = item.speed;
      fastestItem = item;
    }

    // Track org stats
    if (!orgStats[item.org]) {
      orgStats[item.org] = { total: 0, violations: 0, maxSpeed: 0 };
    }
    orgStats[item.org].total++;
    orgStats[item.org].violations++;
    if (item.speed > orgStats[item.org].maxSpeed) orgStats[item.org].maxSpeed = item.speed;

    // Marker styling for speed > 90 ONLY:
    // 90-100: Amber, 100-110: Red, >110: Flashing Crimson
    const isExtreme = item.speed > 110.0;
    const isHigh = item.speed > 100.0;
    const markerColor = isExtreme ? '#dc2626' : (isHigh ? '#ef4444' : '#f59e0b');
    const radius = isExtreme ? 9 : (isHigh ? 8 : 7);

    const marker = L.circleMarker([item.lat, item.lon], {
      radius: radius,
      fillColor: markerColor,
      color: '#ffffff',
      weight: 1.8,
      opacity: 0.95,
      fillOpacity: 0.88
    });

    const overspeedDelta = (item.speed - threshold).toFixed(1);
    const speedPercent = Math.min(100, Math.max(10, ((item.speed - 60) / (140 - 60)) * 100));
    const limitPercent = Math.min(100, Math.max(10, ((threshold - 60) / (140 - 60)) * 100));
    const severityTitle = isExtreme ? 'CRITICAL VIOLATION' : (isHigh ? 'HIGH VIOLATION' : 'MODERATE VIOLATION');
    const severityClass = isExtreme ? 'severity-critical' : (isHigh ? 'severity-high' : 'severity-moderate');

    const popupHtml = `
      <div class="cautio-alert-card">
        <!-- 1. Header Banner -->
        <div class="alert-card-header ${severityClass}">
          <div class="alert-header-badge">
            <span class="alert-radar-pulse"></span>
            <span class="alert-header-title"><i class="fa-solid fa-triangle-exclamation"></i> ${severityTitle}</span>
          </div>
          <span class="alert-speed-excess-pill">+${overspeedDelta} km/h EXCESS</span>
        </div>

        <!-- 2. Vehicle Plate Hero -->
        <div class="alert-plate-container">
          <div class="alert-field-header">
            <span class="alert-field-label"><i class="fa-solid fa-id-card"></i> Vehicle No:</span>
            <span class="alert-veh-status">VIOLATION ACTIVE</span>
          </div>
          <div class="cautio-license-plate">
            <div class="plate-ind-band">
              <span class="ind-chakra">⚙</span>
              <span class="ind-text">IND</span>
            </div>
            <div class="plate-number-text">${item.vehicle}</div>
          </div>
        </div>

        <!-- 3. Speedometer Telemetry Gauge Box -->
        <div class="alert-speed-telemetry-box ${severityClass}">
          <div class="speed-readout-row">
            <div class="speed-left">
              <span class="alert-field-label"><i class="fa-solid fa-gauge-high"></i> Recorded Speed:</span>
              <div class="speed-large-value">
                <span class="speed-num">${item.speed.toFixed(1)}</span>
                <span class="speed-unit">KM/H</span>
              </div>
            </div>
            <div class="speed-right">
              <span class="alert-field-label"><i class="fa-solid fa-shield-halved"></i> Statutory Limit:</span>
              <div class="limit-value-badge">${threshold.toFixed(0)} KM/H</div>
            </div>
          </div>

          <!-- Speed Meter Bar Graphic -->
          <div class="speed-mini-bar-wrap">
            <div class="speed-mini-bar-track">
              <div class="speed-mini-bar-fill ${severityClass}" style="width: ${speedPercent}%;"></div>
              <div class="speed-mini-bar-limit-marker" style="left: ${limitPercent}%;" title="Limit: ${threshold.toFixed(0)} km/h"></div>
            </div>
            <div class="speed-mini-bar-labels">
              <span>60 km/h</span>
              <span class="limit-label-text">Limit: ${threshold.toFixed(0)} km/h</span>
              <span>140+ km/h</span>
            </div>
          </div>
        </div>

        <!-- 4. Labeled Details Grid for Everything -->
        <div class="alert-fields-grid">
          <div class="alert-info-row">
            <span class="field-title"><i class="fa-solid fa-building-shield"></i> Fleet Operator:</span>
            <span class="field-data highlight-text">${item.org}</span>
          </div>
          <div class="alert-info-row">
            <span class="field-title"><i class="fa-solid fa-bell"></i> Alert Type:</span>
            <span class="field-data alert-tag-highlight">${item.alert || 'Overspeeding'}</span>
          </div>
          <div class="alert-info-row">
            <span class="field-title"><i class="fa-solid fa-calendar-day"></i> Alert Date:</span>
            <span class="field-data">${item.date}</span>
          </div>
          <div class="alert-info-row">
            <span class="field-title"><i class="fa-solid fa-clock"></i> Alert Time:</span>
            <span class="field-data font-mono">${item.time}</span>
          </div>
          <div class="alert-info-row coords-row">
            <span class="field-title"><i class="fa-solid fa-location-dot"></i> GPS Coords:</span>
            <span class="field-data font-mono">${item.lat.toFixed(5)}° N, ${item.lon.toFixed(5)}° E</span>
          </div>
        </div>

        <!-- 5. Card Actions -->
        <div class="alert-card-actions">
          <button class="alert-action-btn copy-btn" title="Copy full alert details to clipboard">
            <i class="fa-solid fa-copy"></i> Copy Details
          </button>
          <button class="alert-action-btn zoom-btn" title="Zoom in to street level">
            <i class="fa-solid fa-magnifying-glass-plus"></i> Street Zoom
          </button>
        </div>
      </div>
    `;

    marker.bindPopup(popupHtml, { className: 'cautio-dark-popup', maxWidth: 360, minWidth: 320 });
    marker._record = item;

    marker.on('popupopen', (e) => {
      const popupEl = e.popup.getElement();
      if (!popupEl) return;
      const copyBtn = popupEl.querySelector('.copy-btn');
      if (copyBtn) {
        copyBtn.onclick = () => {
          const summary = `Vehicle No: ${item.vehicle}\nFleet Operator: ${item.org}\nAlert Type: ${item.alert || 'Overspeeding'}\nRecorded Speed: ${item.speed.toFixed(1)} km/h\nStatutory Limit: ${threshold.toFixed(0)} km/h (Excess: +${overspeedDelta} km/h)\nAlert Time: ${item.time}\nAlert Date: ${item.date}\nGPS Coords: ${item.lat.toFixed(5)}, ${item.lon.toFixed(5)}`;
          const doCopy = () => {
            copyBtn.innerHTML = '<i class="fa-solid fa-check text-mint"></i> Copied!';
            setTimeout(() => {
              copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy Details';
            }, 2200);
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(summary).then(doCopy).catch(() => {
              const ta = document.createElement('textarea');
              ta.value = summary;
              document.body.appendChild(ta);
              ta.select();
              document.execCommand('copy');
              document.body.removeChild(ta);
              doCopy();
            });
          } else {
            const ta = document.createElement('textarea');
            ta.value = summary;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            doCopy();
          }
        };
      }

      const zoomBtn = popupEl.querySelector('.zoom-btn');
      if (zoomBtn) {
        zoomBtn.onclick = () => {
          state.map.flyTo([item.lat, item.lon], 15, { animate: true, duration: 0.8 });
        };
      }
    });

    markers.push(marker);
  });

  state.markers = markers;
  state.fastestRecord = fastestItem;

  if (typeof state.markerCluster.addLayers === 'function') {
    state.markerCluster.addLayers(markers);
  } else {
    markers.forEach(m => state.markerCluster.addLayer(m));
  }

  if (markers.length > 0) {
    const group = L.featureGroup(markers);
    state.map.fitBounds(group.getBounds().pad(0.08), { maxZoom: 14 });
  }

  // Compute Metrics & Insights (Strictly overspeed records)
  const totalCount = infractions.length;
  const distinctVehicles = new Set(infractions.map(i => i.vehicle)).size;
  const severeCount = infractions.filter(r => r.speed > 110.0).length;
  const meanSpeed = totalCount > 0 ? (totalSpeed / totalCount).toFixed(1) : '0.0';
  const fastestVehPlate = fastestItem ? fastestItem.vehicle : '--';

  // Find Top Risk Organization
  const sortedOrgs = Object.entries(orgStats).sort((a, b) => b[1].violations - a[1].violations);
  const topRisk = sortedOrgs.length > 0 && sortedOrgs[0][1].violations > 0 ? sortedOrgs[0][0] : 'None';

  // 1. UPDATE TOP BUBBLE ISLAND
  if (activeFleetCountEl) activeFleetCountEl.textContent = distinctVehicles;
  if (complianceRateDisplayEl) {
    complianceRateDisplayEl.textContent = severeCount;
    complianceRateDisplayEl.className = severeCount > 0 ? 'chip-val highlight-rose' : 'chip-val highlight-emerald';
  }
  if (infractionsCountEl) infractionsCountEl.textContent = totalCount;
  if (meanSpeedDisplayEl) meanSpeedDisplayEl.textContent = `${meanSpeed} km/h`;
  if (peakSpeedDisplayEl) peakSpeedDisplayEl.textContent = `${peakSpeed.toFixed(1)} km/h`;
  if (topOffenderDisplayEl) {
    topOffenderDisplayEl.textContent = fastestVehPlate;
    topOffenderDisplayEl.title = fastestItem ? `Fastest: ${fastestItem.vehicle} (${fastestItem.speed.toFixed(1)} km/h) - Click to zoom on map` : '';
  }
  if (topRiskOrgDisplayEl) {
    const cleanOrg = topRisk.length > 14 ? topRisk.substring(0, 12) + '..' : topRisk;
    topRiskOrgDisplayEl.textContent = cleanOrg;
    topRiskOrgDisplayEl.title = `Top Infraction Operator: ${topRisk}`;
  }

  // 2. UPDATE EXPANDABLE TOP INSIGHTS DRAWER
  if (drawerTotalUnits) drawerTotalUnits.textContent = distinctVehicles;
  if (drawerCompliantUnits) drawerCompliantUnits.textContent = severeCount;
  if (drawerCompliancePct) drawerCompliancePct.textContent = `${severeCount} Severe (>110 km/h)`;
  if (drawerInfractionsUnits) drawerInfractionsUnits.textContent = totalCount;
  if (drawerInfractionThreshold) drawerInfractionThreshold.textContent = `Threshold > ${threshold.toFixed(0)} km/h`;
  if (drawerMeanSpeed) drawerMeanSpeed.textContent = `${meanSpeed} km/h`;
  if (drawerPeakSpeed) drawerPeakSpeed.textContent = `${peakSpeed.toFixed(1)} km/h`;
  if (drawerFastestVehicle) drawerFastestVehicle.textContent = fastestItem ? `Vehicle No: ${fastestItem.vehicle} (${fastestItem.org})` : '--';

  // 3. SPEED SPECTRUM BAR DISTRIBUTION (Only speeds > 90)
  const specModerate = infractions.filter(r => r.speed > 90 && r.speed <= 100).length;
  const specHigh = infractions.filter(r => r.speed > 100 && r.speed <= 110).length;
  const specCritical = infractions.filter(r => r.speed > 110).length;

  if (totalCount > 0) {
    const pMod = (specModerate / totalCount) * 100;
    const pHigh = (specHigh / totalCount) * 100;
    const pCrit = (specCritical / totalCount) * 100;

    const specWarningSeg = document.getElementById('specWarningSeg');
    const specHighSeg = document.getElementById('specHighSeg');
    const specCriticalSeg = document.getElementById('specCriticalSeg');

    if (specWarningSeg) specWarningSeg.style.width = `${pMod}%`;
    if (specHighSeg) specHighSeg.style.width = `${pHigh}%`;
    if (specCriticalSeg) specCriticalSeg.style.width = `${pCrit}%`;

    if (spectrumStatsText) {
      spectrumStatsText.innerHTML = `
        <strong>${specModerate}</strong> Moderate (90-100 km/h) &bull; 
        <strong>${specHigh}</strong> High (100-110 km/h) &bull; 
        <strong style="color:#f87171">${specCritical}</strong> Severe (>110 km/h)
      `;
    }
  }

  // 4. TOP SPEEDERS SPOTLIGHT IN DRAWER (Clear labels: Vehicle No, Fleet, Speed)
  if (topSpeedersList) {
    const top4 = [...infractions].sort((a, b) => b.speed - a.speed).slice(0, 4);
    if (top4.length === 0) {
      topSpeedersList.innerHTML = '<div class="empty-state">No overspeeding vehicles logged.</div>';
    } else {
      topSpeedersList.innerHTML = top4.map((item, idx) => {
        const isExt = item.speed > 110;
        return `
          <div class="speeder-row" data-veh="${item.vehicle}" data-lat="${item.lat}" data-lon="${item.lon}" title="Click to view alert for Vehicle No: ${item.vehicle}">
            <div class="speeder-left">
              <div class="speeder-veh-row">
                <span class="speeder-rank">#${idx+1}</span>
                <span class="lbl-dim">Vehicle No:</span>
                <span class="speeder-veh-plate">${item.vehicle}</span>
              </div>
              <div class="speeder-sub">
                <span class="lbl-dim">Fleet:</span> ${item.org} &bull; <span class="lbl-dim">Time:</span> ${item.time}
              </div>
            </div>
            <div class="speeder-right">
              <span class="speeder-badge ${isExt ? 'danger' : 'warning'}">
                <span class="lbl-dim-sm">Speed:</span> ${item.speed.toFixed(1)} km/h
              </span>
              <i class="fa-solid fa-location-crosshairs speeder-zoom-icon"></i>
            </div>
          </div>
        `;
      }).join('');

      topSpeedersList.querySelectorAll('.speeder-row').forEach(row => {
        row.addEventListener('click', () => {
          const lat = parseFloat(row.dataset.lat);
          const lon = parseFloat(row.dataset.lon);
          const veh = row.dataset.veh;
          closeTopInsightsDrawer();
          const targetItem = infractions.find(r => r.vehicle === veh && Math.abs(r.lat - lat) < 0.001) || infractions.find(r => r.vehicle === veh);
          if (targetItem) {
            focusAndOpenMarker(targetItem);
          } else if (!isNaN(lat) && !isNaN(lon) && state.map) {
            state.map.flyTo([lat, lon], 14, { animate: true, duration: 1.0 });
          }
        });
      });
    }
  }

  // 5. OPERATOR RISK SCOREBOARD IN DRAWER
  if (operatorRiskList) {
    if (sortedOrgs.length === 0) {
      operatorRiskList.innerHTML = '<div class="empty-state">No overspeeding fleet operators recorded.</div>';
    } else {
      operatorRiskList.innerHTML = sortedOrgs.slice(0, 4).map(([org, stats]) => {
        return `
          <div class="operator-risk-row">
            <span class="op-name">${org}</span>
            <div class="op-stats">
              <span class="op-ratio">${stats.violations} Infractions</span>
              <span class="op-badge badge-warn">
                Peak: ${stats.maxSpeed.toFixed(1)} km/h
              </span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 6. SYNCHRONIZE LEGACY POPUPS & GAUGES
  if (cardTotalUnits) cardTotalUnits.textContent = distinctVehicles;
  if (cardViolatingUnits) cardViolatingUnits.textContent = totalCount;
  if (cardMeanSpeed) cardMeanSpeed.textContent = `${meanSpeed} km/h`;
  if (cardPeakSpeed) cardPeakSpeed.textContent = `${peakSpeed.toFixed(1)} km/h`;
  if (fastestUnitLabel) {
    fastestUnitLabel.textContent = fastestItem ? `Vehicle No: ${fastestItem.vehicle} (${peakSpeed.toFixed(1)} km/h)` : '--';
    fastestUnitLabel.style.cursor = fastestItem ? 'pointer' : 'default';
    fastestUnitLabel.onclick = () => {
      if (fastestItem) {
        const tModal = document.getElementById('telemetryModal');
        if (tModal) tModal.classList.remove('active');
        focusAndOpenMarker(fastestItem);
      }
    };
  }

  const navViolationsCount = document.getElementById('navViolationsCount');
  if (navViolationsCount) navViolationsCount.textContent = totalCount;

  if (violationsBadge) {
    violationsBadge.textContent = `${totalCount} Flags`;
    violationsBadge.style.background = totalCount > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.2)';
    violationsBadge.style.color = totalCount > 0 ? '#f87171' : '#34d399';
  }

  if (gaugeSpeedNum) gaugeSpeedNum.textContent = peakSpeed.toFixed(0);
  if (speedSvgRing) {
    const clampedPct = Math.min(Math.max((peakSpeed / 140), 0), 1);
    const offset = 264 - (clampedPct * 264);
    speedSvgRing.style.strokeDashoffset = offset;
    speedSvgRing.style.stroke = '#ef4444';
  }

  renderViolationsFeed(infractions);
}

function renderViolationsFeed(infractions) {
  if (!violationsList) return;

  if (infractions.length === 0) {
    violationsList.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-circle-check" style="font-size:2rem; color:var(--cautio-mint); margin-bottom:10px;"></i>
        <p>No statutory infractions logged above ${state.statutoryThreshold} km/h.</p>
      </div>
    `;
    return;
  }

  let html = '';
  infractions.sort((a, b) => b.speed - a.speed).forEach(item => {
    const isExtreme = item.speed > 110;
    const isHigh = item.speed > 100;
    const severityClass = isExtreme ? 'severity-critical' : (isHigh ? 'severity-high' : 'severity-moderate');
    const overspeedDelta = (item.speed - state.statutoryThreshold).toFixed(1);

    html += `
      <div class="card-log-entry ${severityClass}" data-veh="${item.vehicle}" data-lat="${item.lat}" data-lon="${item.lon}" title="Click to view alert for Vehicle No: ${item.vehicle}">
        <div class="log-entry-header">
          <div class="log-entry-plate">
            <span class="lbl-tag">Vehicle No:</span>
            <span class="plate-pill">${item.vehicle}</span>
          </div>
          <div class="log-entry-speed-badge ${severityClass}">
            <i class="fa-solid fa-gauge-high"></i>
            <span class="lbl-tag">Speed:</span>
            <strong>${item.speed.toFixed(1)} km/h</strong>
            <span class="delta-tag">(+${overspeedDelta})</span>
          </div>
        </div>

        <div class="log-entry-grid">
          <div class="log-grid-item">
            <span class="log-lbl"><i class="fa-solid fa-building-shield"></i> Fleet Operator:</span>
            <span class="log-val">${item.org}</span>
          </div>
          <div class="log-grid-item">
            <span class="log-lbl"><i class="fa-solid fa-bell"></i> Alert Type:</span>
            <span class="log-val text-rose">${item.alert || 'Overspeeding'}</span>
          </div>
          <div class="log-grid-item">
            <span class="log-lbl"><i class="fa-solid fa-clock"></i> Alert Time:</span>
            <span class="log-val font-mono">${item.time}</span>
          </div>
          <div class="log-grid-item">
            <span class="log-lbl"><i class="fa-solid fa-calendar-day"></i> Alert Date:</span>
            <span class="log-val font-mono">${item.date}</span>
          </div>
          <div class="log-grid-item" style="grid-column: span 2;">
            <span class="log-lbl"><i class="fa-solid fa-location-dot"></i> GPS Coords:</span>
            <span class="log-val font-mono">${item.lat.toFixed(5)}° N, ${item.lon.toFixed(5)}° E</span>
          </div>
        </div>

        <div class="log-entry-footer">
          <span class="click-hint"><i class="fa-solid fa-location-crosshairs text-mint"></i> Click to inspect Vehicle No: ${item.vehicle} on map &rarr;</span>
        </div>
      </div>
    `;
  });

  violationsList.innerHTML = html;

  violationsList.querySelectorAll('.card-log-entry').forEach(row => {
    row.addEventListener('click', () => {
      const lat = parseFloat(row.dataset.lat);
      const lon = parseFloat(row.dataset.lon);
      const veh = row.dataset.veh;
      const vModal = document.getElementById('violationsModal');
      if (vModal) vModal.classList.remove('active');

      const targetItem = infractions.find(r => r.vehicle === veh && Math.abs(r.lat - lat) < 0.001) || infractions.find(r => r.vehicle === veh);
      if (targetItem) {
        focusAndOpenMarker(targetItem);
      } else if (!isNaN(lat) && !isNaN(lon) && state.map) {
        state.map.flyTo([lat, lon], 14, { animate: true, duration: 1.0 });
      }
    });
  });
}

/* ==========================================================================
   DEFAULT ZINGBUS DATASET
   ========================================================================== */
function loadDefaultZingbusData() {
  const zingbusRecords = [
    { "Vehicle Number": "BR28P4394", "L1-Org": "Zingbus_Deepak Raj", "Date": "02 Sept 2026", "Alert time": "11:57:59 pm", "Alert type": "Overspeeding", "Vehicle Speed (km/h)": 118.5, "Alert location": "POINT (80.525022 26.897363)" },
    { "Vehicle Number": "BR28P4394", "L1-Org": "Zingbus_Deepak Raj", "Date": "02 Sept 2026", "Alert time": "11:42:01 pm", "Alert type": "Overspeeding", "Vehicle Speed (km/h)": 122.1, "Alert location": "POINT (80.9462 26.8467)" },
    { "Vehicle Number": "BR28P4394", "L1-Org": "Zingbus_Deepak Raj", "Date": "02 Sept 2026", "Alert time": "11:15:22 pm", "Alert type": "Overspeeding", "Vehicle Speed (km/h)": 126.4, "Alert location": "POINT (81.2500 26.7500)" },
    { "Vehicle Number": "DL1PD7823", "L1-Org": "Zingbus_Delhi", "Date": "02 Sept 2026", "Alert time": "11:59:46 pm", "Alert type": "Overspeeding", "Vehicle Speed (km/h)": 104.2, "Alert location": "POINT (76.970231 29.435555)" },
    { "Vehicle Number": "DL1PD7823", "L1-Org": "Zingbus_Delhi", "Date": "02 Sept 2026", "Alert time": "11:35:40 pm", "Alert type": "Overspeeding", "Vehicle Speed (km/h)": 107.8, "Alert location": "POINT (76.8500 29.5200)" },
    { "Vehicle Number": "UP14LT8841", "L1-Org": "Green Cell Express", "Date": "02 Sept 2026", "Alert time": "11:30:10 pm", "Alert type": "Overspeeding", "Vehicle Speed (km/h)": 101.3, "Alert location": "POINT (77.4538 28.6692)" },
    { "Vehicle Number": "HR55AW8029", "L1-Org": "Shoffr Delhi", "Date": "02 Sept 2026", "Alert time": "11:55:12 pm", "Alert type": "Overspeeding", "Vehicle Speed (km/h)": 96.0, "Alert location": "POINT (77.1025 28.7041)" },
    { "Vehicle Number": "TS07UN0855", "L1-Org": "CITYFLO HYD", "Date": "02 Sept 2026", "Alert time": "11:48:15 pm", "Alert type": "Overspeeding", "Vehicle Speed (km/h)": 98.7, "Alert location": "POINT (78.4867 17.3850)" },
    { "Vehicle Number": "MH01EE8167", "L1-Org": "Euro Delhi", "Date": "02 Sept 2026", "Alert time": "11:51:30 pm", "Alert type": "Overspeeding", "Vehicle Speed (km/h)": 92.4, "Alert location": "POINT (77.2090 28.6139)" },
    { "Vehicle Number": "TN38DH9498", "L1-Org": "Booms Cab", "Date": "02 Sept 2026", "Alert time": "11:39:20 pm", "Alert type": "Overspeeding", "Vehicle Speed (km/h)": 91.5, "Alert location": "POINT (76.9558 11.0168)" },
    { "Vehicle Number": "KA03AP1837", "L1-Org": "Infants_TEPL", "Date": "02 Sept 2026", "Alert time": "11:25:00 pm", "Alert type": "Overspeeding", "Vehicle Speed (km/h)": 94.6, "Alert location": "POINT (77.5946 12.9716)" },
    { "Vehicle Number": "MH12SX6507", "L1-Org": "Shree Maruthi", "Date": "02 Sept 2026", "Alert time": "11:20:15 pm", "Alert type": "Overspeeding", "Vehicle Speed (km/h)": 93.8, "Alert location": "POINT (73.8567 18.5204)" }
  ];

  processTelemetryData(zingbusRecords);
}

/* ==========================================================================
   CSV EXPORT PIPELINE
   ========================================================================== */
function exportOverspeedCsv() {
  let data = state.cleansedRecords;
  if (state.selectedOrg !== 'ALL') {
    data = data.filter(r => r.org === state.selectedOrg);
  }
  const overspeedData = data.filter(r => r.speed > state.statutoryThreshold);

  if (overspeedData.length === 0) {
    alert(`No infractions detected above ${state.statutoryThreshold} km/h to export.`);
    return;
  }

  let csv = "Vehicle Number,L1-Org,Date,Alert time,Alert type,Vehicle Speed (km/h),Latitude,Longitude\n";
  overspeedData.forEach(r => {
    csv += `"${r.vehicle}","${r.org}","${r.date}","${r.time}","${r.alert}","${r.speed}","${r.lat}","${r.lon}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CAUTIO_Overspeeding_Report_${state.statutoryThreshold}kmh.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ==========================================================================
   TOP INSIGHTS DRAWER CONTROLLER
   ========================================================================== */
function toggleTopInsightsDrawer() {
  if (!topInsightsDrawer) return;
  const isActive = topInsightsDrawer.classList.toggle('active');
  if (btnToggleTopInsights) btnToggleTopInsights.classList.toggle('active', isActive);
}

function closeTopInsightsDrawer() {
  if (topInsightsDrawer) topInsightsDrawer.classList.remove('active');
  if (btnToggleTopInsights) btnToggleTopInsights.classList.remove('active');
}

if (btnToggleTopInsights) {
  btnToggleTopInsights.addEventListener('click', toggleTopInsightsDrawer);
}

if (btnCloseTopInsights) {
  btnCloseTopInsights.addEventListener('click', closeTopInsightsDrawer);
}

// Click Top Offender chip in bar -> Fly directly to vehicle on map and open alert popup
if (chipTopOffender) {
  chipTopOffender.addEventListener('click', () => {
    if (state.fastestRecord) {
      focusAndOpenMarker(state.fastestRecord);
    }
  });
}

/* ==========================================================================
   EVENT LISTENERS & BUBBLE CONTROLS
   ========================================================================== */
if (speedThresholdSlider) {
  speedThresholdSlider.addEventListener('input', (e) => {
    state.statutoryThreshold = Math.max(90.0, parseFloat(e.target.value) || 90.0);
    if (threshDisplay) threshDisplay.textContent = `> ${state.statutoryThreshold.toFixed(0)} km/h`;
    renderRadarMap();
  });
}

if (orgFilterSelect) {
  orgFilterSelect.addEventListener('change', (e) => {
    state.selectedOrg = e.target.value;
    renderRadarMap();
  });
}

if (uploadCsvBtn && csvFileInput) {
  uploadCsvBtn.addEventListener('click', () => csvFileInput.click());
  csvFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && window.Papa) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => processTelemetryData(res.data)
      });
    }
  });
}

if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportOverspeedCsv);
if (exportCsvBottomBtn) exportCsvBottomBtn.addEventListener('click', exportOverspeedCsv);
if (reloadZingbusBtn) reloadZingbusBtn.addEventListener('click', loadDefaultZingbusData);

// ==========================================================================
// FULLSCREEN MAP CONTROLLER
// ==========================================================================
const btnFullscreenMap = document.getElementById('btnFullscreenMap');
const btnExitFullscreenOverlay = document.getElementById('btnExitFullscreenOverlay');
const stageWrapper = document.getElementById('stageWrapper');

function toggleMapFullscreen() {
  if (!stageWrapper) return;
  const isOverlay = stageWrapper.classList.contains('stage-fullscreen-mode');
  const isNative = !!document.fullscreenElement;

  if (!isNative && !isOverlay) {
    if (stageWrapper.requestFullscreen) {
      stageWrapper.requestFullscreen().catch(() => {
        stageWrapper.classList.add('stage-fullscreen-mode');
      });
    } else {
      stageWrapper.classList.add('stage-fullscreen-mode');
    }
  } else {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    stageWrapper.classList.remove('stage-fullscreen-mode');
  }

  [50, 150, 300, 500].forEach(delay => {
    setTimeout(() => {
      if (state.map) state.map.invalidateSize();
    }, delay);
  });
}

if (btnFullscreenMap) btnFullscreenMap.addEventListener('click', toggleMapFullscreen);
if (btnExitFullscreenOverlay) {
  btnExitFullscreenOverlay.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    stageWrapper.classList.remove('stage-fullscreen-mode');
    [50, 150, 300].forEach(delay => setTimeout(() => state.map?.invalidateSize(), delay));
  });
}

// Global hotkeys: 'F' = Fullscreen Map, 'Escape' = Exit / Close Drawers
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.key === 'f' || e.key === 'F') {
    toggleMapFullscreen();
  } else if (e.key === 'Escape') {
    closeTopInsightsDrawer();
    closeModal(telemetryModal);
    closeModal(violationsModal);
    if (stageWrapper && stageWrapper.classList.contains('stage-fullscreen-mode')) {
      stageWrapper.classList.remove('stage-fullscreen-mode');
      setTimeout(() => state.map?.invalidateSize(), 150);
    }
  }
});

// Sync UI on standard fullscreen state changes
document.addEventListener('fullscreenchange', () => {
  const isFs = !!document.fullscreenElement;
  if (btnFullscreenMap) {
    btnFullscreenMap.innerHTML = isFs 
      ? '<i class="fa-solid fa-compress"></i> <span>Exit Fullscreen</span>' 
      : '<i class="fa-solid fa-expand"></i> <span>Fullscreen</span>';
  }
  [50, 150, 300, 600].forEach(delay => setTimeout(() => state.map?.invalidateSize(), delay));
});

// ==========================================================================
// MODAL POPUPS CONTROLLER (TELEMETRY MATRIX & VIOLATIONS FEED)
// ==========================================================================
const btnOpenTelemetryModal = document.getElementById('btnOpenTelemetryModal');
const btnOpenViolationsModal = document.getElementById('btnOpenViolationsModal');
const btnCloseTelemetryModal = document.getElementById('btnCloseTelemetryModal');
const btnCloseViolationsModal = document.getElementById('btnCloseViolationsModal');
const telemetryModal = document.getElementById('telemetryModal');
const violationsModal = document.getElementById('violationsModal');

function openModal(modal) {
  if (modal) modal.classList.add('active');
}

function closeModal(modal) {
  if (modal) modal.classList.remove('active');
}

if (btnOpenTelemetryModal) btnOpenTelemetryModal.addEventListener('click', () => openModal(telemetryModal));
if (btnOpenViolationsModal) btnOpenViolationsModal.addEventListener('click', () => openModal(violationsModal));
if (btnCloseTelemetryModal) btnCloseTelemetryModal.addEventListener('click', () => closeModal(telemetryModal));
if (btnCloseViolationsModal) btnCloseViolationsModal.addEventListener('click', () => closeModal(violationsModal));

[telemetryModal, violationsModal].forEach(modal => {
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  }
});

// Click metric chips in navbar to open drawers / popups
const chipInfractions = document.getElementById('chipInfractions');
if (chipInfractions) {
  chipInfractions.addEventListener('click', () => openModal(violationsModal));
}

const chipFleetSize = document.getElementById('chipFleetSize');
if (chipFleetSize) {
  chipFleetSize.addEventListener('click', () => openModal(telemetryModal));
}

const chipCompliance = document.getElementById('chipCompliance');
if (chipCompliance) {
  chipCompliance.addEventListener('click', toggleTopInsightsDrawer);
}

// ==========================================================================
// BUBBLE HUD VISIBILITY TOGGLE (ZEN MODE)
// ==========================================================================
const btnToggleHudVisibility = document.getElementById('btnToggleHudVisibility');
const hudEyeIcon = document.getElementById('hudEyeIcon');

if (btnToggleHudVisibility) {
  btnToggleHudVisibility.addEventListener('click', () => {
    const isZen = document.body.classList.toggle('hud-zen-mode');
    if (hudEyeIcon) hudEyeIcon.className = isZen ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
  });
}

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.key === 'h' || e.key === 'H') {
    const isZen = document.body.classList.toggle('hud-zen-mode');
    if (hudEyeIcon) hudEyeIcon.className = isZen ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
  }
});

/* ==========================================================================
   INITIALIZATION BOOTSTRAP
   ========================================================================== */
function bootApplication() {
  if (typeof L === 'undefined') {
    setTimeout(bootApplication, 50);
    return;
  }
  initLeafletMap();
  loadDefaultZingbusData();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApplication);
} else {
  bootApplication();
}

window.addEventListener('load', () => {
  if (!state.map) bootApplication();
  else state.map.invalidateSize();
});

setTimeout(() => {
  if (!state.map) bootApplication();
  else state.map.invalidateSize();
}, 300);
