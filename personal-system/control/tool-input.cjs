'use strict';

/** @typedef {import('../../types/contracts').ToolSchema} ToolSchema */
const SCHEMA_KEYS=new Set(['type','properties','required','additionalProperties','items','enum','minLength','maxLength','minimum','maximum','minItems','maxItems','uniqueItems','title','description','default']);
/** @param {string} location @returns {never} */
function invalid(location){throw new TypeError('Invalid tool input at '+location);}

/**
 * Enforce the small JSON-schema subset used by our fixed MCP tools.
 * No coercion, defaults, code execution, remote refs or third-party schema loading.
 * Values are deliberately excluded from errors: they may contain private data.
 * @param {ToolSchema} schema
 * @param {unknown} value
 * @param {string} [location]
 * @param {number} [depth]
 * @returns {void}
 */
function validate(schema,value,location='$',depth=0){
 if(Object.keys(schema).some(key=>!SCHEMA_KEYS.has(key)))throw Error('Unsupported local tool schema keyword');
 if(depth>12)invalid(location);
 const types=Array.isArray(schema.type)?schema.type:[schema.type];
 const matches=types.some(type=>{
  switch(type){
   case 'null':return value===null;
   case 'string':return typeof value==='string';
   case 'boolean':return typeof value==='boolean';
   case 'integer':return typeof value==='number'&&Number.isSafeInteger(value);
   case 'number':return typeof value==='number'&&Number.isFinite(value);
   case 'array':return Array.isArray(value);
   case 'object':return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
   default:throw Error('Unsupported local tool schema type');
  }
 });
 if(!matches)invalid(location);
 if(schema.enum&&!schema.enum.some(item=>item===value))invalid(location);
 if(typeof value==='string'&&((schema.minLength!==undefined&&value.length<schema.minLength)||(schema.maxLength!==undefined&&value.length>schema.maxLength)))invalid(location);
 if(typeof value==='number'&&((schema.minimum!==undefined&&value<schema.minimum)||(schema.maximum!==undefined&&value>schema.maximum)))invalid(location);
 if(Array.isArray(value)){
  if((schema.minItems!==undefined&&value.length<schema.minItems)||(schema.maxItems!==undefined&&value.length>schema.maxItems))invalid(location);
  if(schema.uniqueItems){
   if(schema.items?.type!=='string')throw Error('Local uniqueItems schema supports string items only');
   if(new Set(value).size!==value.length)invalid(location);
  }
  if(!schema.items)throw Error('Array tool schema requires items');
  for(const item of value)validate(schema.items,item,location+'[]',depth+1);
 }else if(value!==null&&typeof value==='object'){
  const properties=schema.properties||{};
  for(const key of schema.required||[])if(!Object.hasOwn(value,key))invalid(location);
  for(const [key,item] of Object.entries(value)){
   if(!Object.hasOwn(properties,key)){if(schema.additionalProperties!==true)invalid(location);}
   else validate(properties[key],item,location+'.'+key,depth+1);
  }
 }
}

/** @param {{name:string,inputSchema:ToolSchema}[]} tools @param {unknown} name @param {unknown} input */
function authorize(tools,name,input){
 const tool=tools.find(tool=>tool.name===name);
 if(!tool)throw Error('Tool unavailable to role');
 validate(tool.inputSchema,input);
 return tool;
}
module.exports={validate,authorize};
