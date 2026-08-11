"use strict";

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

function clamp(v, min, max){ return Math.min(max, Math.max(min, v)); }

const POLLUTANTS = {
  'PM2.5': { label: 'PM₂.₅ (Particulate Matter ≤ 2.5 µm)', unit: 'tons/yr', defaults: { 'Cars': 0.08, '2-Wheelers': 0.03, '3-Wheelers': 0.04, 'Bus': 0.3, 'Truck': 0.4, 'Walking': 0, 'Bicycle': 0 } },
  'PM10':  { label: 'PM₁₀ (Particulate Matter ≤ 10 µm)',  unit: 'tons/yr', defaults: { 'Cars': 0.08, '2-Wheelers': 0.03, '3-Wheelers': 0.04, 'Bus': 0.3, 'Truck': 0.4, 'Walking': 0, 'Bicycle': 0 } },
  'NOx':   { label: 'NOₓ (Nitrogen Oxides)',               unit: 'tons/yr', defaults: { 'Cars': 0.08, '2-Wheelers': 0.03, '3-Wheelers': 0.04, 'Bus': 0.3, 'Truck': 0.4, 'Walking': 0, 'Bicycle': 0 } },
  'CO':    { label: 'CO (Carbon Monoxide)',              unit: 'tons/yr', defaults: { 'Cars': 0.08, '2-Wheelers': 0.03, '3-Wheelers': 0.04, 'Bus': 0.3, 'Truck': 0.4, 'Walking': 0, 'Bicycle': 0 } },
  'SO2':   { label: 'SO₂ (Sulphur Dioxide)',             unit: 'tons/yr', defaults: { 'Cars': 0.08, '2-Wheelers': 0.03, '3-Wheelers': 0.04, 'Bus': 0.3, 'Truck': 0.4, 'Walking': 0, 'Bicycle': 0 } },
  'VOC':   { label: 'VOC/NMHC (Ozone Precursors)',       unit: 'tons/yr', defaults: { 'Cars': 0.08, '2-Wheelers': 0.03, '3-Wheelers': 0.04, 'Bus': 0.3, 'Truck': 0.4, 'Walking': 0, 'Bicycle': 0 } }
};

function createPollutantSelector(onChangeCallback) {
  const selectorWrap = el('div', {class: 'vapis-pollutant-selector-wrap'});
  selectorWrap.appendChild(el('label', {for: 'vapis-pollutant-select'}, 'Target Air Pollutant: '));
  
  const selectDropdown = el('select', {id: 'vapis-pollutant-select'});
  for (const [key, obj] of Object.entries(POLLUTANTS)) {
    selectDropdown.appendChild(el('option', {value: key}, obj.label));
  }
  
  selectDropdown.addEventListener('change', (e) => {
    onChangeCallback(e.target.value);
  });
  
  selectorWrap.appendChild(selectDropdown);
  return selectorWrap;
}

function createNavigation(activePage) {
  const pages = [
    {file: 'method1.html', label: 'Method 1', sub: 'Vehicle-km travelled'},
    {file: 'method2.html', label: 'Method 2', sub: 'Fuel-based'},
    {file: 'method3.html', label: 'Method 3', sub: 'Passenger trips'},
    {file: 'method4.html', label: 'Method 4', sub: 'Concentration / box model'}
  ];
  
  const navEl = el('div', {class: 'vapis-tabs', role: 'tablist'});
  pages.forEach(p => {
    const isActive = window.location.pathname.endsWith(p.file);
    const tab = el('a', {class: 'vapis-tab' + (isActive ? ' active' : ''), href: p.file, style: 'text-decoration:none; display:inline-block; text-align:center;'},
      el('span', null, p.label),
      el('span', {class: 'vapis-tab-sub'}, p.sub)
    );
    navEl.appendChild(tab);
  });
  return navEl;
}