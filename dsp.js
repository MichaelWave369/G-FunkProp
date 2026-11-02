/* G-BIOS Rung 4: conservative, deterministic low-frequency signal estimator.
 * Educational Web Audio diagnostic; NOT laboratory calibration or hardware sensing.
 * Works on PCM Float32Array windows, with no browser or network dependencies. */
(function (root) {
  'use strict';
  const MIN_HZ = 12;
  const MAX_HZ = 88;
  const SEARCH_MIN_HZ = 6;
  const SEARCH_MAX_HZ = 120;
  const MIN_WINDOW_S = 0.45;
  const MIN_RMS = 0.0015;
  const MIN_CONFIDENCE = 0.22;

  function clamp(x,min,max) { return Math.max(min,Math.min(max,x)); }
  function analyze(samples,sampleRate) {
    if (!samples || typeof samples.length !== 'number' || !Number.isFinite(sampleRate) ||
        sampleRate < 1000 || samples.length < MIN_WINDOW_S*sampleRate) {
      return {detected:false,frequencyHz:0,level:0,rms:0,confidence:0,reason:'insufficient PCM window'};
    }
    // Downsample by box-averaging. A real lowpass filter must precede this,
    // as in the live Web Audio graph. This averaging is NOT a sufficient anti-alias filter.
    const stride=Math.max(1,Math.round(sampleRate/3000));
    const size=Math.floor(samples.length/stride);
    if (size < 256) return {detected:false,frequencyHz:0,level:0,rms:0,confidence:0,reason:'insufficient samples'};
    const decimated=new Float64Array(size);
    let mean=0;
    for(let i=0;i<size;i++){
      let sum=0;
      for(let j=0;j<stride;j++){
        const v=Number(samples[i*stride+j]);
        if (!Number.isFinite(v)) return {detected:false,frequencyHz:0,level:0,rms:0,confidence:0,reason:'invalid samples'};
        sum+=v;
      }
      const value=sum/stride;
      decimated[i]=value;mean+=value;
    }
    mean/=size;
    let sumSquares=0,sumWindow=0;
    const windowed=new Float64Array(size);
    for(let i=0;i<size;i++){
      const centered=decimated[i]-mean;
      sumSquares+=centered*centered;
      const weight=.5-.5*Math.cos(2*Math.PI*i/(size-1));
      windowed[i]=centered*weight;
      sumWindow+=weight;
    }
    const rms=Math.sqrt(sumSquares/size);
    if(rms < MIN_RMS) return {detected:false,frequencyHz:0,level:0,rms,confidence:0,reason:'below noise gate'};
    const rate=sampleRate/stride;
    const strengths=new Float64Array(SEARCH_MAX_HZ-SEARCH_MIN_HZ+1);
    let strongest=0,peakBin=0;
    // Goertzel evaluation for each candidate frequency, including frequencies
    // OUTSIDE the 12–88 Hz allowed band to avoid false acceptance of 10 or 95 Hz.
    for(let hz=SEARCH_MIN_HZ;hz<=SEARCH_MAX_HZ;hz++){
      const angle=2*Math.PI*hz/rate,coefficient=2*Math.cos(angle);
      let prev=0,prev2=0;
      for(let i=0;i<size;i++){
        const next=windowed[i]+coefficient*prev-prev2;
        prev2=prev;prev=next;
      }
      const power=Math.max(0,prev*prev+prev2*prev2-coefficient*prev*prev2);
      const amplitude=2*Math.sqrt(power)/sumWindow;
      strengths[hz-SEARCH_MIN_HZ]=amplitude;
      if(amplitude>strongest){strongest=amplitude;peakBin=hz-SEARCH_MIN_HZ;}
    }
    let frequencyHz=SEARCH_MIN_HZ+peakBin;
    if(peakBin>0 && peakBin<strengths.length-1){
      const a=strengths[peakBin-1],b=strengths[peakBin],c=strengths[peakBin+1];
      const denominator=a-2*b+c;
      if(denominator < -1e-12) frequencyHz+=clamp(.5*(a-c)/denominator,-.5,.5);
    }
    // Stabilize numerically exact integer tones (e.g., 88.00000025 Hz)
    // without widening the physical 12–88 Hz model gate.
    if (Math.abs(frequencyHz-Math.round(frequencyHz))<0.0001) frequencyHz=Math.round(frequencyHz);
    const confidence=clamp(strongest/(Math.SQRT2*rms),0,1);
    const inBand=frequencyHz>=MIN_HZ && frequencyHz<=MAX_HZ;
    const detected=inBand && confidence>=MIN_CONFIDENCE;
    const reason=!inBand?'dominant frequency outside gate':confidence<MIN_CONFIDENCE?'insufficient tonal confidence':'signal within gate';
    return {
      detected,frequencyHz,level:detected?clamp(rms/.07,0,1):0,
      rms,confidence,reason,windowSeconds:samples.length/sampleRate
    };
  }
  root.GBIOSDSP=Object.freeze({
    MIN_HZ,MAX_HZ,SEARCH_MIN_HZ,SEARCH_MAX_HZ,
    MIN_WINDOW_S,MIN_RMS,MIN_CONFIDENCE,analyze
  });
})(typeof globalThis === 'object' ? globalThis : this);
