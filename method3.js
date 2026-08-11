(function(){
  "use strict";

  const currentPollutant = 'PM2.5';
  let chartInstance = null;
  let currentChartVar = 'J'; // Default to Emissions (J)

  const eq = {
    id: 'eq3',
    title: 'Method 3 — Passenger Trip-Based',
    totalKey: 'J', totalUnit: 'tons / year', totalLabel: 'Total Emissions',
    topControl: {key:'totalTrips', label:'City-wide Passenger Trips', unit:'million trips / year', min:0, max:30000, step:100, value:7000},
    fields: [
      {key:'C', label:'Share of Trips', unit:'%', min:0, max:100, step:1},
      {key:'E', label:'Avg. Trip Length', unit:'km/trip', min:0, max:50, step:0.5},
      {key:'F', label:'Occupancy', unit:'persons/vehicle', min:0.5, max:150, step:0.5},
      {key:'G', label:'Fuel Efficiency', unit:'km/L', min:0, max:60, step:0.5},
      {key:'H', label:'Emission Factor', unit:'g/km', min:0, max:100, step:0.01},
    ],
    outputs: [
      {key:'D', label:'Trips per Mode', unit:'M trips/yr'},
      {key:'I', label:'Distance Travelled', unit:'M km/yr'},
      {key:'J', label:'Emissions', unit:'tons/yr'},
      {key:'K', label:'Fuel Consumed', unit:'M L/yr'},
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
      `This method works from travel-demand data: the share of trips made by each mode, how far a typical trip is, and how many people share each vehicle. Vehicle-distance is derived by dividing passenger-distance by occupancy[cite: 2].`,
      `<span class="vapis-formula">Distance = (Trips × Trip Length) / Occupancy; Emissions = Distance × EF</span>`
    ]
  };

  const state = {
    rows: eq.rows.map(r => ({...r})),
    ctx: {[eq.topControl.key]: eq.topControl.value}
  };

  const CHART_COLORS = ['#164D12', '#b5750f', '#2b7a78', '#8a3c3c', '#5c4a72', '#2c7a26', '#d9a05b'];

  function applyDefaults(polKey) {
    const defaults = POLLUTANTS[polKey].defaults;
    state.rows.forEach(row => {
      row.H = defaults[row.name] !== undefined ? defaults[row.name] : 0.00;
    });
  }
  applyDefaults(currentPollutant);

  const panelsEl = document.getElementById('vapis-panels');

  function buildTopControl(){
    const tc = eq.topControl;
    const wrap = el('div', {class:'vapis-topcontrol'});
    const toprow = el('div', {class:'vapis-tc-toprow'},
      el('div', {class:'vapis-tc-label'}, tc.label + ' (' + tc.unit + ')')
    );
    wrap.appendChild(toprow);

    const cellWrap = el('div', {class:'vapis-cell-wrap', style:'max-width:100%;'});
    const num = el('input', {type:'number', min:tc.min, max:tc.max, step:tc.step, value:state.ctx[tc.key]});
    const range = el('input', {type:'range', min:tc.min, max:tc.max, step:tc.step, value:state.ctx[tc.key]});

    num.addEventListener('input', () => { 
      const val = clamp(parseFloat(num.value)||0, tc.min, tc.max);
      range.value = val;
      state.ctx[tc.key] = val; 
      renderAll(); 
    });
    range.addEventListener('input', () => { 
      num.value = range.value;
      state.ctx[tc.key] = parseFloat(range.value); 
      renderAll(); 
    });

    cellWrap.appendChild(num);
    cellWrap.appendChild(range);
    wrap.appendChild(cellWrap);
    wrap.appendChild(el('div', {class:'vapis-warn', style:'font-size:12px; color:#a13b2a; font-weight:600; margin-top:6px;'}));
    return wrap;
  }

  function buildPanel() {
    const panel = el('div', {class: 'vapis-panel active', id: 'vapis-panel-' + eq.id});
    
    const frozen = el('div', {class: 'vapis-panel-frozen'});
    frozen.appendChild(el('h2', null, eq.title));
    panel.appendChild(frozen);

    const scroll = el('div', {class: 'vapis-scroll'});
    const splitContainer = el('div', {class: 'vapis-split'});
    
    const leftSide = el('div', {class: 'vapis-left'});
    leftSide.appendChild(buildTopControl());
    leftSide.appendChild(buildTable());
    
    const explain = el('div', {class: 'vapis-explain'},
      el('h3', null, '📖 About this method'),
      ...eq.explain.map(html => el('p', {html}))
    );
    leftSide.appendChild(explain);
    splitContainer.appendChild(leftSide);

    const rightSide = el('div', {class: 'vapis-right'});

    const selectLabel = el('label', {style: 'font-size: 12px; font-weight: 600; color: var(--muted); margin-bottom: 4px;'}, 'Chart Data Source:');
    rightSide.appendChild(selectLabel);
    
    const chartSelect = el('select', {class: 'vapis-chart-selector'});
    const allowedChartVars = [
      {key:'C', label:'Share of Trips'},
      {key:'D', label:'Trips per Mode'},
      {key: 'I', label: 'Distance Travelled'},
      {key: 'J', label: 'Emissions'}
    ];
    
    allowedChartVars.forEach(opt => {
      chartSelect.appendChild(el('option', {value: opt.key}, opt.label));
    });
    
    chartSelect.value = currentChartVar;
    chartSelect.addEventListener('change', (e) => {
      currentChartVar = e.target.value;
      renderAll();
    });
    rightSide.appendChild(chartSelect);

    const chartContainer = el('div', {class: 'vapis-chart-container'});
    const canvas = el('canvas', {id: 'chart-canvas'});
    chartContainer.appendChild(canvas);
    rightSide.appendChild(chartContainer);
    
    const summary = el('div', {class: 'vapis-summary', id: 'vapis-summary', style: 'margin-top: 16px; padding: 12px 16px;'});
    rightSide.appendChild(summary);

    splitContainer.appendChild(rightSide);
    scroll.appendChild(splitContainer);
    panel.appendChild(scroll);
    panelsEl.appendChild(panel);

    initChart();
  }

  function buildTable() {
    const table = el('table', {class: 'vapis-table'});
    const thead = el('thead');
    const headerRow = el('tr');
    headerRow.appendChild(el('th', null, 'Category'));
    eq.fields.forEach(f => headerRow.appendChild(el('th', null, f.label, el('br'), el('span', {style: 'font-size:11px; font-weight:normal; opacity:0.8;'}, f.unit))));
    eq.outputs.forEach(o => headerRow.appendChild(el('th', null, o.label, el('br'), el('span', {style: 'font-size:11px; font-weight:normal; opacity:0.8;'}, o.unit))));
    headerRow.appendChild(el('th', {style: 'width:32px;'}, ''));
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = el('tbody', {id: 'vapis-tbody'});
    state.rows.forEach((row, idx) => {
      const tr = el('tr', {id: 'vapis-row-' + idx});
      const nameTd = el('td');
      const nameInput = el('input', {type: 'text', class: 'vapis-name-input', value: row.name, style: 'width:100%; border:none; background:transparent; font:inherit; font-weight:600; color:inherit; padding:2px 0;'});
      nameInput.addEventListener('input', () => { row.name = nameInput.value; renderAll(); });
      nameTd.appendChild(nameInput);
      tr.appendChild(nameTd);
      
      eq.fields.forEach(f => {
        const td = el('td');
        const wrap = el('div', {class: 'vapis-cell-wrap'});
        const num = el('input', {type: 'number', min: f.min, max: f.max, step: f.step, value: row[f.key]});
        const range = el('input', {type: 'range', min: f.min, max: f.max, step: f.step, value: row[f.key]});
        num.addEventListener('input', () => { const val = clamp(parseFloat(num.value)||0, f.min, f.max); range.value = val; row[f.key] = val; renderAll(); });
        range.addEventListener('input', () => { num.value = range.value; row[f.key] = parseFloat(range.value); renderAll(); });
        wrap.appendChild(num); wrap.appendChild(range); td.appendChild(wrap); tr.appendChild(td);
      });

      eq.outputs.forEach(o => { tr.appendChild(el('td', {class: 'vapis-output-cell', 'data-out': o.key}, '—')); });

      const delTd = el('td');
      const delBtn = el('button', {class: 'vapis-row-delete', title: 'Remove category', style: 'border:none; background:transparent; color:var(--muted, #888); cursor:pointer; font-size:16px; line-height:1;'}, '✕');
      if (state.rows.length <= 1) { delBtn.disabled = true; delBtn.style.opacity = '0.3'; delBtn.style.cursor = 'not-allowed'; }
      delBtn.addEventListener('click', () => removeRow(idx));
      delTd.appendChild(delBtn); tr.appendChild(delTd);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    const tfoot = el('tfoot');
    const footRow = el('tr');
    const footTd = el('td', {colspan: String(1 + eq.fields.length + eq.outputs.length + 1), style: 'padding-top:10px;'});
    const addBtn = el('button', {class: 'vapis-add-row-btn'}, '+ Add Vehicle Category');
    addBtn.addEventListener('click', addRow);
    footTd.appendChild(addBtn); footRow.appendChild(footTd); tfoot.appendChild(footRow); table.appendChild(tfoot);
    return table;
  }

  function addRow() {
    const defaults = POLLUTANTS[currentPollutant] && POLLUTANTS[currentPollutant].defaults;
    const name = 'New Category';
    const newRow = { name, C: 0, E: 5, F: 1.5, G: 10 };
    newRow.H = (defaults && defaults[name] !== undefined) ? defaults[name] : 0;
    state.rows.push(newRow); rebuildPanel(); renderAll();
  }

  function removeRow(idx) {
    if (state.rows.length <= 1) return;
    state.rows.splice(idx, 1); rebuildPanel(); renderAll();
  }

  function initChart() {
    chartInstance = new Chart(document.getElementById('chart-canvas').getContext('2d'), {
      type: 'doughnut',
      data: { labels: [], datasets: [{ data: [], backgroundColor: CHART_COLORS, borderWidth: 2, borderColor: '#fff' }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '35%',
        plugins: {
          legend: { position: 'right', labels: { padding: 12, boxWidth: 12, font: { size: 17, family: 'Inter', weight: '500' } } },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.label + ': ' + Math.ceil(context.parsed).toLocaleString('en-IN');
              }
            }
          }
        }
      }
    });
  }

  function renderAll() {
    const labels = [];
    const chartData = [];
    let totalEmissions = 0;

    state.rows.forEach((row, idx) => {
      const out = eq.compute(row, state.ctx);
      const tr = document.getElementById('vapis-row-' + idx);
      if(tr) {
        eq.outputs.forEach(o => {
          const cell = tr.querySelector('[data-out="' + o.key + '"]');
          const val = out[o.key];
          if(cell) cell.textContent = (val === null || val === undefined) ? 'N/A' : Math.ceil(val).toLocaleString('en-IN');
        });
      }
      labels.push(row.name);
      if (currentChartVar === 'C') chartData.push(row.C || 0);
      else if (currentChartVar === 'D') chartData.push(out.D || 0);
      else if (currentChartVar === 'I') chartData.push(out.I || 0);
      else chartData.push(out.J || 0);
      totalEmissions += (out[eq.totalKey] || 0);
    });

    const sum = state.rows.reduce((a, r) => a + (r.C || 0), 0);
    const panel = document.getElementById('vapis-panel-' + eq.id);
    if (panel) {
      const warnEl = panel.querySelector('.vapis-warn');
      if (warnEl) warnEl.textContent = Math.abs(sum - 100) > 0.5 ? ('Trip shares sum to ' + Math.round(sum) + '%, not 100%') : '';
    }

    const summary = document.getElementById('vapis-summary');
    if (summary) {
      summary.innerHTML = '';
      summary.appendChild(el('div', {class:'vapis-summary-block'},
        el('div', {class:'vapis-total-label'}, `${eq.totalLabel}`),
        el('div', {class:'vapis-total-value', style:'font-size: clamp(24px, 4vw, 34px);'}, Math.ceil(totalEmissions).toLocaleString('en-IN')),
        el('div', {class:'vapis-total-unit'}, eq.totalUnit)
      ));
      const resetBtn = el('button', {class:'vapis-reset-btn'}, '↺ Reset');
      resetBtn.addEventListener('click', () => {
        state.rows = eq.rows.map(r => ({...r}));
        state.ctx = {[eq.topControl.key]: eq.topControl.value};
        applyDefaults(currentPollutant);
        rebuildPanel();
        renderAll();
      });
      summary.appendChild(resetBtn);
    }

    if (chartInstance) {
      chartInstance.data.labels = labels;
      chartInstance.data.datasets[0].data = chartData;
      chartInstance.update();
    }
  }

  function rebuildPanel() {
    if (chartInstance) chartInstance.destroy();
    panelsEl.innerHTML = '';
    buildPanel();
  }

  buildPanel();
  renderAll();
})();