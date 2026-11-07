(() => {
function dogSVG(){
  return `
<svg class="pet" viewBox="0 0 200 200" data-act="idle" aria-hidden="true">
  <ellipse cx="100" cy="186" rx="54" ry="11" fill="rgba(40,24,60,.22)"/>
  <g class="body">
    <path class="tail" d="M148 140 q34 -6 30 -40" fill="none" stroke="#f6e3c6" stroke-width="15" stroke-linecap="round"/>
    <ellipse cx="100" cy="140" rx="52" ry="40" fill="#fdf3e2"/>
    <ellipse cx="84" cy="150" rx="32" ry="26" fill="#fffaf0"/>
    <g fill="#f3dfc2">
      <ellipse cx="70" cy="176" rx="14" ry="11"/><ellipse cx="130" cy="176" rx="14" ry="11"/>
      <ellipse cx="83" cy="180" rx="12" ry="9" fill="#eed9b8"/><ellipse cx="117" cy="180" rx="12" ry="9" fill="#eed9b8"/>
    </g>
    <g class="head">
      <ellipse class="ear" cx="64" cy="98" rx="17" ry="31" fill="#eed7b4" transform="rotate(-7 64 98)"/>
      <ellipse class="ear" cx="136" cy="98" rx="17" ry="31" fill="#eed7b4" transform="rotate(7 136 98)"/>
      <circle cx="100" cy="74" r="44" fill="#fffaf0"/>
      <ellipse cx="100" cy="92" rx="25" ry="18" fill="#fffdf7"/>
      <circle cx="100" cy="86" r="7.5" fill="#4a3a33"/>
      <path d="M100 94 v7 M100 101 q-9 7 -16 0 M100 101 q9 7 16 0" stroke="#7b6152" stroke-width="3" fill="none" stroke-linecap="round"/>
      <g class="eyes">
        <ellipse class="eye" cx="82" cy="66" rx="6.4" ry="7" fill="#3a2f2a"/>
        <ellipse class="eye" cx="118" cy="66" rx="6.4" ry="7" fill="#3a2f2a"/>
        <circle cx="84.4" cy="63.6" r="2.2" fill="#fff"/>
        <circle cx="120.4" cy="63.6" r="2.2" fill="#fff"/>
      </g>
      <g class="lids">
        <ellipse class="lid" cx="82" cy="66" rx="7" ry="7" fill="#fffaf0"/>
        <ellipse class="lid" cx="118" cy="66" rx="7" ry="7" fill="#fffaf0"/>
      </g>
      <ellipse cx="56" cy="90" rx="10" ry="6" fill="#f8bfae" opacity=".5"/>
      <ellipse cx="144" cy="90" rx="10" ry="6" fill="#f8bfae" opacity=".5"/>
    </g>
  </g>
</svg>`;
}
function defaultPet(){
  return '<img class="pet pet-image" data-act="idle" src="/assets/latest/companion-default.png" alt="默认旅伴小狗">';
}
function childSVG(kind){
  const ocean = kind==="ocean";
  return `
<svg viewBox="0 0 200 300" width="100%" height="100%" aria-hidden="true">
  <ellipse cx="100" cy="290" rx="62" ry="11" fill="rgba(40,24,60,.22)"/>
  <path d="M64 288 q-6 -46 20 -52 q24 -6 24 24 q0 22 -10 28z" fill="#5d5570"/>
  <path d="M136 288 q6 -46 -20 -52 q-24 -6 -24 24 q0 22 10 28z" fill="#514a66"/>
  <path d="M56 270 q-6 -76 44 -86 q50 10 44 86z" fill="${ocean?"#f6e2c8":"#f0dcc4"}"/>
  <path d="M74 202 q26 -10 52 0" stroke="#e2caad" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M62 216 q-16 26 -9 48" stroke="${ocean?"#f6e2c8":"#f0dcc4"}" stroke-width="21" stroke-linecap="round" fill="none"/>
  <path d="M138 216 q16 26 9 48" stroke="${ocean?"#f6e2c8":"#f0dcc4"}" stroke-width="21" stroke-linecap="round" fill="none"/>
  <rect x="92" y="176" width="16" height="18" rx="8" fill="#e8c6a6"/>
  <circle cx="100" cy="150" r="42" fill="#f6d0ac"/>
  <path d="M57 152 q2 -60 43 -60 q41 0 43 60 q-14 -22 -43 -22 q-29 0 -43 22z" fill="#4a3b52"/>
  <path d="M58 146 q-9 20 1 33 q7 -18 5 -33z" fill="#4a3b52"/>
  <path d="M142 146 q9 20 -1 33 q-7 -18 -5 -33z" fill="#4a3b52"/>
</svg>`;
}

/* ----------------------------------------------------------------------------
   6. 动作播放（含队列：同一时刻一个主动作）
   ---------------------------------------------------------------------------- */

window.HXCharacters = {dogSVG, defaultPet, childSVG};
})();
