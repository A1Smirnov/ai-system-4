'use strict';
const path=require('node:path');

/**
 * One profile location for both the transport and bounded form connector.
 * A packet ID is an identifier, never a relative path supplied by a page.
 * @param {string} root
 * @param {string} packetId
 * @param {NodeJS.Platform} [platform]
 * @returns {string}
 */
function profileDirectory(root,packetId,platform=process.platform){
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(packetId))throw Error('Exact packet UUID required');
 return path.join(root,'data/career-private',platform==='win32'?'browser':'browser-linux',packetId);
}
module.exports={profileDirectory};
