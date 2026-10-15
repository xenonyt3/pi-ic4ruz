export function validateBudget(config) {
  if (!config || typeof config !== 'object') throw new Error('BUDGET_REQUIRED');
  for (const key of ['maxRequests','maxInputTokens','maxOutputTokens','maxDurationMs','maxAttempts']) {
    if (!Number.isSafeInteger(config[key]) || config[key] <= 0) throw new Error(`INVALID_BUDGET_${key}`);
  }
  if (config.maxCost !== undefined && (!Number.isFinite(config.maxCost) || config.maxCost <= 0)) throw new Error('INVALID_COST_BUDGET');
  if (config.maxCost !== undefined && (!config.priceVerified || !Number.isFinite(config.inputPricePerMillion) || config.inputPricePerMillion<0 || !Number.isFinite(config.outputPricePerMillion) || config.outputPricePerMillion<0)) throw new Error('VERIFIED_PRICING_REQUIRED');
  return Object.freeze({...config});
}

export class EvaluationBudget {
  constructor(config, clock=Date.now) {this.config=validateBudget(config);this.clock=clock;this.started=clock();this.requests=0;this.input=0;this.output=0;this.pending=new Map();this.sequence=0;this.stopped=false;}
  reserve({inputTokens,outputTokens,kind='parent'}) {
    if(this.stopped||this.clock()-this.started>=this.config.maxDurationMs)throw new Error('BUDGET_STOP');
    if(!Number.isSafeInteger(inputTokens)||inputTokens<0||!Number.isSafeInteger(outputTokens)||outputTokens<=0)throw new Error('INVALID_RESERVATION');
    const reserved=[...this.pending.values()];
    const input=this.input+reserved.reduce((n,r)=>n+r.inputTokens,0)+inputTokens;
    const output=this.output+reserved.reduce((n,r)=>n+r.outputTokens,0)+outputTokens;
    const cost=(input*(this.config.inputPricePerMillion??0)+output*(this.config.outputPricePerMillion??0))/1e6;
    if(this.requests+this.pending.size+1>this.config.maxRequests||input>this.config.maxInputTokens||output>this.config.maxOutputTokens||(this.config.maxCost!==undefined&&cost>this.config.maxCost))throw new Error('BUDGET_EXHAUSTED');
    const id=++this.sequence;this.pending.set(id,{inputTokens,outputTokens,kind});return id;
  }
  settle(id,usage) {
    const reservation=this.pending.get(id);if(!reservation)throw new Error('UNKNOWN_RESERVATION');
    this.pending.delete(id);this.requests++;
    if(!usage||!Number.isSafeInteger(usage.input)||usage.input<0||!Number.isSafeInteger(usage.output)||usage.output<0){this.input+=reservation.inputTokens;this.output+=reservation.outputTokens;this.stopped=true;return{status:'usage_unknown',reservationCharged:true};}
    this.input+=usage.input;this.output+=usage.output;
    if(usage.input>reservation.inputTokens||usage.output>reservation.outputTokens)this.stopped=true;
    return{status:this.stopped?'overshoot_stop':'accounted',actual:usage};
  }
}
