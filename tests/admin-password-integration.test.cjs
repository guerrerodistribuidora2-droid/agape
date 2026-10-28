const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
const {createClient} = require('@libsql/client');
function load(path,deps,extra={}) {
  const js=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}}; const req=(id)=>id in deps ? deps[id] : require(id);
  vm.runInNewContext(`(function(require,module,exports){${js}\n})`,{crypto:crypto.webcrypto,TextEncoder,TextDecoder,Uint8Array,btoa,atob,Request,Response,URL,console,...extra})(req,module,module.exports);
  return module.exports;
}
test('recuperación completa con SQLite aislado y servicio de correo simulado',async()=>{
  const sql=createClient({url:'file::memory:'});
  await sql.batch([
    'CREATE TABLE admin_credentials(username TEXT PRIMARY KEY,salt TEXT NOT NULL,password_hash TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT NOT NULL)',
    'CREATE TABLE admin_password_tokens(username TEXT PRIMARY KEY,token_hash TEXT UNIQUE NOT NULL,expires_at TEXT NOT NULL,created_at TEXT NOT NULL)',
    'CREATE TABLE admin_password_rate(username TEXT PRIMARY KEY,last_request_at TEXT NOT NULL)'
  ],'write');
  const db={prepare(query){let args=[];return {bind(...a){args=a;return this;},async run(){const r=await sql.execute({sql:query,args});return {meta:{changes:r.rowsAffected}};},async first(){const r=await sql.execute({sql:query,args});return r.rows[0]||null;}};}};
  const env={AGAPE_ADMIN_USERNAME:'agape1',AGAPE_ADMIN_PASSWORD_SALT:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',AGAPE_ADMIN_PASSWORD_HASH:crypto.pbkdf2Sync('original',Buffer.alloc(24),100000,32,'sha256').toString('base64url'),AGAPE_ADMIN_SESSION_SECRET:'a'.repeat(40),RESEND_API_KEY:'test-key',AGAPE_ADMIN_EMAIL_FROM:'onboarding@resend.dev',AGAPE_ADMIN_RECOVERY_EMAIL:'owner@example.test',SITE_BASE_URL:'https://agape.example'};
  const shared={'@/lib/runtime-env':{env},'@/lib/turso':{getDatabase:()=>db},'../app/chatgpt-auth':{}};
  const auth=load('lib/admin-auth.ts',shared); let sent;
  const fakeFetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');sent=JSON.parse(options.body);return new Response('{}',{status:200});};
  const requestRoute=load('app/api/admin/password/request/route.ts',{...shared,'@/lib/admin-auth':auth},{fetch:fakeFetch});
  const resetRoute=load('app/api/admin/password/reset/route.ts',{...shared,'@/lib/admin-auth':auth});
  const call=(path,body)=>new Request('https://agape.example'+path,{method:'POST',headers:{origin:'https://agape.example','Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await requestRoute.POST(call('/api/admin/password/request',{mode:'recover',username:'agape1'}))).status,200);
  assert.deepEqual(sent.to,['owner@example.test']);
  assert.match(sent.html,/https:\/\/agape\.example\/admin\/restablecer#/);
  assert.equal((await requestRoute.POST(call('/api/admin/password/request',{mode:'recover',username:'agape1'}))).status,429);
  const token=sent.html.match(/restablecer#([A-Za-z0-9_-]+)/)[1];
  const stored=await sql.execute('SELECT token_hash FROM admin_password_tokens');
  assert.notEqual(stored.rows[0].token_hash,token);
  const oldCookie=await auth.createAdminSessionCookie('agape1');
  assert.equal((await resetRoute.POST(call('/api/admin/password/reset',{token,password:'nueva-clave'}))).status,200);
  assert.equal(await auth.verifyAdminCredentials('agape1','original'),false);
  assert.equal(await auth.verifyAdminCredentials('agape1','nueva-clave'),true);
  assert.equal(await auth.adminSessionFromCookie(oldCookie),null);
  assert.equal((await resetRoute.POST(call('/api/admin/password/reset',{token,password:'otra-clave'}))).status,400);
  sql.close();
});
