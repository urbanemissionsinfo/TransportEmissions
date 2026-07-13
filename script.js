(function(){
  "use strict";
 
  // ---------- helpers ----------
  function fmt(n, d){
    if (n === null || n === undefined || isNaN(n)) return '—';
    d = d === undefined ? 2 : d;
    return Number(n).toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: d});
  }
  function el(tag, attrs, ...children){
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs){
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    children.flat().forEach(c => { if (c !== null && c !== undefined) e.append(c.nodeType ? c : document.createTextNode(c)); });
    return e;
  }
 
  // ---------- pollutant profiles (Default g/km EFs) ----------
  const POLLUTANTS = {
    'PM2.5': { label: 'PM₂.₅ (Particulate Matter ≤ 2.5 µm)', unit: 'tons/yr', defaults: { 'Cars': 0.02, '2-Wheelers': 0.01, '3-Wheelers': 0.03, 'Bus': 0.25, 'Truck': 0.35, 'Walking': 0, 'Bicycle': 0 } },
    'PM10':  { label: 'PM₁₀ (Particulate Matter ≤ 10 µm)',  unit: 'tons/yr', defaults: { 'Cars': 0.03, '2-Wheelers': 0.015, '3-Wheelers': 0.04, 'Bus': 0.35, 'Truck': 0.50, 'Walking': 0, 'Bicycle': 0 } },
    'NOx':   { label: 'NOₓ (Nitrogen Oxides)',               unit: 'tons/yr', defaults: { 'Cars': 0.40, '2-Wheelers': 0.15, '3-Wheelers': 0.35, 'Bus': 6.50, 'Truck': 7.00, 'Walking': 0, 'Bicycle': 0 } },
    'CO':    { label: 'CO (Carbon Monoxide)',              unit: 'tons/yr', defaults: { 'Cars': 1.20, '2-Wheelers': 1.80, '3-Wheelers': 2.20, 'Bus': 3.50, 'Truck': 4.00, 'Walking': 0, 'Bicycle': 0 } },
    'SO2':   { label: 'SO₂ (Sulphur Dioxide)',             unit: 'tons/yr', defaults: { 'Cars': 0.005, '2-Wheelers': 0.002, '3-Wheelers': 0.004, 'Bus': 0.02, 'Truck': 0.03, 'Walking': 0, 'Bicycle': 0 } },
    'VOC':   { label: 'VOC/NMHC (Ozone Precursors)',       unit: 'tons/yr', defaults: { 'Cars': 0.15, '2-Wheelers': 0.50, '3-Wheelers': 0.40, 'Bus': 0.85, 'Truck': 1.20, 'Walking': 0, 'Bicycle': 0 } }
  };

  let currentPollutant = 'PM2.5';

  // ---------- equation configs ----------
  const EQUATIONS = [
    {
      id: 'eq1', tabLabel: 'Method 1', tabSub: 'Vehicle-km travelled',
      title: 'Method 1 — Vehicle-Kilometres Travelled (VKT)',
      type: 'modes',
      totalKey: 'J', totalUnit: 'tons / year', totalLabel: 'Total Emissions',
      fields: [
        {key:'C', label:'Number of Vehicles', unit:'vehicles', min:0, max:2000000, step:1000, dec:0},
        {key:'D', label:'Distance Travelled', unit:'km/day', min:0, max:150, step:1, dec:0},
        {key:'E', label:'Emission Factor', unit:'g/km', min:0, max:10, step:0.01, dec:2}, // Increased max to handle CO/NOx
        {key:'F', label:'Operational Days', unit:'days/yr', min:0, max:365, step:1, dec:0},
        {key:'G', label:'Fuel Efficiency', unit:'km/L', min:0.5, max:60, step:0.5, dec:1},
      ],
      outputs: [
        {key:'H', label:'Vehicular km Travelled', unit:'million km/yr', dec:1},
        {key:'I', label:'Fuel Consumed', unit:'million L/yr', dec:1},
        {key:'J', label:'Emissions', unit:'tons/yr', dec:1},
      ],
      rows: [
        {name:'Cars', C:500000, D:40, F:310, G:12},
        {name:'2-Wheelers', C:1000000, D:40, F:220, G:30},
        {name:'3-Wheelers', C:50000, D:200, F:330, G:25},
        {name:'Bus', C:5000, D:150, F:330, G:3},
        {name:'Truck', C:5000, D:100, F:300, G:3},
      ],
      compute(row){
        const H = row.C * row.D * row.F / 1e6;
        const I = row.G > 0 ? H / row.G : 0;
        const J = H * row.E;
        return {H, I, J};
      },
      explain: [
        `This is the classic activity-based (bottom-up) method: for each vehicle category, emissions are built from the number of vehicles on the road, how far each one travels per day, how many days a year it operates, and its emission factor.`,
        `<span class="vapis-formula">Emissions = Vehicles × Distance/day × Operating days × Emission Factor</span>`,
        `It needs good vehicle-registration and travel-survey data, but is the most transparent method when that data exists — every number traces back to something you can independently verify.`
      ]
    },
    {
      id: 'eq2', tabLabel: 'Method 2', tabSub: 'Fuel-based',
      title: 'Method 2 — Fuel Sales / Fuel Consumption',
      type: 'modes',
      totalKey: 'H', totalUnit: 'tons / year', totalLabel: 'Total Emissions',
      topControl: {key:'totalFuel', label:'City-wide Fuel Consumption', unit:'million litres / year', min:0, max:5000, step:50, value:1000, dec:0},
      fields: [
        {key:'C', label:'Share of Fuel Used', unit:'%', min:0, max:100, step:1, dec:0},
        {key:'E', label:'Fuel Efficiency', unit:'km/L', min:0.5, max:60, step:0.5, dec:1},
        {key:'F', label:'Emission Factor', unit:'g/km', min:0, max:10, step:0.01, dec:2},
      ],
      outputs: [
        {key:'D', label:'Fuel Consumed', unit:'million L/yr', dec:1},
        {key:'G', label:'Distance Travelled', unit:'million km/yr', dec:1},
        {key:'H', label:'Emissions', unit:'tons/yr', dec:1},
      ],
      rows: [
        {name:'Cars', C:50, E:12},
        {name:'2-Wheelers', C:30, E:30},
        {name:'3-Wheelers', C:10, E:12},
        {name:'Bus', C:5, E:5},
        {name:'Truck', C:5, E:5},
        {name:'Walking', C:0, E:0},
        {name:'Bicycle', C:0, E:0},
      ],
      compute(row, ctx){
        const D = row.C * ctx.totalFuel / 100;
        const G = D * row.E;
        const H = G * row.F;
        return {D, G, H};
      },
      explain: [
        `Instead of counting vehicles, this method starts from total fuel sold in the city (from fuel-retail or taxation data) and splits it across vehicle types by their estimated share of consumption.`,
        `<span class="vapis-formula">Fuel per mode = Share % × Total Fuel; Distance = Fuel × Fuel Efficiency; Emissions = Distance × EF</span>`,
        `It's useful where fuel-sales records are more reliable than traffic counts, though it depends on a reasonable estimate of how fuel use splits between vehicle categories.`
      ]
    },
    {
      id: 'eq3', tabLabel: 'Method 3', tabSub: 'Passenger trips',
      title: 'Method 3 — Passenger Trip-Based',
      type: 'modes',
      totalKey: 'J', totalUnit: 'tons / year', totalLabel: 'Total Emissions',
      topControl: {key:'totalTrips', label:'City-wide Passenger Trips', unit:'million trips / year', min:0, max:30000, step:100, value:7000, dec:0},
      fields: [
        {key:'C', label:'Share of Trips', unit:'%', min:0, max:100, step:1, dec:0},
        {key:'E', label:'Avg. Trip Length', unit:'km/trip', min:0, max:50, step:0.5, dec:1},
        {key:'F', label:'Occupancy', unit:'persons/vehicle', min:0.5, max:150, step:0.5, dec:1},
        {key:'G', label:'Fuel Efficiency', unit:'km/L', min:0, max:60, step:0.5, dec:1},
        {key:'H', label:'Emission Factor', unit:'g/km', min:0, max:10, step:0.01, dec:2},
      ],
      outputs: [
        {key:'D', label:'Trips per Mode', unit:'million trips/yr', dec:1},
        {key:'I', label:'Distance Travelled', unit:'million km/yr', dec:1},
        {key:'J', label:'Emissions', unit:'tons/yr', dec:1},
        {key:'K', label:'Fuel Consumed', unit:'million L/yr', dec:1},
      ],
      rows: [
        {name:'Cars', C:20, E:10, F:1.5, G:12},
        {name:'2-Wheelers', C:20, E:5, F:1.2, G:30},
        {name:'3-Wheelers', C:5, E:6, F:5, G:25},
        {name:'Bus', C:25, E:10, F:80, G:3},
        {name:'Walking', C:15, E:1, F:1, G:0},
        {name:'Bicycle', C:15, E:1, F:1, G:0},
      ],
      compute(row, ctx){
        const D = row.C * ctx.totalTrips / 100;
        const I = row.F > 0 ? (D * row.E) / row.F : 0;
        const J = I * row.H;
        const K = row.G > 0 ? I / row.G : null;
        return {D, I, J, K};
      },
      explain: [
        `This method works from travel-demand data: the share of trips made by each mode, how far a typical trip is, and how many people share each vehicle. Vehicle-distance is derived by dividing passenger-distance by occupancy.`,
        `<span class="vapis-formula">Distance = (Trips × Trip Length) / Occupancy; Emissions = Distance × EF</span>`,
        `It's the natural choice when a household travel survey already exists, and it naturally captures the emissions benefit of higher-occupancy modes like buses.`
      ]
    },
    {
      id: 'eq4', tabLabel: 'Method 4', tabSub: 'Concentration / box model',
      title: 'Method 4 — Concentration-Based (Box Model)',
      type: 'params',
      totalUnit: 'tons / period', totalLabel: 'Estimated Emissions',
      params: [
        {key:'C', label:'Average Concentration', unit:'mg/m³', min:0, max:300, step:1, value:80, dec:1},
        {key:'V', label:'Vehicular Contribution', unit:'%', min:0, max:100, step:1, value:25, dec:0},
        {key:'X', label:'Domain Cross-Section', unit:'m', min:1000, max:50000, step:500, value:10000, dec:0},
        {key:'L', label:'Domain Length', unit:'m', min:0.1, max:10, step:0.1, value:1, dec:1},
        {key:'Hh', label:'Avg. Mixing Height', unit:'m', min:50, max:2000, step:10, value:500, dec:0},
        {key:'U', label:'Average Wind Speed', unit:'m/s', min:0.1, max:10, step:0.1, value:1, dec:1},
        {key:'T', label:'Averaging Period', unit:'days', min:1, max:365, step:1, value:365, dec:0},
      ],
      compute(p){
        return p.C * (p.V/100) * p.X * p.L * p.Hh * p.U * 1e-12 * p.T * 86400;
      },
      explain: [
        `This is a reverse "box model": rather than building emissions up from traffic activity, it works backward from a measured ambient concentration. The airshed is treated as a box of a given cross-section and mixing height, through which wind flushes air at a steady speed.`,
        `<span class="vapis-formula">Emissions = Concentration × Vehicular Share × Cross-section × Length × Mixing Height × Wind Speed × Averaging Period</span>`,
        `It's most useful as a sanity check on the other three methods — if a bottom-up inventory and this top-down estimate disagree by an order of magnitude, one of your input assumptions needs a second look.`
      ]
    },
  ];
 
  // ---------- state init ----------
  const state = {};
  
  function applyPollutantDefaults(eqId, polKey) {
    const eq = EQUATIONS.find(e => e.id === eqId);
    if (!eq || eq.type !== 'modes') return;
    
    const defaults = POLLUTANTS[polKey].defaults;
    const efFieldKey = eqId === 'eq1' ? 'E' : 'F'; // Method 1 uses 'E', Method 2 & 3 use 'F' or 'H'
    const finalEfKey = eqId === 'eq1' ? 'E' : (eqId === 'eq2' ? 'F' : 'H');

    state[eqId].rows.forEach(row => {
      row[finalEfKey] = defaults[row.name] !== undefined ? defaults[row.name] : 0.00;
    });
  }

  EQUATIONS.forEach(eq => {
    if (eq.type === 'modes') {
      state[eq.id] = {
        rows: eq.rows.map(r => ({...r})),
        ctx: eq.topControl ? {[eq.topControl.key]: eq.topControl.value} : {}
      };
      applyPollutantDefaults(eq.id, currentPollutant);
    } else {
      const p = {};
      eq.params.forEach(f => p[f.key] = f.value);
      state[eq.id] = {params: p};
    }
  });
 
  const root = document.getElementById('vapis-root');
  const tabsEl = document.getElementById('vapis-tabs');
  const panelsEl = document.getElementById('vapis-panels');
 
  // ---------- build pollutant selector global widget ----------
  const headerEl = document.querySelector('.vapis-header');
  const selectorWrap = el('div', {class: 'vapis-pollutant-selector-wrap'});
  selectorWrap.appendChild(el('label', {for: 'vapis-pollutant-select'}, 'Target Air Pollutant: '));
  
  const selectDropdown = el('select', {id: 'vapis-pollutant-select'});
  for (const [key, obj] of Object.entries(POLLUTANTS)) {
    selectDropdown.appendChild(el('option', {value: key}, obj.label));
  }
  
  selectDropdown.addEventListener('change', (e) => {
    currentPollutant = e.target.value;
    // Update labels and re-inject default factors
    EQUATIONS.forEach(eq => {
      if (eq.type === 'modes') {
        applyPollutantDefaults(eq.id, currentPollutant);
        rebuildModesPanel(eq);
      }
      renderAll(eq);
    });
  });
  
  selectorWrap.appendChild(selectDropdown);
  headerEl.after(selectorWrap);

  // ---------- build tabs ----------
  EQUATIONS.forEach((eq, i) => {
    const tab = el('button', {class:'vapis-tab' + (i===0?' active':''), 'data-target':eq.id, role:'tab'},
      el('span', null, eq.tabLabel),
      el('span', {class:'vapis-tab-sub'}, eq.tabSub)
    );
    tab.addEventListener('click', () => switchTab(eq.id));
    tabsEl.appendChild(tab);
  });
 
  function switchTab(id){
    tabsEl.querySelectorAll('.vapis-tab').forEach(t => t.classList.toggle('active', t.dataset.target === id));
    panelsEl.querySelectorAll('.vapis-panel').forEach(p => p.classList.toggle('active', p.id === 'vapis-panel-' + id));
  }
 
  // ---------- build panels ----------
  EQUATIONS.forEach(eq => {
    const panel = el('div', {class:'vapis-panel' + (eq === EQUATIONS[0] ? ' active' : ''), id:'vapis-panel-' + eq.id});

    const frozen = el('div', {class:'vapis-panel-frozen'});
    frozen.appendChild(el('h2', null, eq.title));
    const summary = el('div', {class:'vapis-summary', id:'vapis-summary-' + eq.id});
    frozen.appendChild(summary);
    panel.appendChild(frozen);

    const scroll = el('div', {class:'vapis-scroll'});
    if (eq.type === 'modes') {
      if (eq.topControl) {
        scroll.appendChild(buildTopControl(eq));
      }
      const modesWrap = el('div', {class:'vapis-modes'});
      eq.rows.forEach((row, idx) => modesWrap.appendChild(buildModeCard(eq, idx)));
      scroll.appendChild(modesWrap);
    } else {
      const grid = el('div', {class:'vapis-params-grid'});
      eq.params.forEach(f => grid.appendChild(buildParamCard(eq, f)));
      scroll.appendChild(grid);
    }

    const explain = el('div', {class:'vapis-explain'},
      el('h3', null, '📖 About this method'),
      ...eq.explain.map(html => el('p', {html}))
    );
    scroll.appendChild(explain);
    panel.appendChild(scroll);

    panelsEl.appendChild(panel);
    renderSummary(eq);
  });
 
  // ---------- builders ----------
  function buildTopControl(eq){
    const tc = eq.topControl;
    const s = state[eq.id];
    const wrap = el('div', {class:'vapis-topcontrol'});
    const range = el('input', {type:'range', min:tc.min, max:tc.max, step:tc.step, value:s.ctx[tc.key]});
    const num = el('input', {type:'number', min:tc.min, max:tc.max, step:tc.step, value:s.ctx[tc.key]});
    const toprow = el('div', {class:'vapis-tc-toprow'},
      el('div', {class:'vapis-tc-label'}, tc.label + ' (' + tc.unit + ')'),
      num
    );
    range.addEventListener('input', () => { num.value = range.value; s.ctx[tc.key] = parseFloat(range.value); renderAll(eq); });
    num.addEventListener('input', () => { const v = clamp(parseFloat(num.value)||0, tc.min, tc.max); range.value = v; s.ctx[tc.key] = v; renderAll(eq); });
    wrap.appendChild(toprow);
    const controls = el('div', {class:'vapis-tc-controls'}, range);
    wrap.appendChild(controls);
    const warn = el('div', {class:'vapis-warn'});
    wrap.appendChild(warn);
    wrap._warnEl = warn;
    return wrap;
  }
 
  function buildModeCard(eq, idx){
    const s = state[eq.id];
    const row = s.rows[idx];
    const card = el('div', {class:'vapis-mode-card', id:'vapis-mode-' + eq.id + '-' + idx});
    const head = el('div', {class:'vapis-mode-head'});
    head.appendChild(el('div', {class:'vapis-mode-name'}, row.name));
    const outputs = el('div', {class:'vapis-mode-outputs'});
    eq.outputs.forEach(o => {
      outputs.appendChild(el('div', {class:'vapis-out-chip', 'data-out': o.key},
        el('div', {class:'vapis-out-val'}, '—'),
        el('div', {class:'vapis-out-lab'}, o.label)
      ));
    });
    head.appendChild(outputs);
    card.appendChild(head);
 
    const fields = el('div', {class:'vapis-fields'});
    eq.fields.forEach(f => {
      const fieldWrap = el('div', {class:'vapis-field'});
      const currentVal = row[f.key];
      const range = el('input', {type:'range', min:f.min, max:f.max, step:f.step, value:currentVal});
      const num = el('input', {type:'number', min:f.min, max:f.max, step:f.step, value:currentVal});
      const head = el('div', {class:'vapis-field-head'},
        el('label', null, f.label, el('span', {class:'vapis-unit'}, f.unit)),
        num
      );
      range.addEventListener('input', () => { num.value = range.value; row[f.key] = parseFloat(range.value); renderAll(eq); });
      num.addEventListener('input', () => { const v = clamp(parseFloat(num.value)||0, f.min, f.max); range.value = v; row[f.key] = v; renderAll(eq); });
      fieldWrap.appendChild(head);
      const fr = el('div', {class:'vapis-field-row'}, range);
      fieldWrap.appendChild(fr);
      fields.appendChild(fieldWrap);
    });
    card.appendChild(fields);
    return card;
  }
 
  function buildParamCard(eq, f){
    const s = state[eq.id];
    const card = el('div', {class:'vapis-param-card'});
    const range = el('input', {type:'range', min:f.min, max:f.max, step:f.step, value:s.params[f.key]});
    const num = el('input', {type:'number', min:f.min, max:f.max, step:f.step, value:s.params[f.key]});
    const head = el('div', {class:'vapis-field-head'},
      el('label', null, f.label, el('span', {class:'vapis-unit'}, f.unit)),
      num
    );
    range.addEventListener('input', () => { num.value = range.value; s.params[f.key] = parseFloat(range.value); renderAll(eq); });
    num.addEventListener('input', () => { const v = clamp(parseFloat(num.value)||0, f.min, f.max); range.value = v; s.params[f.key] = v; renderAll(eq); });
    card.appendChild(head);
    const fr = el('div', {class:'vapis-field-row'}, range);
    card.appendChild(fr);
    return card;
  }
 
  function clamp(v, min, max){ return Math.min(max, Math.max(min, v)); }
 
  // ---------- rendering / computation ----------
  function renderAll(eq){
    if (eq.type === 'modes') {
      const s = state[eq.id];
      s.rows.forEach((row, idx) => {
        const out = eq.compute(row, s.ctx);
        const card = document.getElementById('vapis-mode-' + eq.id + '-' + idx);
        if(!card) return;
        eq.outputs.forEach(o => {
          const chip = card.querySelector('[data-out="' + o.key + '"] .vapis-out-val');
          const val = out[o.key];
          if(chip) chip.textContent = (val === null || val === undefined) ? 'N/A' : fmt(val, o.dec) + ' ' + o.unit.split('/')[0].trim();
        });
      });
      const pctField = eq.fields.find(f => f.unit === '%');
      if (eq.topControl && pctField) {
        const sum = s.rows.reduce((a, r) => a + (r[pctField.key] || 0), 0);
        const panel = document.getElementById('vapis-panel-' + eq.id);
        if (panel) {
          const warnEl = panel.querySelector('.vapis-warn');
          if (warnEl) warnEl.textContent = Math.abs(sum - 100) > 0.5 ? ('Shares sum to ' + fmt(sum,0) + '%, not 100%') : '';
        }
      }
    }
    renderSummary(eq);
  }
 
  function renderSummary(eq){
    const summary = document.getElementById('vapis-summary-' + eq.id);
    if (!summary) return;
    summary.innerHTML = '';
    
    // Dynamically tag the summary badge header with the active pollutant name
    const dynamicLabel = `${eq.totalLabel} (${currentPollutant})`;

    if (eq.type === 'modes') {
      const s = state[eq.id];
      let total = 0;
      s.rows.forEach(row => {
        const out = eq.compute(row, s.ctx);
        total += out[eq.totalKey] || 0;
      });
      summary.appendChild(el('div', {class:'vapis-summary-block'},
        el('div', {class:'vapis-total-label'}, dynamicLabel),
        el('div', {class:'vapis-total-value'}, fmt(total, 1)),
        el('div', {class:'vapis-total-unit'}, eq.totalUnit)
      ));
    } else {
      const s = state[eq.id];
      const val = eq.compute(s.params);
      summary.appendChild(el('div', {class:'vapis-summary-block'},
        el('div', {class:'vapis-total-label'}, dynamicLabel),
        el('div', {class:'vapis-total-value'}, fmt(val, 1)),
        el('div', {class:'vapis-total-unit'}, eq.totalUnit)
      ));
    }
    const resetBtn = el('button', {class:'vapis-reset-btn'}, '↺ Reset defaults');
    resetBtn.addEventListener('click', () => resetEquation(eq));
    summary.appendChild(resetBtn);
  }
 
  function resetEquation(eq){
    if (eq.type === 'modes') {
      state[eq.id].rows = eq.rows.map(r => ({...r}));
      applyPollutantDefaults(eq.id, currentPollutant);
      if (eq.topControl) state[eq.id].ctx = {[eq.topControl.key]: eq.topControl.value};
      rebuildModesPanel(eq);
    } else {
      eq.params.forEach(f => state[eq.id].params[f.key] = f.value);
      rebuildParamsPanel(eq);
    }
    renderAll(eq);
  }
 
  function rebuildModesPanel(eq){
    const panel = document.getElementById('vapis-panel-' + eq.id);
    if (!panel) return;
    const oldModes = panel.querySelector('.vapis-modes');
    const modesWrap = el('div', {class:'vapis-modes'});
    state[eq.id].rows.forEach((row, idx) => modesWrap.appendChild(buildModeCard(eq, idx)));
    if(oldModes) oldModes.replaceWith(modesWrap);
    if (eq.topControl) {
      const oldTc = panel.querySelector('.vapis-topcontrol');
      const newTc = buildTopControl(eq);
      if(oldTc) oldTc.replaceWith(newTc);
    }
  }
 
  function rebuildParamsPanel(eq){
    const panel = document.getElementById('vapis-panel-' + eq.id);
    if (!panel) return;
    const oldGrid = panel.querySelector('.vapis-params-grid');
    const grid = el('div', {class:'vapis-params-grid'});
    eq.params.forEach(f => grid.appendChild(buildParamCard(eq, f)));
    if(oldGrid) oldGrid.replaceWith(grid);
  }
 
  // initial paint
  EQUATIONS.forEach(eq => renderAll(eq));
 
})();