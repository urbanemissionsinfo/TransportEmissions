(function(){
  "use strict";

  const currentPollutant = 'PM2.5';
  let chartInstance = null;
  let currentChartVar = 'J'; // Default to Emissions (J)

  const eq = {
    id: 'eq1',
    title: 'Method 1 — Vehicle-Kilometres Travelled (VKT)',
    totalKey: 'J', totalUnit: 'tons / year', totalLabel: 'Total Emissions',
    fields: [
      {key:'C', label:'Number of Vehicles', unit:'vehicles', min:0, max:2000000, step:1000},
      {key:'D', label:'Distance Travelled', unit:'km/day', min:0, max:700, step:10},
      {key:'E', label:'Emission Factor', unit:'g/km', min:0, max:100, step:0.01},
      {key:'F', label:'Operational Days', unit:'days/yr', min:0, max:365, step:1},
      {key:'G', label:'Fuel Efficiency', unit:'km/L', min:0.5, max:60, step:0.5},
    ],
    outputs: [
      {key:'H', label:'Distance Travelled', unit:'M km/yr'},
      {key:'I', label:'Fuel Consumed', unit:'M L/yr'},
      {key:'J', label:'Emissions', unit:'tons/yr'},
    ],
    rows: [
      {name:'Cars', C:500000, D:50, F:310, G:12},
      {name:'2-Wheelers', C:1000000, D:40, F:220, G:30},
      {name:'3-Wheelers', C:50000, D:200, F:330, G:25},
      {name:'Bus', C:5000, D:500, F:330, G:3},
      {name:'Truck', C:5000, D:500, F:300, G:3},
    ],
    compute(row){
      const H = row.C * row.D * row.F / 1e6;
      const I = row.G > 0 ? H / row.G : 0;
      const J = H * row.E;
      return {H, I, J};
    },
    explain: [
      `This is the classic activity-based (bottom-up) method: for each vehicle category, emissions are built from numbers, distance, operating days, and emission factor.`,
      `<span class="vapis-formula">Emissions = Vehicles × Distance/day × Operating days × Emission Factor</span>`
    ]
  };

  const state = {
    rows: eq.rows.map(r => ({...r}))
  };

  const CHART_COLORS = ['#164D12', '#b5750f', '#2b7a78', '#8a3c3c', '#5c4a72'];

  function applyDefaults(polKey) {
    const defaults = POLLUTANTS[polKey].defaults;
    state.rows.forEach(row => {
      row.E = defaults[row.name] !== undefined ? defaults[row.name] : 0.00;
    });
  }
  applyDefaults(currentPollutant);

  const panelsEl = document.getElementById('vapis-panels');

  function buildPanel() {
    const panel = el('div', {class: 'vapis-panel active', id: 'vapis-panel-' + eq.id});
    
    const frozen = el('div', {class: 'vapis-panel-frozen'});
    // frozen.appendChild(el('h2', null, eq.title));
    panel.appendChild(frozen);

    const scroll = el('div', {class: 'vapis-scroll'});
    const splitContainer = el('div', {class: 'vapis-split'});
    
    // LEFT SIDE: Table & Explanations
    const leftSide = el('div', {class: 'vapis-left'});
    leftSide.appendChild(buildTable());
    
    const explain = el('div', {class: 'vapis-explain'},
      el('h3', null, '📖 About this method'),
      ...eq.explain.map(html => el('p', {html}))
    );
    leftSide.appendChild(explain);
    splitContainer.appendChild(leftSide);

    // RIGHT SIDE: Chart Selector + Chart + Summary Block
    const rightSide = el('div', {class: 'vapis-right'});

    const selectLabel = el('label', {style: 'font-size: 12px; font-weight: 600; color: var(--muted); margin-bottom: 4px;'}, '');
    rightSide.appendChild(selectLabel);
    
    const chartSelect = el('select', {class: 'vapis-chart-selector'});
    
    // Restricted chart options: Number of Vehicles (C), Distance Travelled (H), Emissions (J)
    const allowedChartVars = [
      {key: 'C', label: 'Number of Vehicles'},
      {key: 'H', label: 'Distance Travelled'},
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
      const nameInput = el('input', {
        type: 'text',
        class: 'vapis-name-input',
        value: row.name,
        style: 'width:100%; border:none; background:transparent; font:inherit; font-weight:600; color:inherit; padding:2px 0;'
      });
      nameInput.addEventListener('input', () => {
        row.name = nameInput.value;
        renderAll();
      });
      nameTd.appendChild(nameInput);
      tr.appendChild(nameTd);
      
      eq.fields.forEach(f => {
        const td = el('td');
        const wrap = el('div', {class: 'vapis-cell-wrap'});
        
        const num = el('input', {type: 'number', min: f.min, max: f.max, step: f.step, value: row[f.key]});
        const range = el('input', {type: 'range', min: f.min, max: f.max, step: f.step, value: row[f.key]});
        
        num.addEventListener('input', () => { 
          const val = clamp(parseFloat(num.value)||0, f.min, f.max);
          range.value = val;
          row[f.key] = val; 
          renderAll(); 
        });
        
        range.addEventListener('input', () => { 
          num.value = range.value;
          row[f.key] = parseFloat(range.value); 
          renderAll(); 
        });

        wrap.appendChild(num);
        wrap.appendChild(range);
        td.appendChild(wrap);
        tr.appendChild(td);
      });

      eq.outputs.forEach(o => {
        tr.appendChild(el('td', {class: 'vapis-output-cell', 'data-out': o.key}, '—'));
      });

      const delTd = el('td',{class: 'vapis-delete-cell'});
      const delBtn = el('button', {
        class: 'vapis-row-delete',
        title: 'Remove category'
      }, '✕');
      if (state.rows.length <= 1) {
        delBtn.disabled = true;
      }
      delBtn.addEventListener('click', () => removeRow(idx));
      delTd.appendChild(delBtn);
      tr.appendChild(delTd);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    const tfoot = el('tfoot');
    const footRow = el('tr');
    const totalCols = 1 + eq.fields.length + eq.outputs.length + 1;
    const footTd = el('td', {colspan: String(totalCols), style: 'padding-top:10px;'});
    const addBtn = el('button', {class: 'vapis-add-row-btn'}, '+ Add Vehicle Category');
    addBtn.addEventListener('click', addRow);
    footTd.appendChild(addBtn);
    footRow.appendChild(footTd);
    tfoot.appendChild(footRow);
    table.appendChild(tfoot);

    return table;
  }

  function addRow() {
    const defaults = POLLUTANTS[currentPollutant] && POLLUTANTS[currentPollutant].defaults;
    const name = 'New Category';
    const newRow = { name, C: 0, D: 500, F: 300, G: 10 };
    newRow.E = (defaults && defaults[name] !== undefined) ? defaults[name] : 0;
    state.rows.push(newRow);
    rebuildPanel();
    renderAll();
  }

  function removeRow(idx) {
    if (state.rows.length <= 1) return;
    state.rows.splice(idx, 1);
    rebuildPanel();
    renderAll();
  }

  function initChart() {
    chartInstance = new Chart(document.getElementById('chart-canvas').getContext('2d'), {
      type: 'doughnut',
      data: { 
        labels: [], 
        datasets: [{ data: [], backgroundColor: CHART_COLORS, borderWidth: 2, borderColor: '#fff' }] 
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '35%',
        plugins: {
          legend: { 
            position: 'right', 
            labels: { 
              padding: 12, 
              boxWidth: 12, 
              font: { size: 17, family: 'Inter', weight: '500' } 
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
      const out = eq.compute(row);
      const tr = document.getElementById('vapis-row-' + idx);
      
      if(tr) {
        eq.outputs.forEach(o => {
          const cell = tr.querySelector('[data-out="' + o.key + '"]');
          const val = out[o.key];
          if(cell) cell.textContent = (val === null || val === undefined) ? 'N/A' : Math.ceil(val).toLocaleString('en-IN');
        });
      }

      labels.push(row.name);
      
      // Extract data based on user selection (C for Number of Vehicles, H for Distance Travelled, J for Emissions)
      if (currentChartVar === 'C') {
        chartData.push(row.C || 0);
      } else if (currentChartVar === 'H') {
        chartData.push(out.H || 0);
      } else {
        chartData.push(out.J || 0);
      }

      totalEmissions += (out.J || 0);
    });

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