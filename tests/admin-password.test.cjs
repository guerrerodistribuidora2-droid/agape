const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
const state = { token: null, credential: null };
const env = { AGAPE_ADMIN_USERNAME: 'organizador', AGAPE_ADMIN_PASSWORD_SALT: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', AGAPE_ADMIN_PASSWORD_HASH: crypto.pbkdf2Sync('clave-original', Buffer.alloc(24), 100000, 32, 'sha256').toString('base64url'), AGAPE_ADMIN_SESSION_SECRET: 'a'.repeat(40) };
const db = { prepare(sql) { let args; return { bind(...a) { args=a; return this; }, async first() {
  if (sql.includes('SELECT salt, password_hash, version')) return state.credential;
  if (sql.includes('DELETE FROM admin_password_tokens')) { if (!state.token || state.token.username!==args[0] || state.token.hash!==args[1] || !state.token.valid) return null; const row=state.token; state.token=null; return { username: row.username }; }
  throw Error('Unexpected first: '+sql);
}, async run() {
  if (!sql.includes('INSERT INTO admin_credentials')) throw Error('Unexpected run: '+sql);
  state.credential={salt:args[1],password_hash:args[2],version:(state.credential?.version||0)+1}; return {meta:{changes:1}};
} }; } };
function load(path, dependencies) {
  const source = fs.readFileSync(path,'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  const req=(id)=>id in dependencies ? dependencies[id] : require(id);
  vm.runInNewContext(`(function(require,module,exports){${js}\n})`, {crypto:crypto.webcrypto,TextEncoder,TextDecoder,Uint8Array, btoa,atob,Request,Response,URL,console})(req,module,module.exports);
  return module.exports;
}
const shared={ '@/lib/runtime-env':{env}, '@/lib/turso':{getDatabase:()=>db}, '../app/chatgpt-auth':{} };
const auth=load('lib/admin-auth.ts',shared);
const reset=load('app/api/admin/password/reset/route.ts',{...shared,'@/lib/admin-auth':auth});
function request(token,password,origin='https://agape.example') {return new Request('https://agape.example/api/admin/password/reset',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({token,password})});}
test('un enlace válido se usa una sola vez e invalida sesiones anteriores',async()=>{
  assert.equal(await auth.verifyAdminCredentials('organizador','clave-original'),true);
  const cookie=await auth.createAdminSessionCookie('organizador');
  const token=crypto.randomBytes(32).toString('base64url');
  state.token={username:'organizador',hash:crypto.createHash('sha256').update(token).digest('hex'),valid:true};
  assert.equal((await reset.POST(request(token,'nueva-clave'))).status,200);
  assert.equal(await auth.verifyAdminCredentials('organizador','nueva-clave'),true);
  assert.equal(await auth.verifyAdminCredentials('organizador','clave-original'),false);
  assert.equal(await auth.adminSessionFromCookie(cookie),null);
  assert.equal((await reset.POST(request(token,'otra-clave'))).status,400);
});
test('rechaza enlaces vencidos y peticiones de otro origen',async()=>{
  const token=crypto.randomBytes(32).toString('base64url');
  state.token={username:'organizador',hash:crypto.createHash('sha256').update(token).digest('hex'),valid:false};
  assert.equal((await reset.POST(request(token,'otra-clave'))).status,400);
  assert.equal((await reset.POST(request(token,'otra-clave','https://otro.example'))).status,403);
  assert.equal(await auth.verifyAdminCredentials('organizador','nueva-clave'),true);
});
