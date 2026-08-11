(function(){
  "use strict";

  let currentPollutant = 'PM2.5';
  let chartInstance = null;

  const eq = {
    id: 'eq4',
    title: 'Method 4 — Concentration-Based (Box Model)',
    totalUnit: 'tons / period', 
    totalLabel: 'Estimated Emissions',
    params: [
      {key:'C', label:'Average Concentration', unit:'mg/m³', min:0, max:300, step:1, value:80},
      {key:'V', label:'Vehicular Contribution', unit:'%', min:0, max:100, step:1, value:25},
      {key:'X', label:'Domain Cross-Section', unit:'m', min:1000, max:50000, step:500, value:10000},
      {key:'L', label:'Domain Length', unit:'m', min:0.1, max:10, step:0.1, value:1},
      {key:'Hh', label:'Avg. Mixing Height', unit:'m', min:50, max:2000, step:10, value:500},
      {key:'U', label:'Average Wind Speed', unit:'m/s', min:0.1, max:10, step:0.1, value:1},
      {key:'T', label:'Averaging Period', unit:'days', min:1, max:365, step:1, value:365},
    ],
    compute(p){
      return p.C * (p.V/100) * p.X * p.L * p.Hh * p.U * 1e-12 * p.T * 86400;
    },
    explain: [
      `This is a reverse "box model": rather than building emissions up from traffic activity, it works backward from a measured ambient concentration. The airshed is treated as a box of a given cross-section and mixing height, through which wind flushes air at a steady speed.`,
        `<span class="vapis-formula">Emissions = Concentration × Vehicular Share × Cross-section × Length × Mixing Height × Wind Speed × Averaging Period</span>`,
        `It's most useful as a sanity check on the other three methods — if a bottom-up inventory and this top-down estimate disagree by an order of magnitude, one of your input assumptions needs a second look.`
    ]
  };

  const state = {
    params: {}
  };
  eq.params.forEach(f => state.params[f.key] = f.value);

  // Setup Pollutant Selector Header
  const headerEl = document.getElementById('vapis-header');
  headerEl.after(createPollutantSelector((newPol) => {
    currentPollutant = newPol;
    renderAll();
  }));

  const panelsEl = document.getElementById('vapis-panels');

  function buildPanel() {
    const panel = el('div', {class: 'vapis-panel active', id: 'vapis-panel-' + eq.id});
    
    const frozen = el('div', {class: 'vapis-panel-frozen'});
    frozen.appendChild(el('h2', null, eq.title));
    const summary = el('div', {class: 'vapis-summary', id: 'vapis-summary'});
    frozen.appendChild(summary);
    panel.appendChild(frozen);

    const scroll = el('div', {class: 'vapis-scroll'});
    const splitContainer = el('div', {class: 'vapis-split'});
    
    // LEFT SIDE: Parameter Cards Grid
    const leftSide = el('div', {class: 'vapis-left'});
    const grid = el('div', {class: 'vapis-params-grid'});
    eq.params.forEach(f => grid.appendChild(buildParamCard(f)));
    leftSide.appendChild(grid);

    const explain = el('div', {class: 'vapis-explain'},
      el('h3', null, '📖 About this method'),
      ...eq.explain.map(html => el('p', {html}))
    );
    leftSide.appendChild(explain);
    splitContainer.appendChild(leftSide);

    // RIGHT SIDE: Visual Summary / Info Card (Since Box Model doesn't split by vehicle modes)
    const rightSide = el('div', {class: 'vapis-right'});
    rightSide.appendChild(el('div', {style: 'font-weight: 700; color: var(--green); margin-bottom: 10px; font-size: 15px;'}, 'Airshed Dynamics'));
    rightSide.appendChild(el('p', {style: 'font-size: 13px; color: var(--muted); line-height: 1.5;'}, 'Unlike bottom-up inventory methods, Method 4 treats the entire regional airshed as a single control volume governed by meteorological dilution parameters and pollutant mass-balance principles[cite: 2].'));
    
    const metricBox = el('div', {style: 'margin-top: 20px; background: var(--green-pale); padding: 14px; border-radius: 8px; border: 1px solid var(--border); text-align: center;'});
    metricBox.appendChild(el('div', {style: 'font-size: 11px; text-transform: uppercase; color: var(--green); font-weight: 600;'}, 'Model Type'));
    metricBox.appendChild(el('div', {style: 'font-size: 14px; font-weight: 700; color: var(--ink); margin-top: 4px;'}, 'Top-Down Eulerian Box'));
    rightSide.appendChild(metricBox);

    splitContainer.appendChild(rightSide);
    scroll.appendChild(splitContainer);
    panel.appendChild(scroll);
    panelsEl.appendChild(panel);
  }

  function buildParamCard(f){
    const card = el('div', {class:'vapis-param-card'});
    const currentVal = state.params[f.key];
    
    const head = el('div', {class:'vapis-field-head'},
      el('label', null, f.label),
      el('span', {class:'vapis-unit'}, f.unit)
    );
    card.appendChild(head);

    const cellWrap = el('div', {class:'vapis-cell-wrap', style:'margin-top: 8px;'});
    const num = el('input', {type:'number', min:f.min, max:f.max, step:f.step, value:currentVal});
    const range = el('input', {type:'range', min:f.min, max:f.max, step:f.step, value:currentVal});

    num.addEventListener('input', () => { 
      const val = clamp(parseFloat(num.value)||0, f.min, f.max);
      range.value = val;
      state.params[f.key] = val; 
      renderAll(); 
    });
    range.addEventListener('input', () => { 
      num.value = range.value;
      state.params[f.key] = parseFloat(range.value); 
      renderAll(); 
    });

    cellWrap.appendChild(num);
    cellWrap.appendChild(range);
    card.appendChild(cellWrap);
    return card;
  }

  function renderAll() {
    renderSummary();
  }

  function renderSummary() {
    const summary = document.getElementById('vapis-summary');
    if (!summary) return;
    summary.innerHTML = '';
    const dynamicLabel = `${eq.totalLabel} (${currentPollutant})`;

    const val = eq.compute(state.params);

    summary.appendChild(el('div', {class:'vapis-summary-block'},
      el('div', {class:'vapis-total-label'}, dynamicLabel),
      el('div', {class:'vapis-total-value'}, Math.ceil(val).toLocaleString('en-IN')),
      el('div', {class:'vapis-total-unit'}, eq.totalUnit)
    ));

    const resetBtn = el('button', {class:'vapis-reset-btn'}, '↺ Reset defaults');
    resetBtn.addEventListener('click', () => {
      eq.params.forEach(f => state.params[f.key] = f.value);
      rebuildPanel();
      renderAll();
    });
    summary.appendChild(resetBtn);
  }

  function rebuildPanel() {
    panelsEl.innerHTML = '';
    buildPanel();
  }

  buildPanel();
  renderAll();
})();