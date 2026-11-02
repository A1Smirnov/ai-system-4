'use strict';
/** @param {unknown} value @param {number} [at] @returns {boolean} */
function unexpired(value,at=Date.now()){
 if(typeof value!=='string')return false;
 const time=Date.parse(value);return Number.isFinite(time)&&time>at;
}
/** @param {unknown} value @param {number} maxAgeMs @param {number} [at] @returns {boolean} */
function fresh(value,maxAgeMs,at=Date.now()){
 if(typeof value!=='string')return false;
 const time=Date.parse(value);return Number.isFinite(time)&&time<=at+5000&&at-time<=maxAgeMs;
}
module.exports={unexpired,fresh};
