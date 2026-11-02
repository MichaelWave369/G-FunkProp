/* G-BIOS operator interface. Fully offline. Audio never reaches an actuator or device. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const core = globalThis.GBIOS;
  if (!core) throw new Error('G-BIOS physics model failed to load');
  const engineCanvas = $('engineCanvas');
  const waveCanvas = $('waveCanvas');
  const engineCtx = engineCanvas.getContext('2d');
  const waveCtx = waveCanvas.getContext('2d');
  let flight = core.newState();
  let running = false;
  let source = 'tone';
  let fictional = false;
  let ac = null;
  let lowpass = null;
  let analyser = null;
  let monitor = null;
  let toneNodes = [];
  let fileElement = null;
  let fileNode = null;
  let fileURL = null;
  let inputLevel = 0;
  let detectedHz = 0;
  let previousTime = 0;
  let currentCycle = core.computeCycle({active:false, powerW:25000, bassLevel:0, sensitivity:1, frequencyHz:42, tempC:24, propellantKg:100});
  let lastSweep = null;
  let samples = new Float32Array(1024);
  let spect = new Uint8Array(1024);
  const stars = Array.from({length:70}, (_, i) => ({x: pseudo(i * 19 + 7), y:pseudo(i * 37 + 9),r:0.4+pseudo(i*13+3)*1.1}));

  function pseudo(seed) { const x = Math.sin(seed * 87.231) * 9743.12; return x - Math.floor(x); }
  function displayMessage(message) { $('operatorMessage').textContent = message; }
  function getFreq() { return Number($('freqSlider').value); }
  function getPower() { return Number($('powerSlider').value)*1000; }
  function getSensitivity() { return Number($('sensitivitySlider').value)/100; }

  function selectMode(asFiction) {
    fictional = asFiction;
    $('engineeringBtn').classList.toggle('selected', !fictional);
    $('fictionBtn').classList.toggle('selected', fictional);
    $('engineeringBtn').setAttribute('aria-pressed', String(!fictional));
    $('fictionBtn').setAttribute('aria-pressed', String(fictional));
    $('modeNote').textContent = fictional ? 'Visualization only. Warp fields are not known propulsion technology.' : 'Real calculations. No claim of a real spacecraft engine.';
    $('phase3Name').textContent = fictional ? 'METRIC CAP (LORE)' : 'ELECTRIC THRUSTER';
    $('phase3Note').textContent = fictional ? 'Fictional spacetime field' : 'Simulated reaction mass';
    $('extraMetricLabel').textContent = fictional ? 'WARP INDEX (FICTION)' : 'JET KINETIC POWER';
    $('scienceCopy').innerHTML = fictional
      ? '<b>Science fiction mode:</b> The glowing metric cap, warp intensity and gravity-well animation are narrative devices, not physically calculated gravitational effects. Real electric-thruster telemetry remains bounded by the same energy accounting.'
      : '<b>Real physics:</b> Audio controls the duty cycle of an idealized electric thruster. Electrical power creates exhaust kinetic energy. Piezo recovery is a lossy subset of actuator power, never free energy.';
    renderReadouts();
  }

  function selectSource(newSource) {
    if (running) stopPlayback('Audio source changed. Engage the groove to restart.');
    source = newSource;
    $('toneSourceBtn').classList.toggle('active', source === 'tone');
    $('fileSourceBtn').classList.toggle('active', source === 'file');
    $('toneControls').classList.toggle('hidden', source === 'file');
    $('filePickerBox').classList.toggle('hidden', source !== 'file');
    $('sourceLabel').textContent = source === 'tone' ? 'G-FUNK OSCILLATOR' : 'LOCAL AUDIO TRACK';
    displayMessage(source === 'file' ? 'Choose a track from your device, then engage. No upload occurs.' : 'Synth ready. Choose a sub-bass frequency and engage.');
  }

  function setupAudio() {
    if (ac) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('Web Audio API is not supported in this browser.');
    ac = new AudioContextClass();
    lowpass = ac.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 88;
    lowpass.Q.value = 0.7;
    analyser = ac.createAnalyser();
    analyser.fftSize = 8192;
    analyser.smoothingTimeConstant = 0.55;
    monitor = ac.createGain();
    monitor.gain.value = Number($('volumeSlider').value)/100;
    const silentSink = ac.createGain();
    silentSink.gain.value = 0;
    lowpass.connect(analyser);
    analyser.connect(silentSink);
    silentSink.connect(ac.destination);
    monitor.connect(ac.destination);
    samples = new Float32Array(analyser.fftSize);
    spect = new Uint8Array(analyser.frequencyBinCount);
  }

  function disconnectTone() {
    for (const node of toneNodes) {
      try { if (typeof node.stop === 'function') node.stop(); } catch (_) { /* already stopped */ }
      try { node.disconnect(); } catch (_) { /* disconnected */ }
    }
    toneNodes = [];
  }

  function startTone() {
    disconnectTone();
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = getFreq();
    const harmonic = ac.createOscillator();
    harmonic.type = 'triangle';
    harmonic.frequency.value = getFreq()*2;
    const gain = ac.createGain();
    gain.gain.value = 0.12;
    const harmonicGain = ac.createGain();
    harmonicGain.gain.value = 0.018;
    const wobble = ac.createOscillator();
    wobble.type = 'sine';
    wobble.frequency.value = 1.85; // a slow, original funk-inspired pulse
    const wobbleGain = ac.createGain();
    wobbleGain.gain.value = 0.055;
    wobble.connect(wobbleGain);
    wobbleGain.connect(gain.gain);
    osc.connect(gain);
    harmonic.connect(harmonicGain);
    harmonicGain.connect(gain);
    gain.connect(lowpass);
    gain.connect(monitor);
    osc.start(); harmonic.start(); wobble.start();
    toneNodes = [osc, harmonic, wobble, gain, harmonicGain, wobbleGain];
  }

  function ensureFileNode() {
    if (!fileElement) {
      fileElement = document.createElement('audio');
      fileElement.preload = 'auto';
      fileElement.loop = true;
      fileNode = ac.createMediaElementSource(fileElement);
      fileNode.connect(lowpass);
      fileNode.connect(monitor);
    }
    fileElement.src = fileURL;
  }

  async function engage() {
    if (running) { stopPlayback('Playback paused.'); return; }
    if (flight.fault) { displayMessage('Thermal safety trip. Reset the simulation before re-engaging.'); return; }
    if (flight.propellantKg <= 0) { displayMessage('Propellant depleted. Reset the simulation.'); return; }
    if (source === 'file' && !fileURL) { displayMessage('Select a local audio file first.'); return; }
    try {
      setupAudio();
      await ac.resume();
      if (source === 'tone') {
        if (fileElement) fileElement.pause();
        startTone();
      } else {
        disconnectTone();
        ensureFileNode();
        await fileElement.play();
      }
      running = true;
      $('playBtn').innerHTML = 'Ⅱ <span>PAUSE THE GROOVE</span>';
      displayMessage('Drive engaged. The sound modulates thrust; the simulated electrical bus supplies energy.');
    } catch (error) {
      stopPlayback('Playback unavailable: ' + (error && error.message ? error.message : String(error)));
    }
  }

  function stopPlayback(message = 'Emergency stop engaged. Simulated thrust is zero.') {
    running = false;
    disconnectTone();
    if (fileElement) fileElement.pause();
    inputLevel = 0;
    detectedHz = 0;
    $('playBtn').innerHTML = '▶ <span>ENGAGE THE GROOVE</span>';
    displayMessage(message);
  }

  function readAudio() {
    if (!running || !analyser) { inputLevel = 0; detectedHz = 0; return; }
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (let i = 0; i < samples.length; i += 4) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / (samples.length / 4));
    inputLevel = core.clamp(rms / 0.07, 0, 1);
    if (source === 'tone') {
      detectedHz = getFreq();
      return;
    }
    analyser.getByteFrequencyData(spect);
    const binSize = ac.sampleRate / analyser.fftSize;
    const begin = Math.max(1, Math.ceil(core.MIN_HZ/binSize));
    const end = Math.min(spect.length-1, Math.floor(core.MAX_HZ/binSize));
    let peak = 0;
    let peakBin = 0;
    for (let i=begin; i<=end; i++) {
      if (spect[i] > peak) { peak=spect[i]; peakBin=i; }
    }
    detectedHz = peak > 15 && inputLevel > .01 ? peakBin * binSize : 0;
    if (!detectedHz) inputLevel = 0;
  }

  function setSliderOutputs() {
    $('freqOut').textContent = getFreq() + ' Hz';
    $('busOut').textContent = (getPower()/1000) + ' kW';
    $('sensitivityOut').textContent = Math.round(getSensitivity()*100) + '%';
    $('volumeOut').textContent = $('volumeSlider').value + '%';
    if (monitor) monitor.gain.value = Number($('volumeSlider').value)/100;
    if (toneNodes.length) {
      const [osc, harmonic] = toneNodes;
      osc.frequency.setTargetAtTime(getFreq(), ac.currentTime, 0.015);
      harmonic.frequency.setTargetAtTime(getFreq()*2, ac.currentTime, 0.015);
    }
  }

  function formatTime(s) {
    const seconds = Math.floor(s);
    return String(Math.floor(seconds/60)).padStart(2,'0') + ':' + String(seconds%60).padStart(2,'0');
  }

  function renderReadouts() {
    const c = currentCycle;
    const pct = inputLevel*100;
    $('signalValue').textContent = Math.round(pct).toString();
    $('thrustValue').textContent = c.thrustN.toFixed(3);
    $('powerValue').textContent = (c.busDrawW/1000).toFixed(2);
    $('speedValue').textContent = flight.speedMS.toFixed(4);
    $('signalMeter').style.width = pct + '%';
    $('thrustMeter').style.width = Math.min(100, c.thrustN/3.1*100) + '%';
    $('powerMeter').style.width = Math.min(100, c.busDrawW/50000*100) + '%';
    $('speedMeter').style.width = Math.min(100, flight.speedMS/0.1*100) + '%';
    $('peakHz').textContent = 'FUNDAMENTAL: ' + (detectedHz ? detectedHz.toFixed(1) : '--') + ' HZ';
    $('tempValue').textContent = flight.tempC.toFixed(1) + ' °C';
    $('piezoValue').textContent = c.recoveredW.toFixed(0) + ' W';
    $('fuelValue').textContent = flight.propellantKg.toFixed(3) + ' kg';
    $('elapsedValue').textContent = formatTime(flight.timeS);
    $('extraMetricValue').textContent = fictional ? (c.throttle*4.2).toFixed(2) + ' / 4.20' : (c.jetPowerW/1000).toFixed(2) + ' kW';
    $('safetyLabel').textContent = flight.fault ? 'THERMAL TRIP' : (running ? 'MONITORING' : 'NOMINAL');
    $('safetyDot').classList.toggle('error', flight.fault);
    $('safetyText').textContent = flight.fault ? 'Thermal safety latched. Reset required.' : 'Thermal trip at 85 °C (illustrative)';
    $('engineStatus').textContent = flight.fault ? 'FAULT / SAFE' : (running ? 'SIGNAL LOCKED' : 'AWAITING SIGNAL');
    $('engineStatus').style.color = flight.fault ? '#ff8ba5' : '#9de8db';
    $('topStatus').textContent = flight.fault ? 'SAFETY TRIP' : (running ? 'DRIVE ACTIVE' : 'SYSTEM STANDBY');
    $('topStatusLight').classList.toggle('on', running && !flight.fault);
    $('topStatusLight').classList.toggle('fault', flight.fault);
  }

  function canvasSize(canvas, context) {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width*ratio));
    const height = Math.max(1, Math.round(rect.height*ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width=width;canvas.height=height; }
    context.setTransform(ratio,0,0,ratio,0,0);
    return {w:rect.width,h:rect.height};
  }

  function ellipse(ctx,x,y,rx,ry,color,opacity=1,lineWidth=1) {
    ctx.beginPath();ctx.ellipse(x,y,Math.max(0,rx),Math.max(0,ry),0,0,Math.PI*2);
    ctx.strokeStyle=color;ctx.globalAlpha=opacity;ctx.lineWidth=lineWidth;ctx.stroke();ctx.globalAlpha=1;
  }

  function renderEngine(time) {
    const {w,h} = canvasSize(engineCanvas,engineCtx);
    const ctx=engineCtx;ctx.clearRect(0,0,w,h);
    const t=time/1000;const energy=currentCycle.throttle;const glow=0.18+0.82*energy;
    for(let i=0;i<10;i++){const y=(i+.5)*h/10;ctx.strokeStyle='rgba(65,114,159,.055)';ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
    for(let i=0;i<14;i++){const x=(i+.5)*w/14;ctx.strokeStyle='rgba(65,114,159,.042)';ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
    stars.forEach((s,i)=>{const twinkle=.2+.3*(1+Math.sin(t*.5+i*.7))/2;ctx.fillStyle=`rgba(166,204,250,${twinkle})`;ctx.beginPath();ctx.arc(s.x*w,s.y*h,s.r,0,Math.PI*2);ctx.fill();});
    const cy=h*.49;const x0=w*.11;const x1=w*.85;const chamberH=Math.min(118,h*.43);
    // Structural cage.
    const cage=ctx.createLinearGradient(0,cy-chamberH,0,cy+chamberH);
    cage.addColorStop(0,'#1e354d');cage.addColorStop(.22,'#18283d');cage.addColorStop(.55,'#132037');cage.addColorStop(1,'#202c45');
    ctx.fillStyle=cage;ctx.fillRect(x0,cy-chamberH/2,x1-x0,chamberH);
    ctx.strokeStyle='#64799888';ctx.lineWidth=1.5;ctx.strokeRect(x0,cy-chamberH/2,x1-x0,chamberH);
    // Core translucent energy tube.
    const tube=ctx.createLinearGradient(0,cy-chamberH*.3,0,cy+chamberH*.3);
    tube.addColorStop(0,'#063747');tube.addColorStop(.5,`rgba(25,173,230,${.09+.19*glow})`);tube.addColorStop(1,'#08243e');
    ctx.fillStyle=tube;ctx.fillRect(x0+6,cy-chamberH*.3,x1-x0-12,chamberH*.6);
    // Concentric segmented coils.
    const positions=[w*.235,w*.335,w*.455,w*.565,w*.67,w*.785];
    positions.forEach((x,i)=>{
      const hue=i<2?'#4dddf5':i<4?'#aa8cf6':'#ef80c7';
      const pul=glow*(.64+.36*Math.sin(t*5-i*1.15)**2);
      ctx.shadowBlur=16*pul;ctx.shadowColor=hue;
      ellipse(ctx,x,cy,15,chamberH*.55,hue,.35+pul*.6,3.2);
      ellipse(ctx,x,cy,7,chamberH*.46,'#d2e3ff',.17+pul*.38,1.1);
      ctx.shadowBlur=0;
    });
    // Lowrider-style armature and hexagonal crystal tessellation.
    ctx.lineWidth=.7;
    for(let k=0;k<12;k++){
      const x=x0+16+k*(x1-x0-34)/11;
      ctx.strokeStyle=`rgba(155,127,248,${.10+.17*energy})`;
      ctx.beginPath();ctx.moveTo(x,cy-chamberH*.30);ctx.lineTo(x+9,cy-chamberH*.16);ctx.lineTo(x,cy);ctx.lineTo(x+9,cy+chamberH*.16);ctx.lineTo(x,cy+chamberH*.30);ctx.stroke();
    }
    // Energy particles moving through all three phases.
    for(let i=0;i<30;i++){
      const phase=(i/30 + t*(.06+.25*energy))%1;
      const x=x0+(x1-x0)*phase;
      const y=cy+Math.sin(i*11+t*2.4)*chamberH*.16;
      const col=phase<.33?'83,224,250':phase<.66?'171,139,246':'243,135,196';
      ctx.fillStyle=`rgba(${col},${.12+.85*energy})`;
      ctx.beginPath();ctx.arc(x,y,1.2+2*energy,0,Math.PI*2);ctx.fill();
    }
    // First-stage intake.
    ctx.strokeStyle='#5bd2e9';ctx.lineWidth=2;for(let j=-1;j<=1;j++){
      const off=j*chamberH*.38;
      ctx.beginPath();ctx.moveTo(x0-35,cy+off);ctx.lineTo(x0,cy+off*.65);ctx.stroke();
    }
    // Rear nozzle and modeled exhaust.
    ctx.fillStyle='#29405b';ctx.beginPath();ctx.moveTo(x1,cy-chamberH*.52);ctx.lineTo(x1+14,cy-chamberH*.30);ctx.lineTo(x1+14,cy+chamberH*.30);ctx.lineTo(x1,cy+chamberH*.52);ctx.closePath();ctx.fill();
    const exhaust=ctx.createLinearGradient(x1,0,w,0);exhaust.addColorStop(0,fictional?'rgba(177,100,248,.65)':'rgba(245,116,192,.55)');exhaust.addColorStop(1,'rgba(240,125,245,0)');
    ctx.globalAlpha=energy;ctx.fillStyle=exhaust;ctx.beginPath();ctx.moveTo(x1+13,cy-10);ctx.lineTo(w,cy-35-11*Math.sin(t*3));ctx.lineTo(w,cy+35+11*Math.sin(t*3));ctx.lineTo(x1+13,cy+10);ctx.closePath();ctx.fill();ctx.globalAlpha=1;
    if(fictional){
      ctx.setLineDash([6,7]);for(let k=0;k<3;k++) ellipse(ctx,w*.55,cy,w*(.24+k*.09),chamberH*(.68+k*.22),'#b98cfc',energy*.35,1.4);
      ctx.setLineDash([]);ctx.font='10px monospace';ctx.fillStyle='#cb99ff';ctx.fillText('FICTIONAL FIELD / NOT A METRIC SOLUTION',16,24);
    }
    ctx.font='10px monospace';ctx.fillStyle='#86b9cf';ctx.fillText('AUDIO / CONTROL',x0,cy+chamberH*.85);ctx.fillStyle='#bf9cee';ctx.fillText('PIEZO / RECOVERY',x0+(x1-x0)*.36,cy+chamberH*.85);ctx.fillStyle='#eb9ec9';ctx.fillText(fictional?'METRIC / LORE':'JET / REACTION',Math.min(w-125,x0+(x1-x0)*.72),cy+chamberH*.85);
  }

  function renderWave(time) {
    const {w,h}=canvasSize(waveCanvas,waveCtx);const ctx=waveCtx;ctx.clearRect(0,0,w,h);
    ctx.strokeStyle='#273f57';ctx.lineWidth=.6;for(let i=1;i<5;i++){const y=h*i/5;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
    for(let i=1;i<14;i++){const x=w*i/14;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
    ctx.strokeStyle='#5b7e8e';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,h*.5);ctx.lineTo(w,h*.5);ctx.stroke();
    if(!running||!analyser){ctx.strokeStyle='#37839e';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();return;}
    ctx.shadowColor='#5be0fb';ctx.shadowBlur=10;ctx.strokeStyle='#71e2fa';ctx.lineWidth=1.7;ctx.beginPath();
    for(let i=0;i<w;i++){
      const index=Math.min(samples.length-1,Math.floor(i/w*samples.length));
      const y=h*.5-samples[index]*h*.31;
      if(i===0)ctx.moveTo(i,y);else ctx.lineTo(i,y);
    }
    ctx.stroke();ctx.shadowBlur=0;
  }

  function drawBench() {
    const canvas=$('benchCanvas');
    if (!canvas || !lastSweep) return;
    const ctx=canvas.getContext('2d');
    const {w,h}=canvasSize(canvas,ctx);
    ctx.clearRect(0,0,w,h);
    const left=58,right=18,top=19,bottom=37;
    const plotW=Math.max(1,w-left-right),plotH=Math.max(1,h-top-bottom);
    const values=lastSweep.points;
    const xMin=values[0].x,xMax=values[values.length-1].x;
    const yPeak=Math.max(...values.map(p=>p.thrustN));
    const yMax=Math.max(0.1,yPeak*1.15);
    ctx.font='11px monospace';
    ctx.lineWidth=1;
    for(let i=0;i<=4;i++){
      const y=top+plotH*(i/4);
      ctx.strokeStyle='rgba(122,165,193,.22)';
      ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(left+plotW,y);ctx.stroke();
      ctx.fillStyle='#a7c4d2';
      ctx.textAlign='right';
      ctx.fillText((yMax*(1-i/4)).toFixed(2),left-9,y+4);
    }
    for(let i=0;i<=5;i++){
      const x=left+plotW*(i/5);
      ctx.strokeStyle='rgba(122,165,193,.13)';
      ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,top+plotH);ctx.stroke();
      ctx.fillStyle='#a7c4d2';ctx.textAlign='center';
      ctx.fillText((xMin+(xMax-xMin)*i/5).toFixed(0),x,top+plotH+17);
    }
    ctx.fillStyle='#adc4d9';ctx.textAlign='left';ctx.fillText('THRUST N',left,12);
    ctx.textAlign='right';ctx.fillText(lastSweep.label+' ('+lastSweep.xUnit+')',w-right,h-5);
    ctx.strokeStyle='#58dcf2';ctx.lineWidth=2.5;ctx.beginPath();
    values.forEach((point,i)=>{
      const x=left+(point.x-xMin)/(xMax-xMin)*plotW;
      const y=top+plotH-point.thrustN/yMax*plotH;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    });
    ctx.stroke();
    if(lastSweep.mode==='frequency'){
      ctx.setLineDash([4,4]);ctx.strokeStyle='#c8a6f6';ctx.lineWidth=1;
      for(const hz of [core.MIN_HZ,core.MAX_HZ]){
        const x=left+(hz-xMin)/(xMax-xMin)*plotW;
        ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,top+plotH);ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }

  function runBench() {
    const mode=$('benchMode').value;
    try {
      lastSweep=globalThis.GBIOSBench.createSweep(mode,{
        powerW:getPower(),sensitivity:getSensitivity(),frequencyHz:getFreq(),bassLevel:0.75
      });
      const maxN=Math.max(...lastSweep.points.map(p=>p.thrustN));
      $('benchSummary').textContent=lastSweep.points.length+' modeled points | peak '+maxN.toFixed(3)+' N | '+lastSweep.label+'. Values come from an illustrative electric-thruster formula, not measured engine performance.';
      $('benchExportBtn').disabled=false;
      drawBench();
    } catch(error) {
      lastSweep=null;$('benchExportBtn').disabled=true;
      $('benchSummary').textContent='Bench error: '+(error && error.message ? error.message : String(error));
    }
  }

  function exportBench() {
    if(!lastSweep)return;
    const data=globalThis.GBIOSBench.exportCSV(lastSweep);
    const url=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');
    link.href=url;link.download='gbios-'+lastSweep.mode+'-sweep.csv';
    document.body.appendChild(link);link.click();link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function frame(time) {
    const dt=previousTime ? Math.min(.1,Math.max(0,(time-previousTime)/1000)) : 0;
    previousTime=time;
    readAudio();
    currentCycle=core.computeCycle({active:running,fault:flight.fault,powerW:getPower(),bassLevel:inputLevel,sensitivity:getSensitivity(),frequencyHz:detectedHz,tempC:flight.tempC,propellantKg:flight.propellantKg});
    if(running){
      flight=core.advanceState(flight,currentCycle,dt);
      if(flight.fault) stopPlayback('Thermal safety trip triggered. Simulated engine stopped. Press reset.');
      else if(flight.propellantKg<=0) stopPlayback('Propellant exhausted. Simulated engine stopped.');
    }
    renderReadouts();renderEngine(time);renderWave(time);
    window.requestAnimationFrame(frame);
  }

  $('benchRunBtn').addEventListener('click',runBench);
  $('benchExportBtn').addEventListener('click',exportBench);
  window.addEventListener('resize',drawBench);
  $('engineeringBtn').addEventListener('click',()=>selectMode(false));
  $('fictionBtn').addEventListener('click',()=>selectMode(true));
  $('toneSourceBtn').addEventListener('click',()=>selectSource('tone'));
  $('fileSourceBtn').addEventListener('click',()=>selectSource('file'));
  ['freqSlider','powerSlider','sensitivitySlider','volumeSlider'].forEach(id=>$(id).addEventListener('input',setSliderOutputs));
  $('playBtn').addEventListener('click',engage);
  $('stopBtn').addEventListener('click',()=>stopPlayback());
  $('resetBtn').addEventListener('click',()=>{stopPlayback('Flight and thermal model reset. All counters cleared.');flight=core.newState();});
  $('audioFile').addEventListener('change',event=>{
    const file=event.target.files && event.target.files[0];
    if(!file)return;
    if(fileURL)URL.revokeObjectURL(fileURL);
    fileURL=URL.createObjectURL(file);
    $('fileName').textContent=file.name;
    displayMessage('Local track selected: '+file.name+'. Nothing is uploaded.');
    if(fileElement){fileElement.pause();fileElement.src=fileURL;}
  });
  window.addEventListener('pagehide',()=>{
    disconnectTone();if(fileElement)fileElement.pause();if(fileURL)URL.revokeObjectURL(fileURL);
    if(ac)ac.close().catch(()=>{});
  });
  setSliderOutputs();renderReadouts();window.requestAnimationFrame(frame);
})();